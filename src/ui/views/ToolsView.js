import { el, createEl } from "../../utils/dom.js";
import { createCopyButton } from "../components/CopyButton.js";
import { startOfDay, atTime, fmtDateTimeLocal, parseDateTimeLocal, fmtClock, pad2 } from "../../utils/datetime.js";

/** Formats affichés par le convertisseur (clé interne → libellé). */
const CONV_FORMATS = [
  ["decimal", "Décimal"],
  ["jira", "Jira"],
  ["clock", "Horloge"],
  ["hms", "H:mm:ss"],
];

/** Le format qu'on vient chercher ici neuf fois sur dix : il passe devant. */
const CONV_MAIN = "jira";

/**
 * Écran « Outils » : deux utilitaires sans état persistant qui réutilisent le
 * domaine — un convertisseur de durée (tous formats + copie) et un calcul
 * brut/net entre deux instants (TimeCalculator.workedMs exposé en UI).
 */
export class ToolsView {
  constructor(app) {
    this.app = app;
    this.anchor = el("toolsScreen");
    this.convInput = el("convInput");
    this.convOut = el("convOut");
    this.bnStart = el("bnStart");
    this.bnEnd = el("bnEnd");
    this.bnOut = el("bnOut");
    this.bnStrip = el("bnStrip");
    this.bnStripAxis = el("bnStripAxis");
  }

  bind() {
    this.convInput.addEventListener("input", () => this.#renderConv());
    this.bnStart.addEventListener("input", () => this.#renderBrutNet());
    this.bnEnd.addEventListener("input", () => this.#renderBrutNet());
    this.#setDefaults();
  }

  /**
   * (Re)calcule les sorties depuis les saisies courantes — sans jamais réécrire
   * les champs : un changement de réglages (unités Jira, arrondi) se répercute
   * donc sur les conversions affichées.
   */
  render() {
    this.#renderConv();
    this.#renderBrutNet();
  }

  /** Pré-remplit le calcul brut/net (arrivée du jour → maintenant), au démarrage. */
  #setDefaults() {
    const now = new Date();
    const start = atTime(startOfDay(now), this.app.store.settings.arrival);
    this.bnStart.value = fmtDateTimeLocal(start);
    this.bnEnd.value = fmtDateTimeLocal(now);
    this.#renderBrutNet();
  }

  /* ----------------- convertisseur ----------------- */
  #renderConv() {
    const fmt = this.app.formatter;
    // La grammaire commune (`Formatter.parse`) : aucun format à choisir.
    const min = fmt.parse(this.convInput.value);
    const ms = min == null ? null : Math.round(min * 60_000);
    this.convOut.innerHTML = "";
    if (ms == null) {
      this.convOut.appendChild(createEl("div", {
        className: "conv-empty",
        text: this.convInput.value.trim() ? "Valeur non reconnue." : "Saisissez une durée ci-dessus.",
      }));
      return;
    }
    const mins = ms / 60000;
    const values = {
      decimal: fmt.decimal(mins),
      jira: fmt.jira(mins),
      clock: fmt.clock(mins),
      hms: fmt.hms(ms),
    };
    for (const [key, label] of CONV_FORMATS) {
      const card = createEl("div", {
        className: "conv-card" + (key === CONV_MAIN ? " is-main" : ""),
        html: `<span class="k">${label}</span><span class="v">${values[key]}</span>`,
      });
      const copy = createCopyButton(this.app, values[key], "Copier");
      copy.classList.add("cp");
      card.appendChild(copy);
      this.convOut.appendChild(card);
    }
  }

  /* ----------------- brut / net ----------------- */
  #renderBrutNet() {
    this.bnOut.innerHTML = "";
    const sv = this.bnStart.value, ev = this.bnEnd.value;
    if (!sv || !ev) { this.#clearStrip(); this.#bnHint("Renseignez un début et une fin."); return; }
    const s = parseDateTimeLocal(sv).getTime();
    const e = parseDateTimeLocal(ev).getTime();
    if (!(e > s)) { this.#clearStrip(); this.#bnHint("La fin doit être après le début."); return; }
    this.#renderStrip(s, e);
    this.bnOut.appendChild(this.#bnCard("Brut", "temps réel écoulé", e - s));
    this.bnOut.appendChild(this.#bnCard("Net", "temps ouvré (horaires)", this.app.calc.workedMs(s, e)));
  }

  /**
   * Ruban brut/net : l'intervalle en entier, et par-dessus les portions
   * réellement comptées. Le hors-horaires reste visible en hachures — c'est la
   * meilleure explication possible de la règle centrale de Stint : on voit
   * *où* le rognage a mordu, pas seulement combien il a retiré.
   */
  #renderStrip(s, e) {
    const span = e - s;
    const pct = (ms) => ((ms - s) / span) * 100;
    const ranges = this.app.calc.workRangesBetween(s, e);

    this.bnStrip.innerHTML = ranges.map(([a, b]) => {
      const l = pct(a);
      return `<i class="bn-net" style="left:${l}%;width:${Math.max(0.4, pct(b) - l)}%"></i>`;
    }).join("");
    if (!ranges.length) {
      this.bnStrip.innerHTML = '<span class="bn-empty">rien de compté sur cet intervalle</span>';
    }

    // Repères : les deux bornes, plus les minuits traversés (le multi-jours est
    // justement le cas où le brut et le net divergent le plus).
    const marks = [[s, this.#stamp(s, span)], [e, this.#stamp(e, span)]];
    let midnight = startOfDay(new Date(s)).getTime() + 86_400_000;
    while (midnight < e && marks.length < 8) {
      marks.push([midnight, this.#stamp(midnight, span)]);
      midnight += 86_400_000;
    }
    this.bnStripAxis.innerHTML = "";
    marks.sort((a, b) => a[0] - b[0]).forEach(([ms, text], i) => {
      const el2 = createEl("span", { text, attrs: { style: `left:${pct(ms)}%` } });
      if (i === 0) el2.style.transform = "none";
      this.bnStripAxis.appendChild(el2);
    });
  }

  /** Étiquette d'axe : l'heure seule, ou jour + heure si l'intervalle déborde. */
  #stamp(ms, span) {
    const d = new Date(ms);
    return span > 86_400_000 ? `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${fmtClock(d)}` : fmtClock(d);
  }

  #clearStrip() {
    this.bnStrip.innerHTML = "";
    this.bnStripAxis.innerHTML = "";
  }

  #bnHint(text) {
    this.bnOut.appendChild(createEl("div", { className: "conv-empty", text }));
  }

  #bnCard(title, sub, ms) {
    const fmt = this.app.formatter;
    const mins = ms / 60000;
    const card = createEl("div", {
      className: "bn-card" + (title === "Net" ? " is-net" : ""),
      html: `<div class="bn-title">${title}</div><div class="bn-sub">${sub}</div><div class="bn-val">${fmt.clock(mins)}</div>`,
    });
    const actions = createEl("div", { className: "bn-actions" });
    actions.append(
      createCopyButton(this.app, fmt.decimal(mins), "Déc."),
      createCopyButton(this.app, fmt.jira(mins), "Jira"),
    );
    card.appendChild(actions);
    return card;
  }
}
