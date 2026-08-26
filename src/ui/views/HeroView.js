import { el, escapeHtml } from "../../utils/dom.js";
import { fmtClock } from "../../utils/datetime.js";
import { dotIcon } from "../icons.js";

/** Décompte court : mm:ss sous l'heure, H:mm:ss au-delà. Le repos des yeux se
 *  compte en minutes, pas en heures — `Formatter.clock` (H:mm) perdrait les
 *  secondes, et c'est précisément ce qu'on regarde dans la dernière minute. */
function mmss(ms) {
  const t = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const two = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

/** Barre de contrôle : carte de tâche active + 4 boutons (Play/Pause, Nouvelle, Reprise, Terminer). */
export class HeroView {
  #playMode = null; // évite de ré-injecter (et ré-animer) le glyphe à chaque rendu
  #liveTaskId = null; // tâche dont le total vif est mémoïsé (cf. tick)
  #liveBaseMs = 0;    // somme des segments TERMINÉS de cette tâche, rafraîchie à chaque render (= chaque "change")
  #shownTaskId = null; // tâche affichée (en cours OU en pause) → clic sur la pastille = édition
  #eyeState = null;    // dernier état du bandeau repos : off | idle | wait | rest

  constructor(app) {
    this.app = app;
    this.playBtn = el("btnPlay");
    this.playGlyph = el("playGlyph");
    this.playLabel = el("playLabel");
    this.endBtn = el("btnEnd");
    this.card = el("activeCard");
    this.label = el("activeLabel");
    this.dot = el("activeDot");
    this.name = el("activeName");
    this.extra = el("activeExtra");
    this.timer = el("activeTimer");
    // Bandeau « repos des yeux » (cf. EyeBreak) : rendu à chaque battement.
    this.eye = el("eyeStrip");
    this.eyeLabel = el("eyeLabel");
    this.eyeSince = el("eyeSince");
    this.eyeCount = el("eyeCount");
    this.eyeFill = el("eyeFill");
    this.eyeSweep = el("eyeSweep");
    this.#eyeState = null;
  }

  bind() {
    this.playBtn.addEventListener("click", () => this.app.togglePlayStop());
    this.endBtn.addEventListener("click", () => this.app.finishActive());
    el("btnNew").addEventListener("click", () => this.app.openNewTask());
    el("btnResume").addEventListener("click", () => this.app.openResume());
    // Clic sur la pastille de couleur = éditer la tâche affichée (en cours / en pause).
    this.dot.addEventListener("click", () => {
      if (this.#shownTaskId) this.app.openEditTask(this.#shownTaskId);
    });
    // Un seul bouton, deux sens selon l'état : on PREND le repos, ou on l'achève
    // s'il court déjà. C'est `EyeBreak.toggleRest()` qui tranche — la vue ne
    // décide de rien, elle rend.
    this.eye.addEventListener("click", () => {
      this.app.eyeBreak.toggleRest();
      this.#renderEye();
    });
  }

  render() {
    const seg = this.app.store.activeSegment();
    const activeTask = seg ? this.app.store.activeTask() : null;
    const running = !!(seg && activeTask);
    // En cours → tâche active ; sinon la tâche que « Play » relancerait (en pause).
    const task = running ? activeTask : this.app.store.lastUsedTask();
    const paused = !running && !!task;

    // glyphe Play/Pause : (re)dessiné uniquement quand l'état change → l'anim joue à bon escient
    const mode = running ? "pause" : "play";
    if (mode !== this.#playMode) {
      this.playGlyph.innerHTML = dotIcon(mode, { size: 26 });
      this.#playMode = mode;
    }
    this.playBtn.classList.toggle("is-running", running);
    this.playBtn.classList.toggle("is-stopped", !running);
    this.playLabel.textContent = running ? "Pause" : "Play";
    this.endBtn.disabled = !(running || paused); // Terminer agit aussi sur la tâche en pause

    this.#shownTaskId = task ? task.id : null;
    // `is-running` allume le filet minium, le battement de la pastille et le
    // chrono rouge : tout l'état « ça tourne » tient dans une classe.
    this.card.classList.toggle("is-running", running);
    this.card.classList.toggle("paused", paused);
    this.dot.classList.toggle("editable", !!task);

    if (task) {
      this.dot.style.background = task.color;
      this.dot.style.boxShadow = running ? `0 0 0 5px color-mix(in srgb, ${task.color} 16%, transparent)` : "none";
      this.label.textContent = running ? "Tâche active" : "En pause";
      this.name.classList.remove("idle");
      this.name.textContent = task.displayName;
      this.extra.innerHTML =
        `<span class="type-badge type-${task.type}">${escapeHtml(task.type)}</span>` +
        (running ? `<span class="active-started">démarré à ${fmtClock(new Date(seg.startMs()))}</span>` : "");
      this.timer.classList.remove("idle");
      if (running) {
        // Mémoïse le total des segments terminés ; le segment en cours est ajouté
        // à chaque tick (cf. tick) → pas de balayage complet/seconde.
        this.#liveTaskId = task.id;
        this.#liveBaseMs = this.#completedMsFor(task.id);
      } else {
        // En pause : total figé (aucun tick ne l'écrase, pas de segment actif).
        this.#liveTaskId = null;
        this.timer.textContent = this.app.formatter.hms(this.app.calc.taskTotalMs(task.id));
      }
    } else {
      this.label.textContent = "Tâche active";
      this.dot.style.background = "var(--text-faint)";
      this.dot.style.boxShadow = "none";
      this.name.classList.add("idle");
      this.name.textContent = "Aucune tâche en cours";
      this.extra.innerHTML = "";
      this.timer.classList.add("idle");
      this.timer.textContent = "0:00:00";
      this.#liveTaskId = null;
    }
    this.tick();
  }

  /** Un battement (1 s) : le chrono vif et le bandeau du repos des yeux. */
  tick() {
    this.#tickTimer();
    this.#renderEye();
  }

  /** N'actualise que le chrono de la tâche réellement en cours (laisse figé
   *  l'affichage en pause / au repos). */
  #tickTimer() {
    const seg = this.app.store.activeSegment();
    if (!seg || seg.taskId !== this.#liveTaskId) return;
    // Segments terminés mémoïsés (au dernier « change ») + part vive du segment en
    // cours : strictement égal à calc.taskTotalMs(seg.taskId), sans reparcourir
    // tout l'historique chaque seconde.
    this.timer.textContent = this.app.formatter.hms(this.#liveBaseMs + this.app.calc.segmentMs(seg));
  }

  /**
   * Le bandeau « repos des yeux ». Quatre états, dont un seul fait disparaître
   * la bande :
   *   - `off`  — le rappel est coupé dans les réglages : rien du tout. On ne
   *     réserve pas une bande à l'écran pour une fonction qu'on n'a pas activée ;
   *   - `idle` — le rappel est actif mais aucun chrono ne tourne (pause, ou
   *     journée pas encore commencée) : la bande RESTE, grisée et inerte. Elle
   *     disparaissait à la pause, et toute la carte sautait — ce qui est déjà à
   *     l'écran ne bouge pas ;
   *   - `wait` — temps d'écran continu à gauche, temps restant à droite ;
   *   - `rest` — le décompte, en tampon, avec le balayage.
   */
  #renderEye() {
    const eb = this.app.eyeBreak;
    const enabled = this.app.store.settings.eyeBreak.enabled;
    const state = !enabled ? "off" : (eb.resting ? "rest" : (eb.armed ? "wait" : "idle"));

    if (state === "off") {
      if (!this.eye.hidden) { this.eye.hidden = true; this.#eyeState = "off"; }
      return;
    }
    this.eye.hidden = false;

    // Libellé, titre et classes ne bougent qu'au CHANGEMENT d'état : les
    // réécrire chaque seconde ferait bégayer `aria-live`.
    if (state !== this.#eyeState) {
      this.#eyeState = state;
      this.eye.classList.toggle("resting", state === "rest");
      this.eye.classList.toggle("idle", state === "idle");
      this.eye.disabled = state === "idle";   // rien à prendre tant que rien ne tourne
      // Bascule d'état : on repose le balayage à zéro sans transition, sinon on
      // le verrait reculer de 100 % à 0 % pendant une seconde au début du repos.
      this.eyeSweep.style.transition = "none";
      this.eyeSweep.style.width = "0%";
      void this.eyeSweep.offsetWidth;   // force le recalcul avant de rendre la transition
      this.eyeSweep.style.transition = "";
      this.eyeLabel.textContent = state === "rest" ? "Regardez au loin, 6 mètres" : "Repos des yeux";
      this.eye.title = { rest: "Terminer le repos", wait: "Prendre le repos maintenant",
                         idle: "Le rappel reprendra au prochain chrono" }[state];
    }

    if (state === "idle") {
      this.eyeSince.textContent = "· chrono à l'arrêt";
      this.eyeCount.textContent = "—";
      this.eyeFill.style.width = "0%";
      this.eyeSweep.style.width = "0%";
      return;
    }

    const frac = eb.fraction();
    if (state === "rest") {
      this.eyeSince.textContent = "";
      this.eyeCount.textContent = String(Math.ceil(eb.restRemainingMs() / 1000));
    } else {
      this.eyeSince.textContent = `· ${this.app.formatter.clock(eb.screenMs() / 60000)} d'écran continu`;
      this.eyeCount.textContent = `dans ${mmss(eb.remainingMs())}`;
    }
    this.eyeFill.style.width = (frac * 100).toFixed(1) + "%";
    // Le balayage recouvre la part ÉCOULÉE du repos. Il avance d'un pas par
    // seconde, avec une transition d'une seconde exactement : les pas se
    // raccordent bout à bout, donc le mouvement est continu — et sous
    // `prefers-reduced-motion`, la transition tombe et il redevient un pas par
    // seconde, ce qui reste une jauge juste. Aucune image-clé, rien à
    // synchroniser avec la durée réglée.
    this.eyeSweep.style.width = state === "rest" ? ((1 - frac) * 100).toFixed(1) + "%" : "0%";
  }

  /** Somme des segments TERMINÉS d'une tâche (le segment en cours est ajouté au tick). */
  #completedMsFor(taskId) {
    const { calc, store } = this.app;
    let ms = 0;
    for (const s of store.segments) {
      if (s.taskId === taskId && !s.isRunning) ms += calc.segmentMs(s);
    }
    return ms;
  }
}
