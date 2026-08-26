import { el, createEl } from "../../utils/dom.js";
import { dayGlyph } from "../icons.js";

/**
 * Carte « Total aujourd'hui » du héros — **toujours visible** (au-dessus des
 * onglets, sur tous les onglets de l'app). Contraste inversé (fond accent), scène
 * « moment de la journée » dot-matrix animée en filigrane (DayGlyphAnimator) et
 * total géant. Affiche toujours le total du **jour réel** (indépendant de
 * `app.viewDay`) : cohérent avec le glyphe, basé sur l'heure courante.
 *
 * La structure (dont le `.day-glyph`) est construite **une seule fois** : seules
 * les valeurs sont remises à jour au rendu / au tick, pour ne jamais
 * réinitialiser l'animation du glyphe (un unique `.day-glyph` dans le DOM).
 */
export class DayTotalView {
  #built = false;

  constructor(app) {
    this.app = app;
    this.root = el("dayTotalCard");
    this.anchor = this.root; // dans .control (jamais [hidden] sur l'app) → rendue sur tous les onglets
  }

  #build() {
    this.root.innerHTML = "";
    // Scène day-glyph en fond (créée une fois ; l'animateur garde la main ensuite).
    this.root.insertAdjacentHTML("beforeend", dayGlyph());
    this.text = createEl("div", {
      className: "total-card-text",
      html: '<div class="k">Total aujourd\'hui</div><div class="v">0:00</div>' +
            '<div class="sub"></div>',
    });
    this.valueEl = this.text.querySelector(".v");
    this.subEl = this.text.querySelector(".sub");
    this.root.appendChild(this.text);
    this.#built = true;
  }

  render() {
    if (!this.#built) this.#build();
    this.#updateValues();
  }

  /** Met à jour le total du jour réel sans toucher au glyphe. */
  #updateValues() {
    const { total } = this.app.calc.totalsForDay(new Date());
    const min = total / 60000;
    const fmt = this.app.formatter;
    this.valueEl.textContent = fmt.clock(min);
    // Les deux unités qu'on vient chercher pour reporter : décimal et Jira. La
    // carte ne montrait que H:mm — la seule forme qu'on ne colle jamais nulle
    // part. Et son bas restait vide.
    this.subEl.textContent = `${fmt.decimal(min)} déc · ${fmt.jira(min)}`;
  }

  /** Total live au tick (1 s) : ne reconstruit ni le glyphe ni la structure. */
  tickValue() {
    if (this.#built) this.#updateValues();
  }
}
