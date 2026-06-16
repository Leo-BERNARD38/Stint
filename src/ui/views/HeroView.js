import { el, escapeHtml } from "../../utils/dom.js";
import { fmtClock } from "../../utils/datetime.js";
import { dotIcon } from "../icons.js";

/** Barre de contrôle : carte de tâche active + 4 boutons (Play/Pause, Nouvelle, Reprise, Terminer). */
export class HeroView {
  #playMode = null; // évite de ré-injecter (et ré-animer) le glyphe à chaque rendu

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
    } else {
      this.dot.style.background = "var(--text-faint)";
      this.dot.style.boxShadow = "none";
      this.name.classList.add("idle");
      this.name.textContent = "Aucune tâche en cours";
      this.extra.innerHTML = "";
      this.timer.classList.add("idle");
      this.timer.textContent = "0:00:00";
    }
    this.tick();
  }

  /** Mise à jour du timer live (appelée à chaque tick). */
  tick() {
    const seg = this.app.store.activeSegment();
    if (!seg) return;
    // Vrai temps de la tâche en cours : somme de tous ses segments, en
    // respectant le statut brut/net de chacun (pas seulement le segment actif).
    this.timer.textContent = this.app.formatter.hms(this.app.calc.taskTotalMs(seg.taskId));
  }
}
