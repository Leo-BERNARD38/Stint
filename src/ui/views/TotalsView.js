import { el, createEl, escapeHtml } from "../../utils/dom.js";
import { TASK_TYPES } from "../../core/constants.js";
import { createCopyButton } from "../components/CopyButton.js";

/** Totaux du jour : journée (mis en avant) + par type, avec copie déc./Jira. */
export class TotalsView {
  constructor(app) {
    this.app = app;
    this.grid = el("totalsGrid");
  }

  render(viewDay) {
    this.grid.innerHTML = "";
    const { total, byType, segments } = this.app.calc.totalsForDay(viewDay);

    this.grid.appendChild(this.#card("Total journée", total / 60000, true));
    for (const type of TASK_TYPES) {
      if (byType[type] > 0) this.grid.appendChild(this.#card(type, byType[type] / 60000, false));
    }

    if (segments.length === 0) {
      this.grid.appendChild(createEl("div", {
        className: "empty",
        text: "Rien de tracé ce jour.",
        attrs: { style: "grid-column:1/-1" },
      }));
    }
  }

  #card(label, minutes, isDay) {
    const fmt = this.app.formatter;
    const card = createEl("div", {
      className: "total-card" + (isDay ? " day" : ""),
      html: `<div class="k">${escapeHtml(label)}</div><div class="v">${fmt.decimal(minutes)} h</div>`,
    });
    const row = createEl("div", { className: "copy-row" });
    row.append(
      createCopyButton(this.app, fmt.decimal(minutes), "Déc."),
      createCopyButton(this.app, fmt.jira(minutes), "Jira"),
    );
    card.appendChild(row);
    return card;
  }
}
