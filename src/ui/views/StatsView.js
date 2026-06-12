import { el, createEl } from "../../utils/dom.js";
import { TASK_TYPES } from "../../core/constants.js";
import { startOfDay, addDays, isoDow, fmtDateInput } from "../../utils/datetime.js";

/**
 * Onglet Stats : cartes de synthèse tout-temps (total, semaine, mois, nb de
 * tâches, jours actifs) et répartition par type. La timeline d'historique est
 * rendue séparément (StatsTimelineView) dans le même panneau.
 */
export class StatsView {
  constructor(app) {
    this.app = app;
    this.cards = el("statsCards");
    this.types = el("statsTypes");
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
    for (const t of TASK_TYPES) {
      const ms = byType[t];
      this.types.appendChild(createEl("div", {
        className: "stat-type",
        html:
          `<span class="type-badge type-${t}">${t}</span>` +
          `<div class="stat-bar-track"><div class="stat-bar" style="width:${Math.round(ms / maxType * 100)}%;background:var(--dot-${t})"></div></div>` +
          `<span class="stat-type-val">${clock(ms)}</span>`,
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
