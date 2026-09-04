import { Store } from "../models/Store.js";
import { Persistence } from "../services/Persistence.js";
import { TimeCalculator } from "../services/TimeCalculator.js";
import { Formatter } from "../services/Formatter.js";
import { StatsAggregator } from "../services/StatsAggregator.js";
import { DataTransfer } from "../services/DataTransfer.js";
import { Notifier } from "../services/Notifier.js";
import { Timer } from "./Timer.js";

import { HeaderView } from "./views/HeaderView.js";
import { ThemeView } from "./views/ThemeView.js";
import { HeroView } from "./views/HeroView.js";
import { DayTotalView } from "./views/DayTotalView.js";
import { TabsView } from "./views/TabsView.js";
import { DayNavView } from "./views/DayNavView.js";
import { TimelineView } from "./views/TimelineView.js";
import { TotalsView } from "./views/TotalsView.js";
import { TaskListView } from "./views/TaskListView.js";
import { SegmentTableView } from "./views/SegmentTableView.js";
import { AllTasksView } from "./views/AllTasksView.js";
import { StatsView } from "./views/StatsView.js";
import { StatsTimelineView } from "./views/StatsTimelineView.js";
import { StatsTrendView } from "./views/StatsTrendView.js";
import { StatsHeatmapView } from "./views/StatsHeatmapView.js";
import { StatsWeeksView } from "./views/StatsWeeksView.js";
import { StatsBreakdownView } from "./views/StatsBreakdownView.js";
import { SettingsView } from "./views/SettingsView.js";
import { StorageView } from "./views/StorageView.js";
import { ToolsView } from "./views/ToolsView.js";

import { NewTaskModal } from "./modals/NewTaskModal.js";
import { ResumeModal } from "./modals/ResumeModal.js";
import { EditTaskModal } from "./modals/EditTaskModal.js";
import { SegmentModal } from "./modals/SegmentModal.js";
import { Toast } from "./components/Toast.js";
import { DayGlyphAnimator } from "./DayGlyphAnimator.js";
import { BgDots } from "./BgDots.js";
import { EyeBreak } from "./EyeBreak.js";
import { Chime } from "./Chime.js";
import { Reminders } from "./Reminders.js";

import { el, qsa } from "../utils/dom.js";
import { renderStaticIcons } from "./icons.js";
import { copyText } from "../utils/clipboard.js";
import { startOfDay, addDays, sameDay, parseDateInput, toLocalISO } from "../utils/datetime.js";

/**
 * Contrôleur racine : assemble modèle (Store), services (calc, formatter),
 * vues et modales. Détient l'état d'UI (jour affiché), orchestre les flux
 * de haut niveau et relaie les évènements du Store vers le rendu.
 */
export class App {
  #ticksSinceRefresh = 0;

  constructor() {
    this.store = new Store(new Persistence());
    this.calc = new TimeCalculator(this.store);
    this.formatter = new Formatter(this.store);
    this.stats = new StatsAggregator(this.store, this.calc);
    this.timer = new Timer();
    this.dayGlyphAnimator = new DayGlyphAnimator();
    this.bgDots = new BgDots(el("bgDots")); // fond réactif au curseur (easter-egg)
    this.eyeBreak = new EyeBreak(this);     // rappel « repos des yeux » pendant le chrono
    this.viewDay = startOfDay(new Date());
    this.screen = "app"; // app | settings | guide | tools
    this.statsPeriod = "3m"; // fenêtre de l'onglet Stats (état d'UI, comme viewDay)

    this.toast = new Toast();
    // Le Notifier a besoin du toast (son dernier recours) : il vient donc après.
    this.notifier = new Notifier(this.toast);  // notifications système, repli toast
    this.chime = new Chime(this);              // bip du repos (synthèse, aucun fichier audio)
    this.reminders = new Reminders(this);      // déjeuner, fin de journée, pauses posées à la main
    this.modals = {
      newTask: new NewTaskModal(this),
      resume: new ResumeModal(this),
      editTask: new EditTaskModal(this),
      segment: new SegmentModal(this),
    };
    // Références nommées (évite toute fragilité d'index) puis liste de rendu.
    this.header = new HeaderView(this);
    this.theme = new ThemeView(this);
    this.hero = new HeroView(this);
    this.dayTotal = new DayTotalView(this);
    this.tabs = new TabsView(this);
    // Journée : survoler un segment surligne la LIGNE DE TÂCHE en dessous (et
    // réciproquement, cf. TaskListView) — le tableau des segments n'y est pas.
    this.timelineView = new TimelineView(this, {
      onSegHover: (id) => this.highlightTask(id ? (this.store.segments.find((s) => s.id === id)?.taskId ?? null) : null),
    });
    // Deuxième instance du même composant pour l'onglet Segments : édition
    // identique (glisser/remplir) + survol croisé avec la ligne du tableau.
    this.segTimelineView = new TimelineView(this, {
      timelineId: "segTimeline",
      axisId: "segTlAxis",
      onSegHover: (id) => this.highlightSegment(id),
    });
    this.views = [
      this.header,
      this.theme,
      this.hero,
      this.dayTotal,
      this.tabs,
      new DayNavView(this),
      this.timelineView,
      this.segTimelineView,
      new TotalsView(this),
      new TaskListView(this),
      new SegmentTableView(this),
      new StatsView(this),
      new StatsTrendView(this),
      new StatsHeatmapView(this),
      new StatsWeeksView(this),
      new StatsBreakdownView(this),
      new StatsTimelineView(this),
      new AllTasksView(this),
      new SettingsView(this),
      new StorageView(this),
      new ToolsView(this),
    ];
  }

  async start() {
    renderStaticIcons(); // injecte les icônes statiques du HTML
    this.render();        // rendu instantané depuis le miroir local (non interactif)
    document.body.classList.remove("booting"); // fin du squelette de chargement

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
    this.bgDots.start();           // câble le suivi du curseur (inactif tant que coupé)
    this.eyeBreak.start();         // surveille le chrono (inactif tant que le rappel est coupé)
    this.reminders.start();        // boucle propre : les rappels du jour tombent chrono à l'arrêt
  }

  /**
   * Re-rend les vues visibles. Une vue qui déclare `this.anchor` (un élément de
   * sa région) est sautée tant que cette région est masquée (`[hidden]` sur un
   * ancêtre : autre onglet, autre écran) — elle sera rendue à la bascule, via
   * `TabsView.select()` / `showScreen()`. Les vues sans `anchor` (header, thème,
   * hero) sont toujours rendues.
   */
  render() {
    this.bgDots?.setEnabled(this.store.settings.bgDots); // suit le réglage (off par défaut)
    this.eyeBreak?.sync();                               // arme/désarme le rappel « repos des yeux »
    this.views.forEach((v) => {
      if (v.anchor?.closest("[hidden]")) return;
      v.render(this.viewDay);
    });
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
    this.closeFill(); // ferme un éventuel popover de trou resté ouvert
    el("appScreen").hidden = name !== "app";
    el("settingsScreen").hidden = name !== "settings";
    el("guideScreen").hidden = name !== "guide";
    el("toolsScreen").hidden = name !== "tools";
    el("settingsBtn").classList.toggle("active", name === "settings");
    el("helpBtn").classList.toggle("active", name === "guide");
    el("toolsBtn").classList.toggle("active", name === "tools");
    window.scrollTo({ top: 0 });
    this.render(); // rend les vues de l'écran qui vient d'être révélé
  }
  backToApp() { this.showScreen("app"); }
  toggleSettings() { this.showScreen(this.screen === "settings" ? "app" : "settings"); }
  toggleGuide() { this.showScreen(this.screen === "guide" ? "app" : "guide"); }
  toggleTools() { this.showScreen(this.screen === "tools" ? "app" : "tools"); }

  /** Termine (ferme) la tâche affichée au héros : active si en cours, sinon celle en pause. */
  finishActive() {
    const t = this.store.activeTask() ?? this.store.lastUsedTask();
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

  /** Fenêtre d'analyse de l'onglet Stats (voir `StatsAggregator.STATS_PERIODS`). */
  setStatsPeriod(key) {
    if (this.statsPeriod === key) return;
    this.statsPeriod = key;
    this.render();
  }

  /** Depuis « Tâches » : ouvre un jour ("YYYY-MM-DD") dans l'onglet Segments. */
  goToDaySegments(dayKey) {
    this.setViewDay(parseDateInput(dayKey));
    this.tabs.select("segments");
  }

  /* ----------------- segments (modale + survol croisé) ----------------- */
  /** Ouvre la modale de segment (création si segId absent, sinon édition). */
  openSegmentModal(segId = null) {
    if (!segId && this.store.tasks.length === 0) { this.openNewTask(); return; }
    this.modals.segment.open(segId);
  }

  /** Survol croisé timeline ⇄ tableau (onglet Segments) : met en évidence le
   *  bloc et la ligne du même segment. `segId` nul = retire la surbrillance. */
  highlightSegment(segId) {
    if (this._hlId === segId) return;
    this._hlId = segId;
    for (const e of qsa("#segTimeline .tl-seg.hl, #segBody tr.hl")) e.classList.remove("hl");
    if (!segId) return;
    const esc = window.CSS && CSS.escape ? CSS.escape(segId) : segId;
    document.querySelector(`#segTimeline .tl-seg[data-id="${esc}"]`)?.classList.add("hl");
    document.querySelector(`#segBody tr[data-seg-row="${esc}"]`)?.classList.add("hl");
  }

  /**
   * Survol croisé de l'onglet Journée : une tâche ⇄ tous ses segments. Même
   * mécanique que `highlightSegment`, à la maille de la tâche (la ligne du
   * tableau n'existe pas ici, la ligne de tâche oui).
   */
  highlightTask(taskId) {
    if (taskId === this._hlTask) return;
    this._hlTask = taskId;
    for (const e of qsa("#timeline .tl-seg.hl, #taskList .task-row.hl")) e.classList.remove("hl");
    if (!taskId) return;
    const esc = window.CSS && CSS.escape ? CSS.escape(taskId) : taskId;
    for (const e of qsa(`#timeline .tl-seg[data-task="${esc}"]`)) e.classList.add("hl");
    document.querySelector(`#taskList .task-row[data-task="${esc}"]`)?.classList.add("hl");
  }

  /* ----------------- timeline : redimensionnement & remplissage des trous ----------------- */
  /** Commit d'un redimensionnement par glisser : met à jour le bord déplacé. */
  resizeSegment(segId, side, date) {
    this.store.updateSegment(segId, side === "left" ? { start: toLocalISO(date) } : { end: toLocalISO(date) });
  }
  /** Ouvre le popover de remplissage pour le trou [gs, ge] (ms). */
  openFillForGap(gs, ge) { this.timelineView.openFill(gs, ge); }
  closeFill() { this.timelineView.closeFill(); }
  extendLeftIntoGap(segId, end) {
    this.store.updateSegment(segId, { end: toLocalISO(end) });
    this.toast.show("Segment prolongé");
  }
  extendRightIntoGap(segId, start) {
    this.store.updateSegment(segId, { start: toLocalISO(start) });
    this.toast.show("Segment prolongé");
  }
  createSegmentInGap(taskId, start, end) {
    this.store.addSegment({ taskId, start, end });
    this.toast.show("Segment créé");
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
    // Premier geste de la session : les navigateurs refusent de démarrer un
    // AudioContext sans lui. On le débloque une fois pour toutes, sur n'importe
    // quel clic — pas sur l'interrupteur du son, qui pourrait n'être touché
    // qu'une seule fois, un jour, dans les réglages.
    document.addEventListener("pointerdown", () => this.chime.unlock(), { once: true });
    // Recalcul à la reprise (PC en veille, onglet rouvert) : durées dérivées des timestamps.
    window.addEventListener("focus", () => this.render());
    document.addEventListener("visibilitychange", () => { if (!document.hidden) this.render(); });
  }

  #onTick() {
    if (document.hidden) return; // onglet caché : rien de visible, on n'anime rien (cf. DayGlyphAnimator)
    if (!this.store.activeSegment()) return;
    this.hero.tick();
    this.dayTotal.tickValue(); // total du jour live (sans reconstruire le glyphe)
    // rafraîchissement léger périodique de la vue du jour courant
    if (sameDay(this.viewDay, new Date()) && (this.#ticksSinceRefresh += 1) >= 15) {
      this.#ticksSinceRefresh = 0;
      this.render();
    }
  }
}
