import { EventEmitter } from "../core/EventEmitter.js";
import { SCHEMA_VERSION, PALETTE, DAY_MS } from "../core/constants.js";
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
  constructor(persistence) {
    super();
    this.persistence = persistence;
    this.version = SCHEMA_VERSION;
    this.settings = new Settings();
    this.tasks = [];
    this.segments = [];
    this.meta = { lastExport: null };
    this.#idSeq = 0;
    this.load();
  }

  #idSeq;

  /* ----------------- (dé)sérialisation ----------------- */
  load() {
    const raw = this.persistence.load();
    if (raw) this.hydrate(raw);
  }

  hydrate(raw) {
    this.version = raw.version ?? SCHEMA_VERSION;
    this.settings = Settings.fromJSON(raw.settings);
    this.tasks = (raw.tasks ?? []).map(Task.fromJSON);
    this.segments = (raw.segments ?? []).map(Segment.fromJSON);
    this.meta = { lastExport: null, ...(raw.meta ?? {}) };
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

  /** Dernière tâche non archivée réellement utilisée (sinon une au hasard). */
  lastUsedTask() {
    for (let i = this.segments.length - 1; i >= 0; i--) {
      const t = this.taskById(this.segments[i].taskId);
      if (t && !t.archived) return t;
    }
    return this.tasks.find((t) => !t.archived) ?? null;
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

  #nextColor() {
    const used = new Set(this.tasks.map((t) => t.color));
    return PALETTE.find((c) => !used.has(c)) ?? PALETTE[this.tasks.length % PALETTE.length];
  }

  #createTask({ name, jiraKey, type }) {
    const task = new Task({ id: this.#uid("t_"), name, jiraKey, type, color: this.#nextColor() });
    this.tasks.push(task);
    return task;
  }

  #startSegment(taskId, at = new Date()) {
    this.segments.push(new Segment({ id: this.#uid("s_"), taskId, start: toLocalISO(at) }));
  }

  #stopActive(at = new Date()) {
    const seg = this.activeSegment();
    if (seg) seg.end = toLocalISO(at);
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
      this.#startSegment(last.id);
      this.#commit();
      return "started";
    }
    return "needsTask";
  }

  stop() {
    this.#stopActive();
    this.#commit();
  }

  /** Nouvelle tâche : arrête l'active, crée, démarre. */
  startNew({ name, jiraKey, type }) {
    this.#stopActive();
    const task = this.#createTask({ name, jiraKey, type });
    this.#startSegment(task.id);
    this.#commit();
    return task;
  }

  /** Reprise : arrête l'active, relance un segment sur la tâche choisie. */
  resume(taskId) {
    this.#stopActive();
    this.#startSegment(taskId);
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
}
