import { el, createEl } from "../../utils/dom.js";
import { createCopyButton } from "../components/CopyButton.js";
import { dayGlyph } from "../icons.js";

/**
 * Carte « Total du jour » du héros — **toujours visible** (au-dessus des onglets,
 * sur tous les onglets de l'app). Contraste inversé (fond accent), scène
 * « moment de la journée » dot-matrix animée en filigrane (DayGlyphAnimator),
 * total géant et pilules Déc./Jira copiables.
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
      html: '<div class="k">Total du jour</div><div class="v">0:00</div>',
    });
    this.valueEl = this.text.querySelector(".v");
    this.copyRow = createEl("div", { className: "copy-row" });
    this.text.appendChild(this.copyRow);
    this.root.appendChild(this.text);
    this.#built = true;
  }

  render(viewDay) {
    if (!this.#built) this.#build();
    this.viewDay = viewDay;
    this.#updateValues();
  }

  /** Met à jour le total + les pilules de copie sans toucher au glyphe. */
  #updateValues() {
    const fmt = this.app.formatter;
    const { total } = this.app.calc.totalsForDay(this.viewDay ?? this.app.viewDay);
    const mins = total / 60000;
    this.valueEl.textContent = fmt.clock(mins);
    this.copyRow.innerHTML = "";
    this.copyRow.append(
      createCopyButton(this.app, fmt.decimal(mins), "Déc."),
      createCopyButton(this.app, fmt.jira(mins), "Jira"),
    );
  }

  /** Total live au tick (1 s) : ne reconstruit ni le glyphe ni la structure. */
  tickValue() {
    if (this.#built) this.#updateValues();
  }
}
