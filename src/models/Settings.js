import { DEFAULT_SETTINGS, ROUNDING_STEPS, EYE_BREAK_MIN, EYE_BREAK_MAX } from "../core/constants.js";
import { isoDow, fmtDateInput, toMin } from "../utils/datetime.js";

/** Copie défensive d'une map d'horaires { clé: [[start,end], …] }. */
function cloneHours(map) {
  const out = {};
  for (const [k, blocks] of Object.entries(map || {})) {
    if (Array.isArray(blocks)) out[k] = blocks.map((p) => [p[0], p[1]]);
  }
  return out;
}

/** Période du rappel « repos des yeux » ramenée dans ses bornes (minutes entières). */
export function clampEyeMinutes(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.eyeBreak.minutes;
  return Math.min(EYE_BREAK_MAX, Math.max(EYE_BREAK_MIN, n));
}

/**
 * Réglages de l'application.
 *
 * Horaires sur 3 niveaux (du plus général au plus spécifique) :
 *   1. base        — `arrival`/`lunchStart`/`lunchEnd`/`departure`, appliquée
 *                    aux `workDays` ;
 *   2. par jour de semaine — `weekdayHours[isoDow]` remplace la base ;
 *   3. par date    — `dateHours["YYYY-MM-DD"]` remplace tout.
 * Un planning est une liste de créneaux `[["HH:MM","HH:MM"], …]` ; `[]` = non
 * travaillé. On ne stocke que les exceptions → format léger.
 */
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
    this.weekdayHours = cloneHours(data.weekdayHours);
    this.dateHours = cloneHours(data.dateHours);
    this.jira = {
      auto: data.jira?.auto ?? d.jira.auto,
      hoursPerDay: data.jira?.hoursPerDay ?? d.jira.hoursPerDay,
      daysPerWeek: data.jira?.daysPerWeek ?? d.jira.daysPerWeek,
    };
    this.rounding = ROUNDING_STEPS[data.rounding] != null ? data.rounding : d.rounding;
    this.roundedDay = data.roundedDay ?? d.roundedDay;
    this.bgDots = data.bgDots ?? d.bgDots;
    this.eyeBreak = {
      enabled: data.eyeBreak?.enabled ?? d.eyeBreak.enabled,
      minutes: clampEyeMinutes(data.eyeBreak?.minutes ?? d.eyeBreak.minutes),
    };
  }

  /** Période du rappel « repos des yeux », en millisecondes. */
  eyeBreakMs() {
    return clampEyeMinutes(this.eyeBreak.minutes) * 60_000;
  }

  /** Pas d'arrondi en minutes (0 = aucun arrondi configuré). */
  roundingMinutes() {
    return ROUNDING_STEPS[this.rounding] ?? 0;
  }

  /**
   * Arrondit une durée (minutes) au pas configuré. Arrondi **au plus proche**,
   * mais une durée non nulle ne tombe jamais à 0 : on reporte au minimum un pas
   * (5 min tracées ≠ rien de fait).
   */
  roundMinutes(minutes) {
    const step = this.roundingMinutes();
    if (!step || minutes <= 0) return minutes;
    return Math.max(step, Math.round(minutes / step) * step);
  }

  static fromJSON(o) {
    return new Settings(o || {});
  }

  isWorkDay(isoDowN) {
    return this.workDays.includes(isoDowN);
  }

  toggleWorkDay(isoDowN) {
    const set = new Set(this.workDays);
    set.has(isoDowN) ? set.delete(isoDowN) : set.add(isoDowN);
    this.workDays = [...set].sort((a, b) => a - b);
  }

  /** Créneaux de la base (matin, après-midi), sans exception. */
  baseBlocks() {
    const blocks = [];
    if (toMin(this.lunchStart) > toMin(this.arrival)) blocks.push([this.arrival, this.lunchStart]);
    if (toMin(this.departure) > toMin(this.lunchEnd)) blocks.push([this.lunchEnd, this.departure]);
    return blocks;
  }

  /** Planning effectif d'une date : date > jour de semaine > base. */
  blocksFor(date) {
    const key = fmtDateInput(date);
    if (this.dateHours[key]) return this.dateHours[key];
    const dow = isoDow(date);
    if (this.weekdayHours[dow]) return this.weekdayHours[dow];
    if (this.workDays.includes(dow)) return this.baseBlocks();
    return [];
  }

  /** Définit/retire l'exception d'un jour de semaine (blocks=null pour retirer). */
  setWeekdayHours(isoDowN, blocks) {
    if (blocks == null) delete this.weekdayHours[isoDowN];
    else this.weekdayHours[isoDowN] = blocks;
  }

  /** Définit/retire l'exception d'une date "YYYY-MM-DD". */
  setDateHours(key, blocks) {
    if (!key) return;
    if (blocks == null) delete this.dateHours[key];
    else this.dateHours[key] = blocks;
  }

  /** Durée ouvrée d'une journée type (base), en minutes — sert au Jira auto. */
  scheduleMinutesPerDay() {
    return this.baseBlocks().reduce((sum, [a, b]) => sum + (toMin(b) - toMin(a)), 0);
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
      weekdayHours: cloneHours(this.weekdayHours),
      dateHours: cloneHours(this.dateHours),
      jira: { ...this.jira },
      rounding: this.rounding,
      roundedDay: this.roundedDay,
      bgDots: this.bgDots,
      eyeBreak: { ...this.eyeBreak },
    };
  }
}
