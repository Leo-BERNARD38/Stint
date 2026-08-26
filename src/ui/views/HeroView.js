import { el, escapeHtml } from "../../utils/dom.js";
import { fmtClock } from "../../utils/datetime.js";
import { dotIcon } from "../icons.js";

/** Barre de contrôle : carte de tâche active + 4 boutons (Play/Pause, Nouvelle, Reprise, Terminer). */
export class HeroView {
  #playMode = null; // évite de ré-injecter (et ré-animer) le glyphe à chaque rendu
  #liveTaskId = null; // tâche dont le total vif est mémoïsé (cf. tick)
  #liveBaseMs = 0;    // somme des segments TERMINÉS de cette tâche, rafraîchie à chaque render (= chaque "change")
  #shownTaskId = null; // tâche affichée (en cours OU en pause) → clic sur la pastille = édition

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

  /** Mise à jour du timer live (appelée à chaque tick). N'actualise que le chrono
   *  de la tâche réellement en cours (laisse figé l'affichage en pause / au repos). */
  tick() {
    const seg = this.app.store.activeSegment();
    if (!seg || seg.taskId !== this.#liveTaskId) return;
    // Segments terminés mémoïsés (au dernier « change ») + part vive du segment en
    // cours : strictement égal à calc.taskTotalMs(seg.taskId), sans reparcourir
    // tout l'historique chaque seconde.
    this.timer.textContent = this.app.formatter.hms(this.#liveBaseMs + this.app.calc.segmentMs(seg));
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
