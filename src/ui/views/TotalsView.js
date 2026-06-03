import { el, createEl, escapeHtml } from "../../utils/dom.js";
import { TASK_TYPES } from "../../core/constants.js";
import { createCopyButton } from "../components/CopyButton.js";

/** Totaux du jour : total mis en avant (avec copie) + ventilation par type. */
export class TotalsView {
  constructor(app) {
    this.app = app;
    this.root = el("totalsGrid");
  }

  render(viewDay) {
    const fmt = this.app.formatter;
    const { total, byType, segments } = this.app.calc.totalsForDay(viewDay);
    this.root.innerHTML = "";

    // total journée, mis en avant
    const hero = createEl("div", {
      className: "total-hero",
      html: `<div class="k">Total journée</div><div class="v">${fmt.decimal(total / 60000)} h</div>`,
    });
    const copyRow = createEl("div", { className: "copy-row" });
    copyRow.append(
      createCopyButton(this.app, fmt.decimal(total / 60000), "Déc."),
      createCopyButton(this.app, fmt.jira(total / 60000), "Jira"),
    );
    hero.appendChild(copyRow);
    this.root.appendChild(hero);

    // ventilation par type
    const active = TASK_TYPES.filter((t) => byType[t] > 0);
    for (const type of active) {
      this.root.appendChild(createEl("div", {
        className: "total-line",
        html:
          `<span class="tdot ${type}"></span>` +
          `<span class="tname">${escapeHtml(type)}</span>` +
          `<span class="tamt">${fmt.decimal(byType[type] / 60000)} h</span>`,
      }));
    }

    if (segments.length === 0) {
      this.root.appendChild(createEl("div", { className: "empty", text: "Rien de tracé ce jour." }));
    }
  }
}
