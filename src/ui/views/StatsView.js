import { el, createEl, escapeHtml } from "../../utils/dom.js";
import { STATS_PERIODS } from "../../services/StatsAggregator.js";
import { TASK_TYPES } from "../../core/constants.js";
import { cap } from "../../utils/datetime.js";

/**
 * Tête de l'onglet Stats : le **sélecteur de période** (qui pilote tous les
 * blocs de l'onglet), un **bandeau de tête** et les cartes d'indicateurs.
 *
 * Les six cartes avaient toutes exactement le même poids, et aucune ne
 * répondait à la première question d'une rétrospective : « alors, cette
 * période ? ». Le total sort donc du lot — bandeau en contraste inversé,
 * chiffre géant, écart en pastille — et les cinq autres reculent d'un cran.
 * C'est la même mécanique que le total du jour : ce sont les deux seules
 * ancres inversées de l'application.
 */
export class StatsView {
  constructor(app) {
    this.app = app;
    this.periodGroup = el("stPeriod");
    this.periodLabel = el("stPeriodLabel");
    this.lead = el("statsLead");
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

    // Le total quitte la grille de cartes : il fait la tête de page. La moitié
    // droite du bandeau porte l'écart ET la composition de la période — sans
    // elle, le bandeau était un aplat noir aux deux tiers vide, et la
    // ventilation par type n'apparaissait qu'en bas de page.
    const delta = this.#delta(kpi);
    this.lead.innerHTML =
      '<span class="l">' +
        '<span class="k">Total sur la période</span>' +
        `<span class="v">${clock(kpi.total)}</span>` +
      "</span>" +
      '<span class="r">' +
        (delta ? `<span class="st-delta">${escapeHtml(delta)}</span>` : "") +
        this.#split(kpi, clock) +
      "</span>";

    this.cards.innerHTML = "";
    this.cards.append(
      this.#card(clock(kpi.avgPerActiveDay), "Moy. / jour actif"),
      this.#card(String(kpi.activeDays), "Jours actifs", `sur ${kpi.workDays} ouvrés`),
      this.#card(kpi.bestDay ? clock(kpi.bestDay.ms) : "—", "Meilleur jour", best),
      this.#card(String(kpi.streak), "Série", kpi.streak > 1 ? "jours d'affilée" : "jour"),
      this.#card(
        kpi.coveragePct == null ? "—" : Math.round(kpi.coveragePct) + " %",
        "Couverture", "des horaires",
        kpi.coveragePct == null ? null : Math.min(100, Math.max(0, kpi.coveragePct)),
      ),
    );
  }

  /**
   * Composition de la période : une barre empilée + sa légende, dans la même
   * grammaire que la barre du rail Totaux et que celle d'une semaine.
   */
  #split(kpi, clock) {
    const types = TASK_TYPES.filter((t) => kpi.byType[t] > 0);
    if (!kpi.total || types.length === 0) return "";
    const bar = types
      .map((t) => `<i class="${t}" style="width:${(kpi.byType[t] / kpi.total) * 100}%"></i>`)
      .join("");
    const legend = types.map((t) => `${t} ${clock(kpi.byType[t])}`).join(" · ");
    return `<span class="lead-split">${bar}</span>` +
           `<span class="lead-legend">${escapeHtml(legend)}</span>`;
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

  /**
   * `gauge` (0–100) ajoute une jauge sous le chiffre. Réservée à la couverture :
   * c'est le seul indicateur de la rangée qui soit une PART — les autres sont
   * des durées ou des compteurs, une barre n'y voudrait rien dire.
   */
  #card(value, label, sub = null, gauge = null) {
    const card = createEl("div", {
      className: "stat-card",
      html: `<div class="stat-val">${value}</div><div class="stat-lab">${label}</div>`,
    });
    if (sub) card.appendChild(createEl("div", { className: "stat-delta", text: sub }));
    if (gauge != null) {
      card.appendChild(createEl("div", {
        className: "stat-gauge", html: `<i style="width:${gauge}%"></i>`,
      }));
    }
    return card;
  }
}
