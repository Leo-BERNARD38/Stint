import { el, createEl, escapeHtml } from "../../utils/dom.js";
import { STATS_GRAINS } from "../../services/StatsAggregator.js";
import { TASK_TYPES } from "../../core/constants.js";

/**
 * Tête de l'onglet Stats : la **navigation calendaire** (qui pilote tout
 * l'onglet), le bandeau de tête et la couverture de la période.
 *
 * Deux partis pris tiennent ce bloc.
 *
 * **La période a un nom.** S37, septembre 2026, T3 2026 — donc une voisine, donc
 * un écart lisible (« + 6 % par rapport à S36 »). Les anciennes fenêtres
 * glissantes (4 semaines, 3 mois…) n'en avaient pas : leur « période
 * précédente » était les 28 jours d'avant, ce qui ne se dit pas et ne se
 * débriefe pas.
 *
 * **Une seule note sous le chiffre géant, et c'est une part.** Les cinq tuiles
 * d'avant avaient toutes le même poids et aucune ne répondait à « ai-je fait mes
 * heures ? » : la série ne suivait même pas la période affichée. Reste la
 * couverture, seule des cinq à être une proportion — et elle gagne une troisième
 * part, le temps **non tracé**, qui n'existait jusqu'ici que jour par jour.
 */
export class StatsView {
  constructor(app) {
    this.app = app;
    this.grainGroup = el("stGrain");
    this.lead = el("statsLead");
    this.cover = el("statsCover");
    this.anchor = this.lead;
  }

  bind() {
    // Les chips sont construites ici (une fois) : la liste des grains vit dans
    // le service, pas en double dans le HTML.
    this.grainGroup.innerHTML = "";
    for (const g of STATS_GRAINS) {
      this.grainGroup.appendChild(createEl("button", {
        className: "chip",
        text: g.label,
        attrs: { "data-grain": g.key },
      }));
    }
    this.grainGroup.addEventListener("click", (e) => {
      const b = e.target.closest("[data-grain]");
      if (b) this.app.setStatsGrain(b.dataset.grain);
    });
    el("stPrev").addEventListener("click", () => this.app.shiftStatsPeriod(-1));
    el("stNext").addEventListener("click", () => this.app.shiftStatsPeriod(1));
    el("stNow").addEventListener("click", () => this.app.statsToday());
  }

  render() {
    const { formatter } = this.app;
    const snap = this.app.statsSnapshot();
    const { kpi, range } = snap;
    const clock = (ms) => formatter.clock(ms / 60000);

    for (const c of this.grainGroup.children) {
      c.classList.toggle("active", c.dataset.grain === this.app.statsGrain);
    }
    // « Aujourd'hui » ne sert à rien quand on y est déjà, et une période à venir
    // n'a rien à montrer : la flèche avant s'arrête sur la période en cours.
    el("stNow").disabled = range.current;
    el("stNext").disabled = range.current;

    const delta = this.#delta(kpi, range);
    this.lead.innerHTML =
      '<span class="l">' +
        `<span class="k">${escapeHtml(range.label)}<em>${escapeHtml(range.sub)}</em></span>` +
        `<span class="v">${clock(kpi.total)}</span>` +
      "</span>" +
      '<span class="r">' +
        (delta ? `<span class="st-delta">${escapeHtml(delta)}</span>` : "") +
        this.#split(kpi, clock) +
      "</span>";

    this.#renderCoverage(kpi, clock);
  }

  /**
   * Composition de la période : une barre empilée + sa légende, dans la même
   * grammaire que la barre du rail Totaux.
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
   * Écart avec la période précédente **de même nature** — S36 pour S37, août
   * pour septembre. Volontairement **neutre** (pas de vert/rouge) : tracer moins
   * de temps n'est pas une faute, c'est une information.
   */
  #delta({ deltaMs, deltaPct, prevTotal }, range) {
    if (!prevTotal) return null;
    if (Math.abs(deltaMs) < 60000) return `= ${range.prevLabel}`;
    const arrow = deltaMs > 0 ? "▲" : "▼";
    const abs = this.app.formatter.clock(Math.abs(deltaMs) / 60000);
    const pct = deltaPct == null ? "" : ` · ${deltaPct > 0 ? "+" : "−"}${Math.abs(Math.round(deltaPct))} %`;
    return `${arrow} ${abs}${pct} / ${range.prevLabel}`;
  }

  /**
   * Couverture de la période, en TROIS parts : le tracé (accent), le justifié
   * (encre) et le manque (hachures). Le manque se dessine, il ne se peint pas.
   *
   * Le dénominateur est l'horaire **écoulé** (`scheduledMs`), pas l'horaire
   * planifié : sur la semaine en cours, un mercredi, le jeudi et le vendredi ne
   * sont pas encore du retard.
   */
  #renderCoverage(kpi, clock) {
    if (!kpi.scheduledMs) {
      this.cover.hidden = true;
      return;
    }
    this.cover.hidden = false;
    const pct = Math.round(((kpi.total + kpi.offMs) / kpi.scheduledMs) * 100);
    // La barre se normalise sur la SOMME de ses trois parts, pas sur l'horaire :
    // elle fait donc toujours exactement 100 % de sa piste. Les trois ne
    // s'ajoutent pas forcément à l'horaire écoulé — un segment saisi cet
    // après-midi compte déjà, alors que l'après-midi n'est pas écoulé — et
    // normaliser sur l'horaire poussait alors le manque hors de la piste, où il
    // devenait invisible. Le pourcentage, lui, reste calculé sur l'horaire et
    // dit la vérité : une période à 112 % s'affiche à 112 %.
    const sum = kpi.total + kpi.offMs + kpi.untrackedMs;
    const w = (ms) => (sum > 0 ? (ms / sum) * 100 : 0);
    const avg = kpi.activeDays
      ? `${clock(kpi.avgPerActiveDay)} / jour actif · ${kpi.activeDays} jour${kpi.activeDays > 1 ? "s" : ""} sur ${kpi.workDays} ouvré${kpi.workDays > 1 ? "s" : ""}`
      : "aucun jour tracé";

    this.cover.className = "coverage stats-cover" + (pct >= 100 ? " is-done" : "");
    this.cover.innerHTML =
      '<div class="cov-top">' +
        `<span class="cov-pct">${pct} %</span>` +
        '<span class="cov-k">des horaires écoulés</span>' +
        `<span class="grow"></span><span class="cov-avg">${escapeHtml(avg)}</span>` +
      "</div>" +
      `<div class="cov-track" role="img" aria-label="${pct} % des horaires écoulés sont tracés ou justifiés">` +
        `<i style="width:${w(kpi.total)}%"></i>` +
        (kpi.offMs > 0 ? `<i class="off" style="width:${w(kpi.offMs)}%"></i>` : "") +
        (kpi.untrackedMs > 0 ? `<i class="cov-gap" style="width:${w(kpi.untrackedMs)}%"></i>` : "") +
      "</div>" +
      '<div class="cov-lab">' +
        `<span>${clock(kpi.total)} tracées` +
          (kpi.offMs > 0 ? ` · ${clock(kpi.offMs)} hors tâche` : "") +
          (kpi.untrackedMs > 0 ? ` · ${clock(kpi.untrackedMs)} non tracées` : "") +
        "</span>" +
        `<span>${clock(kpi.scheduledMs)} d'horaires</span>` +
      "</div>";
  }
}
