import { el } from "../../utils/dom.js";
import { sameDay, formatLongDate } from "../../utils/datetime.js";

/** Navigation par jour (v1 centrée sur aujourd'hui + précédent/suivant). */
export class DayNavView {
  constructor(app) {
    this.app = app;
    this.anchor = el("dayHead");
    this.label = el("dayLabel");
    this.todayBtn = el("dayToday");
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
  }
}
