import { el, createEl } from "../../utils/dom.js";
import { STATS_PERIODS } from "../../services/StatsAggregator.js";
import { cap } from "../../utils/datetime.js";

/**
 * Tête de l'onglet Stats : le **sélecteur de période** (qui pilote tous les
 * blocs de l'onglet) et les cartes d'indicateurs de cette période.
 *
 * Les cartes répondent aux questions d'une rétrospective : combien de temps,
 * à quel rythme, quel jour a été le plus dense, quelle part de mes horaires
 * est effectivement tracée.
 */
export class StatsView {
  constructor(app) {
    this.app = app;
    this.periodGroup = el("stPeriod");
    this.periodLabel = el("stPeriodLabel");
    this.cards = el("statsCards");
    this.anchor = this.cards;
  }

  bind() {
    // Les chips sont construites ici (une fois) : la liste des périodes vit
    // dans le service, pas en double dans le HTML.
    this.periodGroup.innerHTML = "";
    for (const p of STATS_PERIODS) {
      this.periodGroup.appendChild(createEl("button", {
        className: "chip" + (p.key === this.app.statsPeriod ? " active" : ""),
        text: p.label,
        attrs: { "data-period": p.key },
      }));
    }
    this.periodGroup.addEventListener("click", (e) => {
      const b = e.target.closest("[data-period]");
      if (b) this.app.setStatsPeriod(b.dataset.period);
    });
  }

  render() {
    const { formatter } = this.app;
    const snap = this.app.stats.snapshot(this.app.statsPeriod);
    const { kpi, range } = snap;
    const clock = (ms) => formatter.clock(ms / 60000);

    for (const c of this.periodGroup.children) {
      c.classList.toggle("active", c.dataset.period === this.app.statsPeriod);
    }
    const days = Math.round((range.end - range.start) / 86400000);
    const fmt = (ms) => new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
    this.periodLabel.textContent = `${fmt(range.start)} → ${fmt(range.end - 1)} · ${days} jours`;

    const best = kpi.bestDay
      ? cap(kpi.bestDay.date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })).replace(".", "")
      : "—";

    this.cards.innerHTML = "";
    this.cards.append(
      this.#card(clock(kpi.total), "Total", this.#delta(kpi)),
      this.#card(clock(kpi.avgPerActiveDay), "Moy. / jour actif"),
      this.#card(String(kpi.activeDays), "Jours actifs", `sur ${kpi.workDays} ouvrés`),
      this.#card(kpi.bestDay ? clock(kpi.bestDay.ms) : "—", "Meilleur jour", best),
      this.#card(String(kpi.streak), "Série", kpi.streak > 1 ? "jours d'affilée" : "jour"),
      this.#card(
        kpi.coveragePct == null ? "—" : Math.round(kpi.coveragePct) + " %",
        "Couverture", "des horaires",
      ),
    );
  }

  /**
   * Écart avec la période précédente de même durée. Volontairement **neutre**
   * (pas de vert/rouge) : tracer moins de temps n'est pas une faute, c'est une
   * information.
   */
  #delta({ deltaMs, deltaPct, prevTotal }) {
    if (!prevTotal) return null;
    if (Math.abs(deltaMs) < 60000) return "= période précédente";
    const arrow = deltaMs > 0 ? "▲" : "▼";
    const abs = this.app.formatter.clock(Math.abs(deltaMs) / 60000);
    const pct = deltaPct == null ? "" : ` · ${deltaPct > 0 ? "+" : "−"}${Math.abs(Math.round(deltaPct))} %`;
    return `${arrow} ${abs}${pct}`;
  }

  #card(value, label, sub = null) {
    const card = createEl("div", {
      className: "stat-card",
      html: `<div class="stat-val">${value}</div><div class="stat-lab">${label}</div>`,
    });
    if (sub) card.appendChild(createEl("div", { className: "stat-delta", text: sub }));
    return card;
  }
}
