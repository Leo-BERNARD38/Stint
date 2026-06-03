import { el, escapeHtml } from "../../utils/dom.js";
import { icon } from "../icons.js";

/** Barre de contrôle : carte de tâche active (timer live + Terminer) + 3 boutons. */
export class HeroView {
  constructor(app) {
    this.app = app;
    this.playBtn = el("btnPlay");
    this.playGlyph = el("playGlyph");
    this.playLabel = el("playLabel");
    this.finishBtn = el("btnFinish");
    this.dot = el("activeDot");
    this.name = el("activeName");
    this.timer = el("activeTimer");
  }

  bind() {
    this.playBtn.addEventListener("click", () => this.app.togglePlayStop());
    this.finishBtn.innerHTML = icon("check", { size: 18 });
    this.finishBtn.addEventListener("click", () => {
      const t = this.app.store.activeTask();
      if (t) this.app.store.closeTask(t.id);
    });
    el("btnNew").addEventListener("click", () => this.app.openNewTask());
    el("btnResume").addEventListener("click", () => this.app.openResume());
  }

  render() {
    const seg = this.app.store.activeSegment();
    const task = this.app.store.activeTask();
    if (seg && task) {
      // En cours : le gros bouton met en PAUSE (la tâche reste en cours).
      this.playBtn.classList.add("is-running");
      this.playBtn.classList.remove("is-stopped");
      this.playGlyph.innerHTML = icon("pause", { size: 26, solid: true });
      this.playLabel.textContent = "Pause";
      this.dot.style.background = task.color;
      this.name.classList.remove("idle");
      this.name.innerHTML =
        escapeHtml(task.displayName) +
        (task.jiraKey ? ' <span class="jira">' + escapeHtml(task.jiraKey) + "</span>" : "") +
        '<span class="live-dot"></span>';
      this.timer.classList.remove("idle");
      this.finishBtn.hidden = false;
    } else {
      this.playBtn.classList.remove("is-running");
      this.playBtn.classList.add("is-stopped");
      this.playGlyph.innerHTML = icon("play", { size: 26, solid: true });
      this.playLabel.textContent = "Play";
      this.dot.style.background = "var(--text-faint)";
      this.name.classList.add("idle");
      this.name.textContent = "Aucune tâche en cours";
      this.timer.classList.add("idle");
      this.timer.textContent = "0:00:00";
      this.finishBtn.hidden = true;
    }
    this.tick();
  }

  /** Mise à jour du timer live (appelée à chaque tick). */
  tick() {
    const seg = this.app.store.activeSegment();
    if (!seg) return;
    this.timer.textContent = this.app.formatter.hms(Date.now() - seg.startMs());
  }
}
