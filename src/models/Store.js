import { EventEmitter } from "../core/EventEmitter.js";
import { SCHEMA_VERSION, PALETTES, PALETTE, DAY_MS } from "../core/constants.js";
import { Settings } from "./Settings.js";
import { Task } from "./Task.js";
import { Segment } from "./Segment.js";
import { startOfDay, toLocalISO } from "../utils/datetime.js";

/**
 * Source de vérité unique. Détient settings / tasks / segments / meta,
 * expose des requêtes et des commandes, persiste et émet `change` à chaque
 * mutation. Les primitives privées ne committent pas ; les commandes
 * publiques regroupent les primitives et committent une seule fois.
 */
export class Store extends EventEmitter {
  #idSeq = 0;
  #hadLocal = false;

  constructor(persistence) {
    super();
    this.persistence = persistence;
    this.version = SCHEMA_VERSION;
    this.settings = new Settings();
    this.tasks = [];
    this.segments = [];
    this.meta = { lastExport: null };
    // Compteur de révision : incrémenté à chaque mutation committée (et à chaque
    // hydratation). Sert de clé de cache aux agrégats coûteux (StatsAggregator)
    // pour ne pas rebalayer l'historique à chaque rendu.
    this.rev = 0;
    const local = this.persistence.loadSync();
    if (local) { this.hydrate(local); this.#hadLocal = true; } // affichage instantané (miroir récent)
  }

  /**
   * Charge l'historique complet depuis IndexedDB une fois prêt, et migre les
   * anciennes données (localStorage seul) vers IndexedDB si nécessaire.
   * À appeler une fois au démarrage, avant de câbler les interactions.
   */
  async ready() {
    await this.persistence.init();
    const full = await this.persistence.loadFull();
    if (full) {
      this.hydrate(full);                 // historique complet (IndexedDB fait foi)
    } else if (this.#hadLocal) {
      this.persist();                     // IndexedDB vide : on y migre l'état local
    }
  }

  hydrate(raw) {
    const data = this.#migrate(raw);
    this.version = SCHEMA_VERSION; // toujours réécrit au format courant
    this.settings = Settings.fromJSON(data.settings);
    this.tasks = (data.tasks ?? []).map(Task.fromJSON);
    this.segments = (data.segments ?? []).map(Segment.fromJSON);
    this.meta = { lastExport: null, ...(data.meta ?? {}) };
    this.rev += 1;
  }

  /**
   * Migration ascendante du format. La plupart des champs ajoutés ont des
   * valeurs par défaut gérées par les modèles. Cas explicite v3 → v4 :
   * suppression de `task.jiraKey`, replié dans le nom pour ne rien perdre.
   * v4 → v5 : ajout du réglage `bgDots` (fond réactif) — purement additif,
   * valeur par défaut fournie par `Settings`, aucune transformation ici.
   * v5 → v6 : ajout de `task.link` (lien externe, ex. URL Jira) — purement
   * additif, valeur par défaut fournie par `Task`, aucune transformation ici.
   * v6 → v7 : ajout du réglage `roundedDay` (vue arrondie de la journée) et de
   * nouveaux pas d'arrondi (30m, 1h) — purement additif, valeurs par défaut
   * fournies par `Settings`, aucune transformation ici.
   * v7 → v8 : ajout du réglage `eyeBreak` (rappel « repos des yeux ») — purement
   * additif, valeurs par défaut fournies par `Settings`, aucune transformation ici.
   * v8 → v9 : ajout de `eyeBreak.restSeconds` (durée du repos) — purement additif,
   * valeur par défaut (20 s, la règle) fournie par `Settings`, rien à faire ici.
   * v9 → v10 : ajout de `eyeBreak.sound`/`eyeBreak.volume` (bip du repos) et de
   * `reminders` (pauses planifiées : déjeuner, fin de journée, rappels posés à
   * la main) — purement additif, valeurs par défaut fournies par `Settings`,
   * aucune transformation ici.
   * v10 → v11 : ajout du réglage `lunch` (la pause déjeuner de la base est
   * désormais un état, « ou non »). Rien ici non plus : un stockage v10 encodait
   * « pas de pause » en collant `lunchStart` et `lunchEnd`, et c'est le
   * constructeur de `Settings` qui le relit — local au champ, donc idempotent,
   * et couvre aussi un JSON importé.
   * v11 → v12 : ajout de `settings.segments` (seuil de fusion des micro-pauses,
   * jusque-là une constante, et seuil des segments courts) — purement additif,
   * valeurs par défaut fournies par `Settings`, aucune transformation ici.
   */
  #migrate(raw) {
    if (!raw) return {};
    if (Array.isArray(raw.tasks)) {
      for (const t of raw.tasks) {
        if (!t || !t.jiraKey) continue;
        const key = String(t.jiraKey).trim();
        if (key) {
          const name = (t.name || "").trim();
          if (!name) t.name = key;
          else if (!name.includes(key)) t.name = `${name} ${key}`;
        }
        delete t.jiraKey;
      }
    }
    return raw;
  }

  toJSON() {
    return {
      version: this.version,
      settings: this.settings.toJSON(),
      tasks: this.tasks.map((t) => t.toJSON()),
      segments: this.segments.map((s) => s.toJSON()),
      meta: { ...this.meta },
    };
  }

  /** Persiste sans notifier (ex. frappe dans le wordmark). */
  persist() {
    this.persistence.save(this.toJSON());
  }

  #commit() {
    this.rev += 1;
    this.persist();
    this.emit("change", this);
  }

  /* ----------------- requêtes ----------------- */
  activeSegment() {
    return this.segments.find((s) => s.isRunning) ?? null;
  }

  activeTask() {
    const seg = this.activeSegment();
    return seg ? this.taskById(seg.taskId) : null;
  }

  taskById(id) {
    return this.tasks.find((t) => t.id === id) ?? null;
  }

  /** Dernière tâche en cours (ni archivée ni terminée) réellement utilisée. */
  lastUsedTask() {
    for (let i = this.segments.length - 1; i >= 0; i--) {
      const t = this.taskById(this.segments[i].taskId);
      if (t && !t.archived && !t.done) return t;
    }
    return this.tasks.find((t) => !t.archived && !t.done) ?? null;
  }

  /** Tâches en cours (résumables) : ni archivées ni terminées. */
  openTasks() {
    return this.tasks.filter((t) => !t.archived && !t.done);
  }

  /** Segments chevauchant la journée [00:00, lendemain 00:00). */
  segmentsForDay(day) {
    const ds = startOfDay(day).getTime();
    const de = ds + DAY_MS;
    return this.segments.filter((s) => s.startMs() < de && s.endMs() > ds);
  }

  /* ----------------- primitives privées ----------------- */
  #uid(prefix) {
    this.#idSeq += 1;
    return prefix + Date.now().toString(36) + this.#idSeq.toString(36);
  }

  /**
   * Couleur suivante pour une tâche, **dans la famille de son type**.
   * On prend la première teinte encore libre de la catégorie (variation maximale
   * entre tâches d'un même type) ; une fois la palette épuisée, on cycle.
   */
  #nextColor(type) {
    const pal = PALETTES[type] ?? PALETTE;
    const sameType = this.tasks.filter((t) => t.type === type);
    const used = new Set(sameType.map((t) => t.color));
    return pal.find((c) => !used.has(c)) ?? pal[sameType.length % pal.length];
  }

  #createTask({ name, type, link = "" }) {
    const task = new Task({ id: this.#uid("t_"), name, type, link, color: this.#nextColor(type) });
    this.tasks.push(task);
    return task;
  }

  #startSegment(taskId, at = new Date()) {
    this.segments.push(new Segment({ id: this.#uid("s_"), taskId, start: toLocalISO(at) }));
  }

  /**
   * Reprend le segment juste mis en pause s'il s'agit de la même tâche et que
   * l'écart est inférieur au seuil réglé (micro-pause) ; sinon démarre un nouveau
   * segment. Évite de fragmenter la base / la timeline pour des pauses brèves.
   * À n'appeler qu'après #stopActive() (aucun segment ne doit être en cours).
   *
   * Seuil à 0 = jamais de fusion : l'écart est strictement positif dès qu'une
   * pause a eu lieu, la comparaison échoue d'elle-même.
   */
  #startOrResume(taskId, at = new Date()) {
    // Segment terminé le plus récemment, toutes tâches confondues : c'est la
    // dernière activité. On ne fusionne que si c'est bien la tâche reprise.
    let last = null;
    for (const s of this.segments) {
      if (s.isRunning) continue;
      if (!last || s.endMs() > last.endMs()) last = s;
    }
    if (last && last.taskId === taskId && at.getTime() - last.endMs() <= this.settings.mergeGapMs()) {
      last.end = null; // rouvre le segment : la micro-pause est absorbée
      return;
    }
    this.#startSegment(taskId, at);
  }

  /**
   * Arrête le segment en cours. S'il n'a pas atteint la durée minimale réglée
   * (`settings.segments.minMin`), il est **supprimé** plutôt que fermé : un
   * double-clic sur Play, ou une reprise sur la mauvaise tâche corrigée dans la
   * foulée, ne laisse pas de segment de douze secondes.
   *
   * Seul le chrono passe ici (Play, Pause, Reprendre, Terminer, archivage) —
   * une saisie explicite (modale, glisser) n'est jamais jetée. Corollaire pour
   * `#startOrResume` : un segment jeté n'est plus « le dernier », c'est celui
   * d'avant qui peut être rouvert si SON écart passe le seuil de fusion.
   */
  #stopActive(at = new Date()) {
    const seg = this.activeSegment();
    if (!seg) return;
    if (at.getTime() - seg.startMs() < this.settings.minSegmentMs()) {
      this.segments = this.segments.filter((s) => s !== seg);
      return;
    }
    seg.end = toLocalISO(at);
  }

  /* ----------------- commandes (3 boutons) ----------------- */

  /** Play/Stop. Renvoie "stopped" | "started" | "needsTask". */
  toggle() {
    if (this.activeSegment()) {
      this.#stopActive();
      this.#commit();
      return "stopped";
    }
    const last = this.lastUsedTask();
    if (last) {
      this.#startOrResume(last.id);
      this.#commit();
      return "started";
    }
    return "needsTask";
  }

  /** Nouvelle tâche : arrête l'active, crée, démarre. */
  startNew({ name, type, link = "" }) {
    this.#stopActive();
    const task = this.#createTask({ name, type, link });
    this.#startSegment(task.id);
    this.#commit();
    return task;
  }

  /**
   * Pause : arrête le chrono de la tâche active sans la terminer
   * (elle reste « en cours » et résumable).
   */
  pause() {
    this.#stopActive();
    this.#commit();
  }

  /** Reprise : met en pause l'active, rouvre si besoin, relance un segment. */
  resume(taskId) {
    this.#stopActive();
    const t = this.taskById(taskId);
    if (t) t.done = false; // reprendre une tâche la rouvre
    this.#startOrResume(taskId);
    this.#commit();
  }

  /** Terminer : met en pause si active, puis marque la tâche comme terminée. */
  closeTask(taskId) {
    const seg = this.activeSegment();
    if (seg && seg.taskId === taskId) this.#stopActive();
    const t = this.taskById(taskId);
    if (t) t.done = true;
    this.#commit();
  }

  /** Rouvrir une tâche terminée (la remet « en cours »). */
  reopenTask(taskId) {
    const t = this.taskById(taskId);
    if (!t) return;
    t.done = false;
    this.#commit();
  }

  /* ----------------- commandes tâches ----------------- */
  updateTask(id, patch) {
    const t = this.taskById(id);
    if (!t) return;
    Object.assign(t, patch);
    this.#commit();
  }

  toggleArchive(id) {
    const t = this.taskById(id);
    if (!t) return;
    t.archived = !t.archived;
    const seg = this.activeSegment();
    if (t.archived && seg && seg.taskId === id) this.#stopActive();
    this.#commit();
  }

  deleteTask(id) {
    this.segments = this.segments.filter((s) => s.taskId !== id);
    this.tasks = this.tasks.filter((t) => t.id !== id);
    this.#commit();
  }

  segmentCountFor(taskId) {
    return this.segments.filter((s) => s.taskId === taskId).length;
  }

  /* ----------------- commandes segments ----------------- */
  addSegment({ taskId, start, end = null, raw = false }) {
    this.segments.push(new Segment({
      id: this.#uid("s_"),
      taskId,
      start: toLocalISO(start),
      end: end ? toLocalISO(end) : null,
      raw,
    }));
    this.#commit();
  }

  /** Met à jour un segment ; `start`/`end` attendus en ISO. Garantit fin ≥ début. */
  updateSegment(id, patch) {
    const seg = this.segments.find((s) => s.id === id);
    if (!seg) return;
    if ("taskId" in patch) seg.taskId = patch.taskId;
    if ("raw" in patch) seg.raw = patch.raw;
    if ("start" in patch) seg.start = patch.start;
    if ("end" in patch) seg.end = patch.end;
    if (seg.end && new Date(seg.end) < new Date(seg.start)) {
      const fixed = new Date(seg.end); // chrono de nuit : on décale la fin au lendemain
      fixed.setDate(fixed.getDate() + 1);
      seg.end = toLocalISO(fixed);
    }
    this.#commit();
  }

  deleteSegment(id) {
    this.segments = this.segments.filter((s) => s.id !== id);
    this.#commit();
  }

  /** Les segments triés par début — l'ordre de la timeline. */
  #sortedSegments() {
    return [...this.segments].sort((a, b) => a.startMs() - b.startMs());
  }

  /**
   * Voisins d'un segment sur la timeline, toutes tâches confondues :
   * `{ prev, next }` (`null` si aucun). Sert à la modale pour proposer la
   * fusion — c'est `canMerge` qui dit ensuite si elle est possible.
   */
  neighbours(id) {
    const sorted = this.#sortedSegments();
    const i = sorted.findIndex((s) => s.id === id);
    if (i < 0) return { prev: null, next: null };
    return { prev: sorted[i - 1] ?? null, next: sorted[i + 1] ?? null };
  }

  /**
   * La fusion de deux segments est-elle possible ? `null` si oui, sinon une
   * **raison** (comme `addBreak`) : `"missing"`, `"task"` (pas la même tâche —
   * fusionner deux tâches réassignerait du temps en silence, c'est le rôle du
   * select de la modale), `"blocked"` (un troisième segment s'intercale, ou le
   * premier tourne encore). L'ordre des identifiants est indifférent, et l'écart
   * entre les deux est absorbé : c'est le sens même de « fusionner », et
   * l'équivalent du « Prolonger » du popover de remplissage.
   */
  canMerge(idA, idB) {
    const a0 = this.segments.find((s) => s.id === idA);
    const b0 = this.segments.find((s) => s.id === idB);
    if (!a0 || !b0 || a0 === b0) return "missing";
    if (a0.taskId !== b0.taskId) return "task";
    const [a, b] = a0.startMs() <= b0.startMs() ? [a0, b0] : [b0, a0];
    if (a.isRunning) return "blocked";
    const lo = a.startMs(), hi = b.endMs();
    const between = this.segments.some((s) => s !== a && s !== b && s.startMs() < hi && s.endMs() > lo);
    return between ? "blocked" : null;
  }

  /**
   * Fusionne deux segments consécutifs de la même tâche : le premier garde son
   * début et son `raw`, prend la fin du second (donc « en cours » si le second
   * tourne), le second disparaît. Renvoie `"merged"` ou la raison de `canMerge`.
   */
  mergeSegments(idA, idB) {
    const why = this.canMerge(idA, idB);
    if (why) return why;
    const a0 = this.segments.find((s) => s.id === idA);
    const b0 = this.segments.find((s) => s.id === idB);
    const [a, b] = a0.startMs() <= b0.startMs() ? [a0, b0] : [b0, a0];
    a.end = b.end; // null si b court : le résultat court
    this.segments = this.segments.filter((s) => s !== b);
    this.#commit();
    return "merged";
  }

  /**
   * Coupe un segment en deux à l'instant `atMs` (strictement à l'intérieur) :
   * l'original garde `[début, at]`, le nouveau prend `[at, fin]` avec la même
   * tâche et le même `raw` — et c'est la moitié droite qui tourne si l'original
   * tournait. Renvoie l'identifiant du nouveau, ou `"missing"` / `"outside"`.
   */
  splitSegment(id, atMs) {
    const seg = this.segments.find((s) => s.id === id);
    if (!seg) return "missing";
    const at = Number(atMs);
    const end = seg.isRunning ? Date.now() : seg.endMs();
    if (!Number.isFinite(at) || at <= seg.startMs() || at >= end) return "outside";
    const right = new Segment({
      id: this.#uid("s_"), taskId: seg.taskId, raw: seg.raw,
      start: toLocalISO(new Date(at)), end: seg.end,
    });
    seg.end = toLocalISO(new Date(at));
    this.segments.splice(this.segments.indexOf(seg) + 1, 0, right);
    this.#commit();
    return right.id;
  }

  /* ----------------- réglages & global ----------------- */
  updateSettings(mutator) {
    mutator(this.settings);
    this.#commit();
  }

  setAppName(name) {
    this.settings.appName = name || "Stint";
    this.persist(); // pas de re-rendu pendant la frappe
  }

  markExported() {
    this.meta.lastExport = new Date().toISOString();
    this.#commit();
  }

  replaceAll(raw) {
    this.hydrate(raw);
    this.#commit();
  }

  reset() {
    this.version = SCHEMA_VERSION;
    this.settings = new Settings();
    this.tasks = [];
    this.segments = [];
    this.meta = { lastExport: null };
    this.#commit();
  }

  /** Vide tâches et segments en conservant les réglages et le méta. */
  clearEntries() {
    this.tasks = [];
    this.segments = [];
    this.#commit();
  }

  /** Supprime les segments terminés avant (maintenant − N jours). Renvoie le nb retiré. */
  purgeSegmentsOlderThan(days) {
    const cutoff = Date.now() - days * DAY_MS;
    const before = this.segments.length;
    this.segments = this.segments.filter((s) => s.isRunning || s.endMs() >= cutoff);
    const removed = before - this.segments.length;
    if (removed) this.#commit();
    return removed;
  }
}
