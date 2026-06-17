import { el, escapeHtml } from "../../utils/dom.js";
import { fmtClock } from "../../utils/datetime.js";
import { dotIcon } from "../icons.js";

/** Barre de contrôle : carte de tâche active + 4 boutons (Play/Pause, Nouvelle, Reprise, Terminer). */
export class HeroView {
  #playMode = null; // évite de ré-injecter (et ré-animer) le glyphe à chaque rendu
  #liveTaskId = null; // tâche dont le total vif est mémoïsé (cf. tick)
  #liveBaseMs = 0;    // somme des segments TERMINÉS de cette tâche, rafraîchie à chaque render (= chaque "change")

  constructor(app) {
    this.app = app;
    this.playBtn = el("btnPlay");
    this.playGlyph = el("playGlyph");
    this.playLabel = el("playLabel");
    this.endBtn = el("btnEnd");
    this.dot = el("activeDot");
    this.name = el("activeName");
    this.extra = el("activeExtra");
    this.timer = el("activeTimer");
  }

  bind() {
    this.playBtn.addEventListener("click", () => this.app.togglePlayStop());
    this.endBtn.addEventListener("click", () => this.app.finishActive());
    el("btnNew").addEventListener("click", () => this.app.openNewTask());
    el("btnResume").addEventListener("click", () => this.app.openResume());
  }

  render() {
    const seg = this.app.store.activeSegment();
    const task = this.app.store.activeTask();
    const running = !!(seg && task);

    // glyphe Play/Pause : (re)dessiné uniquement quand l'état change → l'anim joue à bon escient
    const mode = running ? "pause" : "play";
    if (mode !== this.#playMode) {
      this.playGlyph.innerHTML = dotIcon(mode, { size: 26 });
      this.#playMode = mode;
    }
    this.playBtn.classList.toggle("is-running", running);
    this.playBtn.classList.toggle("is-stopped", !running);
    this.playLabel.textContent = running ? "Pause" : "Play";
    this.endBtn.disabled = !running;

    if (running) {
      this.dot.style.background = task.color;
      this.dot.style.boxShadow = `0 0 0 5px color-mix(in srgb, ${task.color} 16%, transparent)`;
      this.name.classList.remove("idle");
      this.name.innerHTML =
        escapeHtml(task.displayName) + '<span class="live-dot"></span>';
      this.extra.innerHTML =
        `<span class="type-badge type-${task.type}">${escapeHtml(task.type)}</span>` +
        `<span class="active-started">démarré à ${fmtClock(new Date(seg.startMs()))}</span>`;
      this.timer.classList.remove("idle");
      // Mémoïse le total des segments terminés de la tâche active ; le segment en
      // cours est ajouté à chaque tick (cf. tick) → pas de balayage complet/seconde.
      this.#liveTaskId = task.id;
      this.#liveBaseMs = this.#completedMsFor(task.id);
    } else {
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

  /** Mise à jour du timer live (appelée à chaque tick). */
  tick() {
    const seg = this.app.store.activeSegment();
    if (!seg) return;
    const { calc, formatter } = this.app;
    // Vrai temps de la tâche en cours : segments terminés (mémoïsés au dernier
    // « change ») + part vive du segment en cours, recalculée ici. Strictement
    // égal à calc.taskTotalMs(seg.taskId) au même instant, sans reparcourir tout
    // l'historique chaque seconde. Repli défensif si le cache n'est pas amorcé.
    const total = seg.taskId === this.#liveTaskId
      ? this.#liveBaseMs + calc.segmentMs(seg)
      : calc.taskTotalMs(seg.taskId);
    this.timer.textContent = formatter.hms(total);
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
