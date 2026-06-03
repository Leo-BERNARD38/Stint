import { DEFAULT_SETTINGS } from "../core/constants.js";

/** Réglages de l'application (horaires ouvrés, conversion Jira, arrondi). */
export class Settings {
  constructor(data = {}) {
    const d = DEFAULT_SETTINGS;
    this.appName = data.appName ?? d.appName;
    this.theme = data.theme ?? d.theme;
    this.workDays = Array.isArray(data.workDays) ? [...data.workDays] : [...d.workDays];
    this.arrival = data.arrival ?? d.arrival;
    this.lunchStart = data.lunchStart ?? d.lunchStart;
    this.lunchEnd = data.lunchEnd ?? d.lunchEnd;
    this.departure = data.departure ?? d.departure;
    this.jira = {
      auto: data.jira?.auto ?? d.jira.auto,
      hoursPerDay: data.jira?.hoursPerDay ?? d.jira.hoursPerDay,
      daysPerWeek: data.jira?.daysPerWeek ?? d.jira.daysPerWeek,
    };
    this.rounding = data.rounding ?? d.rounding;
  }

  static fromJSON(o) {
    return new Settings(o || {});
  }

  isWorkDay(isoDow) {
    return this.workDays.includes(isoDow);
  }

  /** Durée ouvrée théorique d'une journée (minutes) = matin + après-midi. */
  scheduleMinutesPerDay() {
    const toMin = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
    const morning = Math.max(0, toMin(this.lunchStart) - toMin(this.arrival));
    const afternoon = Math.max(0, toMin(this.departure) - toMin(this.lunchEnd));
    return morning + afternoon;
  }

  toggleWorkDay(isoDow) {
    const set = new Set(this.workDays);
    set.has(isoDow) ? set.delete(isoDow) : set.add(isoDow);
    this.workDays = [...set].sort((a, b) => a - b);
  }

  toJSON() {
    return {
      appName: this.appName,
      theme: this.theme,
      workDays: [...this.workDays],
      arrival: this.arrival,
      lunchStart: this.lunchStart,
      lunchEnd: this.lunchEnd,
      departure: this.departure,
      jira: { ...this.jira },
      rounding: this.rounding,
    };
  }
}
