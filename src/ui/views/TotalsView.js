import { el, createEl, escapeHtml } from "../../utils/dom.js";
import { TASK_TYPES } from "../../core/constants.js";
import { createCopyButton } from "../components/CopyButton.js";
import { fmtClock } from "../../utils/datetime.js";
import { icon } from "../icons.js";

/**
 * Aside « Totaux » de l'onglet Journée : ventilation par type, total du jour +
 * copie Déc./Jira, et bloc « Temps non tracé » (liste des trous avec bouton
 * Combler, ou état zéro). La carte « Total du jour » avec la scène day-glyph
 * vit désormais dans le héros, toujours visible (cf. DayTotalView).
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
    } else {
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

    this.#renderUntracked(viewDay, fmt);
  }

  /** Bloc « Temps non tracé » : trous restants + bouton Combler, ou état zéro. */
  #renderUntracked(viewDay, fmt) {
    const gaps = this.app.calc.gapsForDay(viewDay);
    const totalMs = gaps.reduce((a, [s, e]) => a + (e - s), 0);
    const block = createEl("div", { className: "untracked" });
    block.appendChild(createEl("div", {
      className: "untracked-head",
      html:
        `<span class="k">Temps non tracé</span>` +
        `<span class="untracked-total ${gaps.length ? "has" : "clear"}">${gaps.length ? fmt.clock(totalMs / 60000) : "0:00"}</span>`,
    }));

    if (gaps.length) {
      const list = createEl("div", { className: "untracked-list" });
      for (const [gs, ge] of gaps) {
        const row = createEl("div", {
          className: "untracked-row",
          html:
            `<span class="ut-dot"></span>` +
            `<span class="ut-range">${fmtClock(new Date(gs))} → ${fmtClock(new Date(ge))}</span>` +
            `<span class="ut-dur">${fmt.clock((ge - gs) / 60000)}</span>`,
        });
        row.appendChild(createEl("button", {
          className: "mini-btn ut-fill", text: "Combler",
          on: { click: () => this.app.openFillForGap(gs, ge) },
        }));
        list.appendChild(row);
      }
      block.appendChild(list);
    } else {
      block.appendChild(createEl("div", {
        className: "untracked-zero",
        html: icon("check", { size: 15 }) + "<span>Journée entièrement tracée</span>",
      }));
    }
    this.root.appendChild(block);
  }
}
