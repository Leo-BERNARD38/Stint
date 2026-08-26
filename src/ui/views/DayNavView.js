import { el } from "../../utils/dom.js";
import { sameDay, formatLongDate } from "../../utils/datetime.js";
import { describeBlocks } from "../components/ScheduleEditor.js";

/** Navigation par jour (v1 centrée sur aujourd'hui + précédent/suivant). */
export class DayNavView {
  constructor(app) {
    this.app = app;
    this.anchor = el("dayHead");
    this.label = el("dayLabel");
    this.todayBtn = el("dayToday");
    this.planned = el("dayPlanned");
  }

  bind() {
    el("dayPrev").addEventListener("click", () => this.app.shiftDay(-1));
    el("dayNext").addEventListener("click", () => this.app.shiftDay(1));
    this.todayBtn.addEventListener("click", () => this.app.goToday());
  }

  render(viewDay) {
    this.label.textContent = formatLongDate(viewDay);
    // Sur aujourd'hui : on signale par la couleur du bouton (texte vert), pas de badge.
    this.todayBtn.classList.toggle("is-today", sameDay(viewDay, new Date()));
    this.#renderPlanned(viewDay);
  }

  /**
   * Ce que les horaires prévoient pour ce jour-là. C'est le dénominateur de la
   * couverture et des trous : sans lui affiché, « 5:45 tracées » ne se compare
   * à rien. Lecture pure de Settings.blocksFor / TimeCalculator, aucun calcul
   * en double ici.
   */
  #renderPlanned(viewDay) {
    const blocks = this.app.store.settings.blocksFor(viewDay);
    const ms = this.app.calc.plannedMsForDay(viewDay);
    this.planned.textContent = ms > 0
      ? `${this.app.formatter.clock(ms / 60000)} planifiées · ${describeBlocks(blocks)}`
      : "Jour non travaillé";
  }
}
