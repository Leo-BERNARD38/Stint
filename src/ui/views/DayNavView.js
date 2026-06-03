import { el } from "../../utils/dom.js";
import { sameDay, formatLongDate } from "../../utils/datetime.js";

/** Navigation par jour (v1 centrée sur aujourd'hui + précédent/suivant). */
export class DayNavView {
  constructor(app) {
    this.app = app;
    this.label = el("dayLabel");
    this.badge = el("todayBadge");
  }

  bind() {
    el("dayPrev").addEventListener("click", () => this.app.shiftDay(-1));
    el("dayNext").addEventListener("click", () => this.app.shiftDay(1));
    el("dayToday").addEventListener("click", () => this.app.goToday());
  }

  render(viewDay) {
    this.label.textContent = formatLongDate(viewDay);
    this.badge.textContent = sameDay(viewDay, new Date()) ? "● aujourd'hui" : "";
  }
}
