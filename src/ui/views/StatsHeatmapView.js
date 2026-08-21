import { el, createEl } from "../../utils/dom.js";
import { WEEKDAY_LABELS } from "../../core/constants.js";
import { isoDow, cap } from "../../utils/datetime.js";
import { attachTimelineTip } from "../components/TimelineTip.js";

const LEVELS = [0.001, 0.25, 0.5, 0.8]; // seuils d'intensité, en part de la journée planifiée
// Formateurs mémoïsés : la grille peut compter plus de 1000 pastilles, et
// `toLocaleDateString` reconstruit un formateur à chaque appel.
const FMT_DAY = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const FMT_MONTH = new Intl.DateTimeFormat("fr-FR", { month: "short" });

/**
 * Le rythme : une **pastille par jour**, en colonnes de semaines (lundi en
 * haut). L'intensité dit quelle part de la journée planifiée a été tracée —
 * c'est la vue qui rend visibles les périodes creuses, les vacances et les
 * semaines chargées, là où un total ne dit rien.
 *
 * La grille de points est la signature dot-matrix du projet ; on la reprend ici
 * telle quelle plutôt que d'inventer un carré à la GitHub.
 */
export class StatsHeatmapView {
  constructor(app) {
    this.app = app;
    this.el = el("statsHeatmap");
    this.anchor = this.el;
    this.tip = attachTimelineTip(this.el, { selector: ".hm-cell" });
  }

  bind() {
    this.el.addEventListener("click", (e) => {
      const cell = e.target.closest(".hm-cell[data-day]");
      if (cell) this.app.goToDaySegments(cell.dataset.day);
    });
  }

  render() {
    const { formatter, store } = this.app;
    const snap = this.app.stats.snapshot(this.app.statsPeriod);
    const days = snap.days;

    this.el.innerHTML = "";
    if (!days.length) { this.tip.mount(); return; }

    // Référence d'intensité pour un jour non planifié (week-end travaillé) :
    // la journée de base, sinon toute activité du samedi paraîtrait maximale.
    const baseDayMs = Math.max(3600000, store.settings.scheduleMinutesPerDay() * 60000);
    const cols = Math.ceil((isoDow(days[0].date) - 1 + days.length) / 7);

    const grid = createEl("div", { className: "hm", attrs: { style: `--hm-cols:${cols}` } });
    grid.appendChild(createEl("span", { className: "hm-corner" }));
    grid.appendChild(this.#months(days, cols));
    grid.appendChild(createEl("div", {
      className: "hm-dows",
      html: WEEKDAY_LABELS.map((d) => `<span>${d[0]}</span>`).join(""),
    }));

    const cells = createEl("div", { className: "hm-cells" });
    // Cases muettes avant le premier jour : la première colonne doit démarrer
    // au bon jour de semaine.
    for (let i = 1; i < isoDow(days[0].date); i++) {
      cells.appendChild(createEl("span", { className: "hm-hole" }));
    }
    for (const day of days) {
      const ref = day.plannedMs || baseDayMs;
      const level = day.ms <= 0 ? 0 : LEVELS.filter((t) => day.ms / ref >= t).length;
      const tasks = day.byTask.size;
      cells.appendChild(createEl("span", {
        className: "hm-cell" + (day.isWorkDay ? "" : " off"),
        attrs: {
          "data-level": String(level),
          "data-day": day.key,
          "data-name": cap(FMT_DAY.format(day.date)),
          "data-range": tasks ? `${tasks} tâche${tasks > 1 ? "s" : ""}` : "rien de tracé",
          "data-dur": formatter.clock(day.ms / 60000),
          "data-color": level ? `var(--heat-${level})` : "var(--text-faint)",
        },
      }));
    }
    grid.appendChild(cells);
    this.el.appendChild(grid);

    this.el.appendChild(createEl("div", {
      className: "hm-legend",
      html: "<span>Moins</span>"
        + [0, 1, 2, 3, 4].map((l) => `<span class="hm-swatch" data-level="${l}"></span>`).join("")
        + "<span>Plus</span>",
    }));
    this.tip.mount();
  }

  /**
   * Bandeau de mois : un libellé sur la colonne où le mois commence. Les
   * colonnes suivent la même grille que les pastilles, donc l'alignement est
   * automatique.
   */
  #months(days, cols) {
    const row = createEl("div", { className: "hm-months" }); // `--hm-cols` est hérité de `.hm`
    let last = null;
    for (let c = 0; c < cols; c++) {
      // Jour représentatif de la colonne : le premier jour de cette semaine
      // présent dans la période.
      const first = days[Math.max(0, c * 7 - (isoDow(days[0].date) - 1))];
      const month = first ? first.date.getMonth() : null;
      const show = month != null && month !== last;
      row.appendChild(createEl("span", {
        text: show ? cap(FMT_MONTH.format(first.date).replace(".", "")) : "",
      }));
      if (month != null) last = month;
    }
    return row;
  }
}
