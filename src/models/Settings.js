import { DEFAULT_SETTINGS, ROUNDING_STEPS, EYE_BREAK_MIN, EYE_BREAK_MAX,
         EYE_REST_MIN, EYE_REST_MAX, REMINDER_LABEL_MAX, REMINDER_MAX } from "../core/constants.js";
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

/** Durée du repos lui-même, ramenée dans ses bornes (secondes entières). */
export function clampEyeRest(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.eyeBreak.restSeconds;
  return Math.min(EYE_REST_MAX, Math.max(EYE_REST_MIN, n));
}

/** Volume du bip, ramené dans [0, 1]. */
export function clampVolume(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.eyeBreak.volume;
  return Math.min(1, Math.max(0, n));
}

/**
 * Normalise un rappel saisi. Renvoie `null` si l'entrée n'en est pas un : sans
 * heure valide il n'y a rien à déclencher, et un rappel muet dans la liste est
 * pire qu'une saisie refusée.
 */
export function normalizeBreak(entry) {
  if (!entry) return null;
  const time = String(entry.time || "").trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const label = String(entry.label || "").trim().slice(0, REMINDER_LABEL_MAX) || "Pause";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(entry.date || "")) ? entry.date : null;
  const id = String(entry.id || "").trim() || "r_" + Math.random().toString(36).slice(2, 10);
  return { id, label, time, date };
}

/** Copie défensive d'une liste de rappels (entrées invalides écartées). */
function cloneBreaks(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeBreak).filter(Boolean).slice(0, REMINDER_MAX);
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
      restSeconds: clampEyeRest(data.eyeBreak?.restSeconds ?? d.eyeBreak.restSeconds),
      sound: data.eyeBreak?.sound ?? d.eyeBreak.sound,
      volume: clampVolume(data.eyeBreak?.volume ?? d.eyeBreak.volume),
    };
    this.reminders = {
      lunch: data.reminders?.lunch ?? d.reminders.lunch,
      dayEnd: data.reminders?.dayEnd ?? d.reminders.dayEnd,
      breaks: cloneBreaks(data.reminders?.breaks),
    };
  }

  /** Période du rappel « repos des yeux », en millisecondes. */
  eyeBreakMs() {
    return clampEyeMinutes(this.eyeBreak.minutes) * 60_000;
  }

  /** Durée du repos lui-même, en millisecondes. */
  eyeRestMs() {
    return clampEyeRest(this.eyeBreak.restSeconds) * 1000;
  }

  /** Volume du bip, dans [0, 1]. */
  eyeVolume() {
    return clampVolume(this.eyeBreak.volume);
  }

  /**
   * Ajoute un rappel. Renvoie l'entrée normalisée, ou `null` si la saisie était
   * inexploitable (heure absente ou hors format) ou la liste pleine.
   */
  addBreak(entry) {
    if (this.reminders.breaks.length >= REMINDER_MAX) return null;
    const item = normalizeBreak(entry);
    if (!item) return null;
    this.reminders.breaks.push(item);
    this.reminders.breaks.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
    return item;
  }

  /** Retire un rappel par son identifiant. */
  removeBreak(id) {
    this.reminders.breaks = this.reminders.breaks.filter((b) => b.id !== id);
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
      reminders: {
        lunch: this.reminders.lunch,
        dayEnd: this.reminders.dayEnd,
        breaks: this.reminders.breaks.map((b) => ({ ...b })),
      },
    };
  }
}
