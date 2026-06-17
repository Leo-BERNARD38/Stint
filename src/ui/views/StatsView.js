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
    this.anchor = this.cards;
  }

  render() {
    const { store, calc, formatter } = this.app;
    const clock = (ms) => formatter.clock(ms / 60000);
    const today = startOfDay(new Date());
    const monday = addDays(today, -(isoDow(today) - 1));
    const weekStart = monday.getTime(), weekEnd = addDays(monday, 7).getTime();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1).getTime();

    // Un seul balayage des segments → total, semaine, mois, jours actifs et
    // répartition par type. `segmentMs(seg, s, e)` vaut 0 hors fenêtre : on évite
    // l'appel borné (coûteux en net) quand le segment ne chevauche pas la
    // semaine / le mois — résultat strictement identique.
    let totalAll = 0, weekMs = 0, monthMs = 0;
    const byType = { dev: 0, support: 0, autre: 0 };
    const activeDays = new Set();
    for (const seg of store.segments) {
      const full = calc.segmentMs(seg);
      totalAll += full;
      const type = store.taskById(seg.taskId)?.type ?? "autre";
      byType[type] = (byType[type] ?? 0) + full;
      activeDays.add(fmtDateInput(new Date(seg.startMs())));
      const sMs = seg.startMs(), eMs = seg.endMs();
      if (eMs > weekStart && sMs < weekEnd) weekMs += calc.segmentMs(seg, weekStart, weekEnd);
      if (eMs > monthStart && sMs < monthEnd) monthMs += calc.segmentMs(seg, monthStart, monthEnd);
    }
    const taskCount = store.tasks.filter((t) => !t.archived).length;

    this.cards.innerHTML = "";
    this.cards.append(
      this.#card(clock(totalAll), "Total"),
      this.#card(clock(weekMs), "Cette semaine"),
      this.#card(clock(monthMs), "Ce mois"),
      this.#card(String(taskCount), "Tâches"),
      this.#card(String(activeDays.size), "Jours actifs"),
    );

    // --- répartition par type ---
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
