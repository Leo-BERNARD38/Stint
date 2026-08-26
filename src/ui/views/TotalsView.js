import { el, createEl, escapeHtml } from "../../utils/dom.js";
import { TASK_TYPES } from "../../core/constants.js";
import { fmtClock } from "../../utils/datetime.js";
import { icon } from "../icons.js";

/**
 * Aside « Totaux » de l'onglet Journée : ventilation par type, total du jour +
 * copie Déc./Jira, bloc « Temps non tracé » (liste des trous avec bouton
 * Combler, ou état zéro) et **couverture** du jour. La carte « Total du jour »
 * avec la scène day-glyph vit dans le héros, toujours visible (DayTotalView).
 *
 * La couverture est posée ici, sous le temps non tracé, parce que les deux sont
 * les deux faces d'une même mesure : ce qui est tracé, ce qui ne l'est pas.
 */
export class TotalsView {
  constructor(app) {
    this.app = app;
    this.root = el("totalsGrid");
    this.anchor = this.root;
  }

  render(viewDay) {
    const fmt = this.app.formatter;
    // Suit l'interrupteur « Arrondi » des Tâches du jour : les totaux affichés
    // restent la somme exacte des lignes lues juste à côté.
    const s = this.app.store.settings;
    const { total, byType, segments, rounded } =
      this.app.calc.totalsForDay(viewDay, !!s.roundedDay);
    this.root.innerHTML = "";
    this.root.classList.toggle("is-rounded", !!rounded);

    if (segments.length === 0) {
      this.root.appendChild(createEl("div", { className: "empty", text: "Rien de tracé ce jour." }));
    } else {
      // La composition du jour en une barre, avant les chiffres : trois lignes
      // de durées ne disent pas la PART de chacune ; une barre empilée, si.
      this.#renderSplit(byType, total);
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
      // total du jour
      this.root.appendChild(createEl("div", {
        className: "total-sum",
        html: `<span class="tname">Total</span><span class="tamt">${fmt.clock(total / 60000)}</span>`,
      }));
    }

    this.#renderUntracked(viewDay, fmt);
    this.#renderCoverage(viewDay, fmt, total);
  }

  /** Barre empilée : une part par type, dans l'ordre stable de TASK_TYPES. */
  #renderSplit(byType, total) {
    if (total <= 0) return;
    const parts = TASK_TYPES.filter((t) => byType[t] > 0)
      .map((t) => `<i class="${t}" style="width:${(byType[t] / total) * 100}%"></i>`)
      .join("");
    this.root.appendChild(createEl("div", { className: "totals-split", html: parts }));
  }

  /**
   * Couverture : la part de la journée PLANIFIÉE qui est effectivement tracée.
   * Rien à afficher un jour non travaillé — il n'y a alors pas de dénominateur,
   * et une barre vide y raconterait un retard imaginaire.
   */
  #renderCoverage(viewDay, fmt, totalMs) {
    const plannedMs = this.app.calc.plannedMsForDay(viewDay);
    if (plannedMs <= 0) return;
    const ratio = totalMs / plannedMs;
    const pct = Math.round(ratio * 100);
    // La barre plafonne à 100 % (elle ne peut pas déborder de sa piste) mais le
    // pourcentage, lui, dit la vérité : une journée à 118 % s'affiche à 118 %.
    const width = Math.min(100, Math.max(0, ratio * 100));
    const done = ratio >= 1;

    this.root.appendChild(createEl("div", {
      className: "coverage" + (done ? " is-done" : ""),
      html:
        `<div class="cov-top">` +
          `<span class="cov-pct">${pct} %</span>` +
          `<span class="cov-k">de la journée planifiée</span>` +
        `</div>` +
        `<div class="cov-track" role="img" aria-label="${pct} % de la journée planifiée est tracée">` +
          `<i style="width:${width}%"></i>` +
        `</div>` +
        `<div class="cov-lab">` +
          `<span>${fmt.clock(totalMs / 60000)} tracées</span>` +
          `<span>${fmt.clock(plannedMs / 60000)} planifiées</span>` +
        `</div>`,
    }));
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
