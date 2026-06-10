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
import { AllTasksView } from "./views/AllTasksView.js";
import { HeatmapView } from "./views/HeatmapView.js";
import { SettingsView } from "./views/SettingsView.js";
import { StorageView } from "./views/StorageView.js";
import { ToolsView } from "./views/ToolsView.js";

import { NewTaskModal } from "./modals/NewTaskModal.js";
import { ResumeModal } from "./modals/ResumeModal.js";
import { EditTaskModal } from "./modals/EditTaskModal.js";
import { Toast } from "./components/Toast.js";
import { DayGlyphAnimator } from "./DayGlyphAnimator.js";

import { el, qsa } from "../utils/dom.js";
import { renderStaticIcons } from "./icons.js";
import { copyText } from "../utils/clipboard.js";
import { startOfDay, addDays, sameDay, atTime, parseDateInput } from "../utils/datetime.js";

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
    this.dayGlyphAnimator = new DayGlyphAnimator();
    this.viewDay = startOfDay(new Date());
    this.screen = "app"; // app | settings | guide | tools
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
      new HeatmapView(this),
      new AllTasksView(this),
      new SettingsView(this),
      new StorageView(this),
      new ToolsView(this),
    ];
  }

  async start() {
    renderStaticIcons(); // injecte les icônes statiques du HTML
    this.render();        // rendu instantané depuis le miroir local (non interactif)

    await this.store.ready(); // charge l'historique complet (IndexedDB) + migration

    this.views.forEach((v) => v.bind?.());
    Object.values(this.modals).forEach((m) => m.bind());
    this.#bindIO();
    this.#bindNav();
    this.#bindKeyboard();
    this.#bindLifecycle();
    this.store.on("change", () => this.render());
    this.timer.on("tick", () => this.#onTick());
    this.render();        // re-rendu avec l'historique complet
    this.timer.start();
    this.dayGlyphAnimator.start(); // anime le glyphe « moment de la journée »
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

  /* ----------------- écrans (app / réglages / guide / outils) ----------------- */
  showScreen(name) {
    this.screen = name;
    el("appScreen").hidden = name !== "app";
    el("settingsScreen").hidden = name !== "settings";
    el("guideScreen").hidden = name !== "guide";
    el("toolsScreen").hidden = name !== "tools";
    el("settingsBtn").classList.toggle("active", name === "settings");
    el("helpBtn").classList.toggle("active", name === "guide");
    el("toolsBtn").classList.toggle("active", name === "tools");
    window.scrollTo({ top: 0 });
  }
  backToApp() { this.showScreen("app"); }
  toggleSettings() { this.showScreen(this.screen === "settings" ? "app" : "settings"); }
  toggleGuide() { this.showScreen(this.screen === "guide" ? "app" : "guide"); }
  toggleTools() { this.showScreen(this.screen === "tools" ? "app" : "tools"); }

  /** Termine (ferme) la tâche active. */
  finishActive() {
    const t = this.store.activeTask();
    if (t) this.store.closeTask(t.id);
  }

  /* ----------------- thème ----------------- */
  setTheme(value) {
    this.store.updateSettings((s) => { s.theme = value; }); // persiste + re-render (ThemeView applique)
  }

  /* ----------------- navigation jour ----------------- */
  setViewDay(d) { this.viewDay = startOfDay(d); this.render(); }
  shiftDay(n) { this.setViewDay(addDays(this.viewDay, n)); }
  goToday() { this.setViewDay(new Date()); }

  /** Depuis « Tâches » : ouvre un jour ("YYYY-MM-DD") dans l'onglet Segments. */
  goToDaySegments(dayKey) {
    this.setViewDay(parseDateInput(dayKey));
    this.tabs.select("segments");
  }

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
  clearEntries() {
    if (!confirm("Vider toutes les tâches et tous les segments ? Les réglages sont conservés.")) return;
    this.store.clearEntries();
    this.viewDay = startOfDay(new Date());
    this.toast.show("Tâches et segments vidés (réglages conservés)");
  }
  purgeOld(days) {
    if (!confirm(`Supprimer les segments terminés il y a plus de ${days} jours ?`)) return;
    const n = this.store.purgeSegmentsOlderThan(days);
    this.toast.show(n ? `${n} segment(s) supprimé(s)` : "Aucun segment assez ancien");
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

  #bindNav() {
    el("settingsBtn").addEventListener("click", () => this.toggleSettings());
    el("helpBtn").addEventListener("click", () => this.toggleGuide());
    el("toolsBtn").addEventListener("click", () => this.toggleTools());
    el("settingsBack").addEventListener("click", () => this.backToApp());
    el("guideBack").addEventListener("click", () => this.backToApp());
    el("toolsBack").addEventListener("click", () => this.backToApp());
  }

  #bindKeyboard() {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const open = qsa(".modal-backdrop.open");
        if (open.length) open.forEach((m) => m.classList.remove("open"));
        else if (this.screen !== "app") this.backToApp();
        return;
      }
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea" || e.target.isContentEditable) return;
      if (this.screen !== "app") return; // raccourcis d'action désactivés hors de l'écran principal
      if (e.code === "Space") { e.preventDefault(); this.togglePlayStop(); }
      else if (e.key === "n" || e.key === "N") { e.preventDefault(); this.openNewTask(); }
      else if (e.key === "r" || e.key === "R") { e.preventDefault(); this.openResume(); }
      else if (e.key === "t" || e.key === "T") { e.preventDefault(); this.finishActive(); }
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
