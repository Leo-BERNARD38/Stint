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
