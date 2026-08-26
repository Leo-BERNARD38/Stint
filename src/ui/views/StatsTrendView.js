import { el, createEl, escapeHtml } from "../../utils/dom.js";
import { TASK_TYPES } from "../../core/constants.js";
import { smoothPath, areaPath } from "../../utils/curve.js";
import { attachTimelineTip } from "../components/TimelineTip.js";

const PLOT_H = 200;   // hauteur de la zone traçante, en px
const TICK_GAP = 52;  // écart minimal entre deux libellés d'abscisse, en px
const DOTS_MAX = 32;  // au-delà, les points de données deviennent illisibles

/**
 * Le graphique d'évolution : combien de temps par **type** (dev / support /
 * autre) au fil du temps, à granularité jour · semaine · mois.
 *
 * Deux lectures complémentaires :
 *   - **Empilé** — aires cumulées : le haut de la pile donne le total de la
 *     période, la hauteur de chaque bande sa contribution ;
 *   - **Séparé** — trois courbes indépendantes : on compare des tendances
 *     (le support monte-t-il pendant que le dev descend ?).
 *
 * Le tracé est un SVG mesuré en **pixels réels** (`clientWidth` au rendu, comme
 * l'axe de `TimelineView`) plutôt qu'un viewBox étiré : un `preserveAspectRatio`
 * non uniforme déformerait l'épaisseur des traits. Un `ResizeObserver` re-rend
 * quand la largeur change.
 */
export class StatsTrendView {
  constructor(app) {
    this.app = app;
    this.el = el("statsTrend");
    this.anchor = this.el;
    this.legend = el("statsTrendLegend");
    this.grain = "week";       // day | week | month
    this.mode = "stacked";     // stacked | split
    this.muted = new Set();    // séries masquées via la légende
    this.tip = attachTimelineTip(this.el, { top: () => 0, selector: ".chart-hit" });
    this._width = 0;
  }

  bind() {
    this.#bindChips(el("stGrain"), "grain", "grain");
    this.#bindChips(el("stMode"), "mode", "mode");
    this.legend.addEventListener("click", (e) => {
      const b = e.target.closest("[data-type]");
      if (!b) return;
      const t = b.dataset.type;
      this.muted.has(t) ? this.muted.delete(t) : this.muted.add(t);
      this.render();
    });
    // Le graphique est dessiné en pixels : il faut le redessiner au
    // redimensionnement. Le garde-fou sur la largeur évite la boucle
    // (notre propre rendu change la hauteur du conteneur).
    if (typeof ResizeObserver !== "undefined") {
      this._ro = new ResizeObserver(() => {
        if (this._raf) return;
        this._raf = requestAnimationFrame(() => {
          this._raf = 0;
          if (this.el.clientWidth && this.el.clientWidth !== this._width) this.render();
        });
      });
      this._ro.observe(this.el);
    }
  }

  #bindChips(group, prop, dataKey) {
    group.addEventListener("click", (e) => {
      const b = e.target.closest(`[data-${dataKey}]`);
      if (!b || this[prop] === b.dataset[dataKey]) return;
      this[prop] = b.dataset[dataKey];
      [...group.children].forEach((c) => c.classList.toggle("active", c === b));
      this.render();
    });
  }

  render() {
    const { formatter } = this.app;
    const snap = this.app.stats.snapshot(this.app.statsPeriod);
    const { buckets } = snap.series(this.grain);
    const shown = TASK_TYPES.filter((t) => !this.muted.has(t));

    this.#renderLegend(snap);

    const sums = buckets.map((b) => shown.reduce((a, t) => a + b.byType[t], 0));
    const peak = this.mode === "stacked"
      ? Math.max(0, ...sums)
      : Math.max(0, ...buckets.flatMap((b) => shown.map((t) => b.byType[t])));

    this.el.innerHTML = "";
    if (!buckets.length || peak <= 0) {
      this.el.appendChild(createEl("div", {
        className: "empty",
        text: shown.length ? "Aucun temps tracé sur cette période." : "Toutes les séries sont masquées.",
      }));
      this.tip.mount();
      return;
    }

    const max = this.#niceMax(peak);
    const body = createEl("div", { className: "chart-body" });
    const yAxis = createEl("div", { className: "chart-y" });
    for (const f of [1, 0.5, 0]) {
      yAxis.appendChild(createEl("span", {
        className: "chart-y-lab",
        text: formatter.clock((max * f) / 60000),
        attrs: { style: `bottom:${f * 100}%` },
      }));
    }
    const plot = createEl("div", { className: "chart-plot" });
    body.append(yAxis, plot);
    this.el.append(body);

    // Mesure après insertion : la gouttière des libellés Y est en CSS.
    const w = plot.clientWidth;
    this._width = this.el.clientWidth;
    if (!w) return; // panneau pas encore mis en page — un prochain rendu s'en chargera

    plot.innerHTML = this.#svg(buckets, shown, max, w);
    plot.appendChild(this.#hits(buckets, shown, sums));
    this.el.appendChild(this.#xAxis(buckets, w));
    this.tip.mount();
  }

  /* ----------------- tracé ----------------- */

  /** Abscisse du centre de la tranche `i` (les zones de survol s'y alignent). */
  #cx(i, n, w) { return ((i + 0.5) / n) * w; }

  #svg(buckets, shown, max, w) {
    const n = buckets.length;
    const y = (ms) => PLOT_H - (ms / max) * PLOT_H;

    // Les chemins sont prolongés à plat jusqu'aux bords : sans ça l'aire
    // « flotterait » d'une demi-tranche de chaque côté du cadre.
    const edge = (pts) => [{ x: 0, y: pts[0].y }, ...pts, { x: w, y: pts[pts.length - 1].y }];
    const at = (values) => edge(values.map((ms, i) => ({ x: this.#cx(i, n, w), y: y(ms) })));

    let out = "";
    for (const f of [0.5, 1]) { // filets de repère (le 0 est le bord bas du cadre)
      out += `<line x1="0" y1="${(1 - f) * PLOT_H}" x2="${w}" y2="${(1 - f) * PLOT_H}" `
        + `stroke="var(--dot)" stroke-width="1" stroke-dasharray="1 5" />`;
    }

    const stacked = this.mode === "stacked";
    const stack = new Array(n).fill(0);
    for (const type of shown) {
      // En empilé, l'aire va du cumul précédent au nouveau cumul ; en séparé,
      // chaque courbe repart de la ligne de base.
      const under = stacked ? at([...stack]) : at(new Array(n).fill(0));
      if (stacked) for (let i = 0; i < n; i++) stack[i] += buckets[i].byType[type];
      const values = stacked ? [...stack] : buckets.map((b) => b.byType[type]);
      const top = at(values);
      const color = `var(--dot-${type})`;

      // 0,5 laissait la bande la plus claire de la rampe se dissoudre dans la
      // piste ; à 0,64 les trois valeurs tiennent, empilées comme séparées.
      out += `<path d="${areaPath(top, under)}" fill="${color}" opacity="${stacked ? ".64" : ".14"}" />`;
      out += `<path d="${smoothPath(top)}" fill="none" stroke="${color}" `
        + `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`;
      if (n <= DOTS_MAX) {
        out += values.map((ms, i) =>
          `<circle cx="${this.#cx(i, n, w).toFixed(1)}" cy="${y(ms).toFixed(1)}" r="2.6" fill="${color}" />`).join("");
      }
    }
    return `<svg class="chart-svg" viewBox="0 0 ${w} ${PLOT_H}" width="${w}" height="${PLOT_H}" aria-hidden="true">${out}</svg>`;
  }

  /**
   * Zones de survol : une colonne transparente par tranche, qui porte les
   * `data-*` du contrat de `TimelineTip` — l'infobulle maison marche alors sans
   * une ligne de code de plus, et affiche le détail par type de la tranche.
   */
  #hits(buckets, shown, sums) {
    const { formatter } = this.app;
    const wrap = createEl("div", { className: "chart-hits" });
    const n = buckets.length;
    buckets.forEach((b, i) => {
      const parts = shown.filter((t) => b.byType[t] > 0)
        .map((t) => `${t} ${formatter.clock(b.byType[t] / 60000)}`);
      const top = shown.reduce((best, t) => (b.byType[t] > b.byType[best] ? t : best), shown[0]);
      wrap.appendChild(createEl("div", {
        className: "chart-hit",
        attrs: {
          style: `left:${(i / n) * 100}%;width:${100 / n}%`,
          "data-name": this.grain === "week" ? `${b.label} · ${b.sub}` : b.sub,
          "data-range": parts.length ? parts.join(" · ") : "rien de tracé",
          "data-dur": formatter.clock(sums[i] / 60000),
          "data-color": sums[i] > 0 ? `var(--dot-${top})` : "var(--text-faint)",
        },
      }));
    });
    return wrap;
  }

  /** Abscisses : on n'affiche qu'un libellé sur `step`, la dernière en priorité. */
  #xAxis(buckets, w) {
    const n = buckets.length;
    const axis = createEl("div", { className: "chart-x" });
    const step = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(w / TICK_GAP))));
    buckets.forEach((b, i) => {
      if ((n - 1 - i) % step !== 0) return;
      axis.appendChild(createEl("span", {
        className: "chart-tick",
        text: b.label,
        attrs: { style: `left:${((i + 0.5) / n) * 100}%` },
      }));
    });
    return axis;
  }

  #renderLegend(snap) {
    const { formatter } = this.app;
    this.legend.innerHTML = TASK_TYPES.map((t) => {
      const ms = snap.kpi.byType[t] ?? 0;
      return `<button class="chip is-type${this.muted.has(t) ? "" : " active"}" data-type="${t}" `
        + `title="Masquer / afficher cette série">${escapeHtml(t)} `
        + `<span class="chip-val">${formatter.clock(ms / 60000)}</span></button>`;
    }).join("");
  }

  /** Plafond de l'axe Y arrondi à une durée « ronde » supérieure. */
  #niceMax(ms) {
    const hours = ms / 3600000;
    const steps = [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 60, 80, 120, 160, 200, 300, 400];
    const pick = steps.find((v) => v >= hours) ?? Math.ceil(hours / 100) * 100;
    return pick * 3600000;
  }
}
