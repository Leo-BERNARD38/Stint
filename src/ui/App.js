import { Store } from "../models/Store.js";
import { Persistence } from "../services/Persistence.js";
import { TimeCalculator } from "../services/TimeCalculator.js";
import { Formatter } from "../services/Formatter.js";
import { DataTransfer } from "../services/DataTransfer.js";
import { Timer } from "./Timer.js";

import { HeaderView } from "./views/HeaderView.js";
import { ThemeView } from "./views/ThemeView.js";
import { HeroView } from "./views/HeroView.js";
import { TabsView } from "./views/TabsView.js";
import { DayNavView } from "./views/DayNavView.js";
import { TimelineView } from "./views/TimelineView.js";
import { TotalsView } from "./views/TotalsView.js";
import { TaskListView } from "./views/TaskListView.js";
import { SegmentTableView } from "./views/SegmentTableView.js";
import { SettingsView } from "./views/SettingsView.js";

import { NewTaskModal } from "./modals/NewTaskModal.js";
import { ResumeModal } from "./modals/ResumeModal.js";
import { EditTaskModal } from "./modals/EditTaskModal.js";
import { Toast } from "./components/Toast.js";

import { el, qsa } from "../utils/dom.js";
import { renderStaticIcons } from "./icons.js";
import { copyText } from "../utils/clipboard.js";
import { startOfDay, addDays, sameDay, atTime } from "../utils/datetime.js";

/**
 * Contrôleur racine : assemble modèle (Store), services (calc, formatter),
 * vues et modales. Détient l'état d'UI (jour affiché), orchestre les flux
 * de haut niveau et relaie les évènements du Store vers le rendu.
 */
export class App {
  constructor() {
    this.store = new Store(new Persistence());
    this.calc = new TimeCalculator(this.store);
    this.formatter = new Formatter(this.store);
    this.timer = new Timer();
    this.viewDay = startOfDay(new Date());
    this._ticksSinceRefresh = 0;

    this.toast = new Toast();
    this.modals = {
      newTask: new NewTaskModal(this),
      resume: new ResumeModal(this),
      editTask: new EditTaskModal(this),
    };
    // Références nommées (évite toute fragilité d'index) puis liste de rendu.
    this.header = new HeaderView(this);
    this.theme = new ThemeView(this);
    this.hero = new HeroView(this);
    this.tabs = new TabsView(this);
    this.views = [
      this.header,
      this.theme,
      this.hero,
      this.tabs,
      new DayNavView(this),
      new TimelineView(this),
      new TotalsView(this),
      new TaskListView(this),
      new SegmentTableView(this),
      new SettingsView(this),
    ];
  }

  start() {
    renderStaticIcons(); // injecte les icônes statiques du HTML
    this.views.forEach((v) => v.bind?.());
    Object.values(this.modals).forEach((m) => m.bind());
    this.#bindIO();
    this.#bindKeyboard();
    this.#bindLifecycle();
    this.store.on("change", () => this.render());
    this.timer.on("tick", () => this.#onTick());
    this.render();
    this.timer.start();
  }

  render() {
    this.views.forEach((v) => v.render(this.viewDay));
  }

  /* ----------------- flux 3 boutons ----------------- */
  togglePlayStop() {
    if (this.store.toggle() === "needsTask") this.openNewTask();
  }
  openNewTask() { this.modals.newTask.open(); }
  openResume() { this.modals.resume.open(); }
  openEditTask(id) { this.modals.editTask.open(id); }

  /* ----------------- thème ----------------- */
  setTheme(value) {
    this.store.updateSettings((s) => { s.theme = value; }); // persiste + re-render (ThemeView applique)
  }

  /* ----------------- navigation jour ----------------- */
  setViewDay(d) { this.viewDay = startOfDay(d); this.render(); }
  shiftDay(n) { this.setViewDay(addDays(this.viewDay, n)); }
  goToday() { this.setViewDay(new Date()); }

  /* ----------------- segments manuels ----------------- */
  addManualSegment(start, end) {
    const task = this.store.lastUsedTask();
    if (!task) { this.openNewTask(); return; }
    this.store.addSegment({ taskId: task.id, start, end });
    this.toast.show("Segment ajouté");
  }
  addManualSegmentDefault() {
    if (this.store.tasks.length === 0) { this.openNewTask(); return; }
    const base = sameDay(this.viewDay, new Date())
      ? new Date()
      : atTime(this.viewDay, this.store.settings.arrival);
    const start = new Date(base);
    start.setSeconds(0, 0);
    this.addManualSegment(start, new Date(start.getTime() + 3_600_000));
  }

  scrollToSegment(segId) {
    const input = document.querySelector(`[data-seg="${segId}"]`);
    if (!input) return;
    input.closest("tr").scrollIntoView({ behavior: "smooth", block: "center" });
    input.focus();
  }

  /* ----------------- presse-papier ----------------- */
  copy(value, btn) {
    copyText(value).then(() => {
      if (btn) {
        const old = btn.innerHTML;
        btn.classList.add("copied");
        btn.innerHTML = "✓ Copié";
        setTimeout(() => { btn.classList.remove("copied"); btn.innerHTML = old; }, 1100);
      }
      this.toast.show("Copié : " + value);
    });
  }

  /* ----------------- I/O ----------------- */
  exportJSON() {
    DataTransfer.exportJSON(this.store);
    this.store.markExported();
    this.toast.show("JSON exporté");
  }
  exportCSV() {
    DataTransfer.exportCSV(this.store, this.calc, this.formatter);
    this.toast.show("CSV exporté");
  }
  importJSON(file) {
    DataTransfer.readJSON(file)
      .then((raw) => {
        this.store.replaceAll(raw);
        this.viewDay = startOfDay(new Date());
        this.render();
        this.toast.show("Données importées");
      })
      .catch(() => this.toast.show("Import impossible : fichier invalide"));
  }
  resetAll() {
    if (!confirm("Tout effacer (tâches, segments, réglages) ? Pensez à exporter avant.")) return;
    this.store.reset();
    this.viewDay = startOfDay(new Date());
    this.toast.show("Données effacées");
  }

  /* ----------------- liaisons privées ----------------- */
  #bindIO() {
    el("exportJson").addEventListener("click", () => this.exportJSON());
    el("exportCsv").addEventListener("click", () => this.exportCSV());
    el("importJson").addEventListener("click", () => el("fileInput").click());
    el("fileInput").addEventListener("change", (e) => {
      if (e.target.files[0]) this.importJSON(e.target.files[0]);
      e.target.value = "";
    });
    el("resetAll").addEventListener("click", () => this.resetAll());
  }

  #bindKeyboard() {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        qsa(".modal-backdrop.open").forEach((m) => m.classList.remove("open"));
        return;
      }
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea" || e.target.isContentEditable) return;
      if (e.code === "Space") { e.preventDefault(); this.togglePlayStop(); }
      else if (e.key === "n" || e.key === "N") { e.preventDefault(); this.openNewTask(); }
      else if (e.key === "r" || e.key === "R") { e.preventDefault(); this.openResume(); }
    });
  }

  #bindLifecycle() {
    // Recalcul à la reprise (PC en veille, onglet rouvert) : durées dérivées des timestamps.
    window.addEventListener("focus", () => this.render());
    document.addEventListener("visibilitychange", () => { if (!document.hidden) this.render(); });
  }

  #onTick() {
    if (!this.store.activeSegment()) return;
    this.hero.tick();
    // rafraîchissement léger périodique de la vue du jour courant
    if (sameDay(this.viewDay, new Date()) && (this._ticksSinceRefresh += 1) >= 15) {
      this._ticksSinceRefresh = 0;
      this.render();
    }
  }
}
