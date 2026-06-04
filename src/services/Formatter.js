import { pad2 } from "../utils/datetime.js";

/**
 * Conversions d'affichage : arrondi paramétrable (§6.6), décimal (§9.2),
 * Jira `w d h m` (§9.3) et horloge h:mm:ss. Lit `store.settings` en direct.
 */
export class Formatter {
  constructor(store) {
    this.store = store;
  }

  get s() {
    return this.store.settings;
  }

  /** Arrondit des minutes selon le mode courant (none|1m|5m|15m). */
  round(minutes) {
    const step = { none: 0, "1m": 1, "5m": 5, "15m": 15 }[this.s.rounding] ?? 0;
    return step ? Math.round(minutes / step) * step : minutes;
  }

  /** Décimal : 90 min → "1.5". */
  decimal(minutes) {
    const hours = this.round(minutes) / 60;
    return String(parseFloat(hours.toFixed(2)));
  }

  /** Horloge H:mm pour l'affichage : 90 min → "1:30", 75 → "1:15". */
  clock(minutes) {
    const total = Math.max(0, Math.round(this.round(minutes)));
    return Math.floor(total / 60) + ":" + pad2(total % 60);
  }

  /**
   * Unités Jira effectives. En mode auto, `1d` = durée ouvrée d'une journée
   * (horaires − pause) et `1w` = nombre de jours travaillés ; sinon valeurs
   * saisies. Évite de ressaisir une info déjà décrite par les horaires.
   */
  effHoursPerDay() {
    const j = this.s.jira;
    if (j.auto) { const m = this.s.scheduleMinutesPerDay(); return m > 0 ? m / 60 : (j.hoursPerDay || 8); }
    return j.hoursPerDay;
  }
  effDaysPerWeek() {
    const j = this.s.jira;
    if (j.auto) return this.s.workDays.length || j.daysPerWeek;
    return j.daysPerWeek;
  }

  /** Jira : "2w 4d 6h 45m" en omettant les zéros. */
  jira(minutes) {
    let rest = Math.round(this.round(minutes));
    if (rest <= 0) return "0m";
    const dayUnit = this.effHoursPerDay() * 60;
    const weekUnit = dayUnit * this.effDaysPerWeek();
    const w = Math.floor(rest / weekUnit); rest -= w * weekUnit;
    const d = Math.floor(rest / dayUnit); rest -= d * dayUnit;
    const h = Math.floor(rest / 60); rest -= h * 60;
    const m = rest;
    const parts = [];
    if (w) parts.push(w + "w");
    if (d) parts.push(d + "d");
    if (h) parts.push(h + "h");
    if (m) parts.push(m + "m");
    return parts.length ? parts.join(" ") : "0m";
  }

  /** Horloge live h:mm:ss à partir d'une durée en ms. */
  hms(ms) {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    return h + ":" + pad2(m) + ":" + pad2(sec);
  }
}
