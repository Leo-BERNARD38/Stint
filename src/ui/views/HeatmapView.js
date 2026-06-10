import { el, createEl } from "../../utils/dom.js";
import { startOfDay, addDays, sameDay, isoDow, fmtDateInput, formatLongDate } from "../../utils/datetime.js";

const NUM_WEEKS = 53; // une année complète (remplit la carte façon graphe GitHub)

/**
 * Construit la grille semaines × jours (lundi → dimanche), la plus ancienne à
 * gauche. Fonction **pure** (aucun DOM) pour être testable : renvoie une liste
 * de semaines, chacune avec son libellé de mois (si changement) et ses 7 jours.
 */
export function buildWeeks(today = new Date(), numWeeks = NUM_WEEKS) {
  const t0 = startOfDay(today);
  const monday = addDays(t0, -(isoDow(t0) - 1));         // lundi de la semaine courante
  const first = addDays(monday, -7 * (numWeeks - 1));     // lundi de la 1ʳᵉ colonne
  const weeks = [];
  let prevMonth = -1;
  for (let w = 0; w < numWeeks; w++) {
    const ws = addDays(first, 7 * w);
    const month = ws.getMonth();
    const label = month !== prevMonth ? ws.toLocaleDateString("fr-FR", { month: "short" }) : "";
    prevMonth = month;
    const days = [];
    for (let d = 0; d < 7; d++) {
      const day = addDays(ws, d);
      days.push({ day, future: day.getTime() > t0.getTime() });
    }
    weeks.push({ label, days });
  }
  return weeks;
}

/** Niveau d'intensité 0..4 selon les heures travaillées dans la journée. */
export function heatLevel(hours) {
  if (hours <= 0) return 0;
  if (hours < 2) return 1;
  if (hours < 4) return 2;
  if (hours < 6) return 3;
  return 4;
}

/**
 * Heatmap calendrier (façon GitHub) en tête de l'onglet Tâches : une case par
 * jour, intensité = temps total travaillé. Clic sur un jour → onglet Segments.
 * Monochrome (accent × opacité) pour coller au design flat / Nothing OS.
 */
export class HeatmapView {
  constructor(app) {
    this.app = app;
    this.el = el("heatmap");
  }

  bind() {
    this.el.addEventListener("click", (e) => {
      const cell = e.target.closest(".hm-cell[data-day]");
      if (cell) this.app.goToDaySegments(cell.dataset.day);
    });
    this.el.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const cell = e.target.closest(".hm-cell[data-day]");
      if (cell) { e.preventDefault(); this.app.goToDaySegments(cell.dataset.day); }
    });
  }

  render() {
    const { calc, formatter } = this.app;
    const weeks = buildWeeks();
    const prevScroll = this.el.querySelector(".hm-scroll")?.scrollLeft;

    const months = createEl("div", { className: "hm-months" });
    const grid = createEl("div", { className: "hm-grid" });
    for (const wk of weeks) {
      months.appendChild(createEl("span", { className: "hm-mon", text: wk.label }));
      for (const { day, future } of wk.days) {
        if (future) { grid.appendChild(createEl("span", { className: "hm-cell hm-future" })); continue; }
        const total = calc.totalsForDay(day).total;
        const lvl = heatLevel(total / 3_600_000);
        grid.appendChild(createEl("span", {
          className: "hm-cell" + (lvl ? " l" + lvl : "") + (sameDay(day, new Date()) ? " today" : ""),
          attrs: {
            "data-day": fmtDateInput(day),
            title: `${formatLongDate(day)} · ${total ? formatter.clock(total / 60000) : "rien"}`,
            role: "button", tabindex: "0",
          },
        }));
      }
    }

    const inner = createEl("div", { className: "hm-inner" });
    inner.append(months, grid);
    const scroll = createEl("div", { className: "hm-scroll" });
    scroll.appendChild(inner);

    this.el.innerHTML = "";
    this.el.append(scroll, this.#legend());
    // Conserve la position de défilement entre rendus ; au 1ᵉʳ rendu, va au plus récent.
    scroll.scrollLeft = prevScroll != null ? prevScroll : scroll.scrollWidth;
  }

  #legend() {
    const legend = createEl("div", { className: "hm-legend" });
    legend.appendChild(createEl("span", { text: "Moins" }));
    for (let l = 0; l <= 4; l++) {
      legend.appendChild(createEl("span", { className: "hm-cell" + (l ? " l" + l : "") }));
    }
    legend.appendChild(createEl("span", { text: "Plus" }));
    return legend;
  }
}
