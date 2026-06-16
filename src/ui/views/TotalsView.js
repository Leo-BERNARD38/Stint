import { el, createEl, escapeHtml } from "../../utils/dom.js";
import { TASK_TYPES } from "../../core/constants.js";
import { createCopyButton } from "../components/CopyButton.js";

/**
 * Aside « Totaux » de l'onglet Journée : ventilation par type, total du jour et
 * pilules de copie Déc./Jira. (La carte « Total du jour » avec la scène day-glyph
 * vit désormais dans le héros, toujours visible — cf. DayTotalView.)
 */
export class TotalsView {
  constructor(app) {
    this.app = app;
    this.root = el("totalsGrid");
    this.anchor = this.root;
  }

  render(viewDay) {
    const fmt = this.app.formatter;
    const { total, byType, segments } = this.app.calc.totalsForDay(viewDay);
    this.root.innerHTML = "";

    if (segments.length === 0) {
      this.root.appendChild(createEl("div", { className: "empty", text: "Rien de tracé ce jour." }));
      return;
    }

    // ventilation par type
    for (const type of TASK_TYPES.filter((t) => byType[t] > 0)) {
      this.root.appendChild(createEl("div", {
        className: "total-line",
        html:
          `<span class="tdot ${type}"></span>` +
          `<span class="tname">${escapeHtml(type)}</span>` +
          `<span class="tamt">${fmt.clock(byType[type] / 60000)}</span>`,
      }));
    }

    // total du jour + copie
    this.root.appendChild(createEl("div", {
      className: "total-sum",
      html: `<span class="tname">Total</span><span class="tamt">${fmt.clock(total / 60000)}</span>`,
    }));
    const copyRow = createEl("div", { className: "copy-row totals-copy" });
    copyRow.append(
      createCopyButton(this.app, fmt.decimal(total / 60000), "Déc."),
      createCopyButton(this.app, fmt.jira(total / 60000), "Jira"),
    );
    this.root.appendChild(copyRow);
  }
}
