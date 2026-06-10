import { el, createEl } from "../../utils/dom.js";
import { startOfDay, addDays, isoDow, fmtDateInput } from "../../utils/datetime.js";

const TYPES = ["dev", "support", "autre"];
const NUM_WEEKS = 16; // barres « par semaine »

/**
 * Onglet Stats : vue d'ensemble tout-temps. Cartes de synthèse (total, semaine,
 * mois, nb de tâches, jours actifs), répartition par type et activité par
 * semaine. La heatmap est rendue séparément (HeatmapView) dans le même panneau.
 */
export class StatsView {
  constructor(app) {
    this.app = app;
    this.cards = el("statsCards");
    this.types = el("statsTypes");
    this.bars = el("statsBars");
  }

  render() {
    const { store, calc, formatter } = this.app;
    const clock = (ms) => formatter.clock(ms / 60000);
    const today = startOfDay(new Date());
    const monday = addDays(today, -(isoDow(today) - 1));
    const sumWin = (s, e) => store.segments.reduce((a, seg) => a + calc.segmentMs(seg, s, e), 0);

    // --- cartes de synthèse ---
    const totalAll = store.segments.reduce((a, seg) => a + calc.segmentMs(seg), 0);
    const weekMs = sumWin(monday.getTime(), addDays(monday, 7).getTime());
    const monthMs = sumWin(
      new Date(today.getFullYear(), today.getMonth(), 1).getTime(),
      new Date(today.getFullYear(), today.getMonth() + 1, 1).getTime(),
    );
    const taskCount = store.tasks.filter((t) => !t.archived).length;
    const activeDays = new Set(store.segments.map((s) => fmtDateInput(new Date(s.startMs())))).size;

    this.cards.innerHTML = "";
    this.cards.append(
      this.#card(clock(totalAll), "Total"),
      this.#card(clock(weekMs), "Cette semaine"),
      this.#card(clock(monthMs), "Ce mois"),
      this.#card(String(taskCount), "Tâches"),
      this.#card(String(activeDays), "Jours actifs"),
    );

    // --- répartition par type ---
    const byType = { dev: 0, support: 0, autre: 0 };
    for (const seg of store.segments) {
      const t = store.taskById(seg.taskId)?.type ?? "autre";
      byType[t] += calc.segmentMs(seg);
    }
    const maxType = Math.max(1, ...Object.values(byType));
    this.types.innerHTML = "";
    for (const t of TYPES) {
      const ms = byType[t];
      this.types.appendChild(createEl("div", {
        className: "stat-type",
        html:
          `<span class="type-badge type-${t}">${t}</span>` +
          `<div class="stat-bar-track"><div class="stat-bar" style="width:${Math.round(ms / maxType * 100)}%;background:var(--dot-${t})"></div></div>` +
          `<span class="stat-type-val">${clock(ms)}</span>`,
      }));
    }

    // --- activité par semaine (barres) ---
    const firstMon = addDays(monday, -7 * (NUM_WEEKS - 1));
    const weeks = [];
    for (let w = 0; w < NUM_WEEKS; w++) {
      const ws = addDays(firstMon, 7 * w);
      let ms = 0;
      for (let d = 0; d < 7; d++) {
        const day = addDays(ws, d);
        if (day.getTime() <= today.getTime()) ms += calc.totalsForDay(day).total;
      }
      weeks.push({ ws, ms });
    }
    const maxW = Math.max(1, ...weeks.map((w) => w.ms));
    this.bars.innerHTML = "";
    for (const wk of weeks) {
      const label = wk.ws.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
      this.bars.appendChild(createEl("div", {
        className: "stat-wk",
        attrs: { title: `Semaine du ${label} · ${wk.ms ? clock(wk.ms) : "rien"}` },
        html: `<div class="stat-wk-bar" style="height:${Math.round(wk.ms / maxW * 100)}%"></div>`,
      }));
    }
  }

  #card(value, label) {
    return createEl("div", {
      className: "stat-card",
      html: `<div class="stat-val">${value}</div><div class="stat-lab">${label}</div>`,
    });
  }
}
