import { DEFAULT_SETTINGS, ROUNDING_STEPS, EYE_BREAK_MIN, EYE_BREAK_MAX,
         EYE_REST_MIN, EYE_REST_MAX, REMINDER_LABEL_MAX, REMINDER_MAX,
         DATE_RANGE_MAX_DAYS, DATE_HOURS_MAX,
         SEGMENT_MERGE_GAP_MAX_MIN, SEGMENT_MIN_MAX_MIN,
         OFF_REASON_MAX, OFF_LABEL_MAX } from "../core/constants.js";
import { isoDow, fmtDateInput, parseDateInput, toMin,
         countDays, eachDateKey } from "../utils/datetime.js";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

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

/** Seuil de fusion des micro-pauses, en minutes entières dans [0, 30]. */
export function clampMergeGap(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.segments.mergeGapMin;
  return Math.min(SEGMENT_MERGE_GAP_MAX_MIN, Math.max(0, n));
}

/** Durée sous laquelle le chrono jette un segment, en minutes entières dans [0, 15]. */
export function clampMinSegment(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.segments.minMin;
  return Math.min(SEGMENT_MIN_MAX_MIN, Math.max(0, n));
}

/** Volume du bip, ramené dans [0, 1]. */
export function clampVolume(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.eyeBreak.volume;
  return Math.min(1, Math.max(0, n));
}

/* Identifiants de rappel : même forme que `Store.#uid` (horodatage en base 36 +
   séquence), pas de hasard. Le compteur est local au module parce que `Settings`
   ne peut pas dépendre de `Store` — c'est l'inverse. */
let breakSeq = 0;
function breakId() {
  breakSeq += 1;
  return "r_" + Date.now().toString(36) + breakSeq.toString(36);
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
  const id = String(entry.id || "").trim() || breakId();
  return { id, label, time, date };
}

/** Copie défensive d'une liste de rappels (entrées invalides écartées). */
/**
 * Range un planning : jette les créneaux vides ou inversés, trie, puis **fusionne
 * les créneaux jointifs ou qui se chevauchent**. Invariant garanti en sortie :
 * une suite de créneaux disjoints et croissants.
 *
 * La fusion n'est pas cosmétique. Deux créneaux collés (08:30–12:30 · 12:30–17:00,
 * ce que produisait la base quand `lunchStart === lunchEnd`) font croire à une
 * pause déjeuner qui n'existe pas : `Reminders.occurrencesFor` teste
 * `ranges.length > 1` et notifiait, `gapsForDay` boucle par créneau et rendait
 * deux trous jointifs au lieu d'un.
 */
export function mergeBlocks(blocks) {
  const clean = (Array.isArray(blocks) ? blocks : [])
    .filter((p) => Array.isArray(p) && HHMM.test(p[0]) && HHMM.test(p[1]) && toMin(p[1]) > toMin(p[0]))
    .sort((a, b) => toMin(a[0]) - toMin(b[0]));
  const out = [];
  for (const [a, b] of clean) {
    const last = out[out.length - 1];
    if (last && toMin(a) <= toMin(last[1])) {
      if (toMin(b) > toMin(last[1])) last[1] = b;
    } else out.push([a, b]);
  }
  return out;
}

/**
 * La grammaire de saisie d'une journée, dans les deux sens. C'est le seul
 * endroit qui traduit « arrivée / départ / pause (ou non) » en créneaux : ni
 * l'éditeur ni les vues n'en fabriquent.
 */
export function blocksFromDay(day) {
  if (!day || !day.worked) return [];
  if (!day.lunch) return [[day.arrival, day.departure]];
  return mergeBlocks([[day.arrival, day.lunchStart], [day.lunchEnd, day.departure]]);
}

/** Le chemin inverse : un planning relu dans la grammaire de saisie. */
export function dayFromBlocks(blocks, fallback = {}) {
  const b = mergeBlocks(blocks);
  const d = DEFAULT_SETTINGS;
  if (b.length === 0) {
    return {
      worked: false, extra: false,
      arrival: fallback.arrival ?? d.arrival, departure: fallback.departure ?? d.departure,
      lunch: fallback.lunch ?? d.lunch,
      lunchStart: fallback.lunchStart ?? d.lunchStart, lunchEnd: fallback.lunchEnd ?? d.lunchEnd,
    };
  }
  const arrival = b[0][0];
  const departure = b[b.length - 1][1];
  if (b.length === 1) {
    return {
      worked: true, extra: false, arrival, departure, lunch: false,
      lunchStart: fallback.lunchStart ?? d.lunchStart, lunchEnd: fallback.lunchEnd ?? d.lunchEnd,
    };
  }
  // 3 créneaux ou plus : impossible à saisir, mais possible à importer. On
  // retient le PLUS GRAND trou comme pause et on signale (`extra`) que
  // l'enregistrement ramènera le jour à deux créneaux — plutôt que de perdre
  // les créneaux surnuméraires en silence, comme le faisait l'ancien éditeur.
  let gap = -1, at = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const g = toMin(b[i + 1][0]) - toMin(b[i][1]);
    if (g > gap) { gap = g; at = i; }
  }
  return {
    worked: true, extra: b.length > 2, arrival, departure, lunch: true,
    lunchStart: b[at][1], lunchEnd: b[at + 1][0],
  };
}

/**
 * Valide une saisie de journée. Renvoie `null` si elle est bonne, sinon une
 * **raison** — comme `addBreak` : un message unique pour cinq causes n'aide
 * personne à se corriger.
 */
export function validateDay(day) {
  if (!day || !day.worked) return null;
  if (!HHMM.test(day.arrival) || !HHMM.test(day.departure)) return "invalid";
  if (toMin(day.departure) <= toMin(day.arrival)) return "order";
  if (!day.lunch) return null;
  if (!HHMM.test(day.lunchStart) || !HHMM.test(day.lunchEnd)) return "invalid";
  if (toMin(day.lunchEnd) <= toMin(day.lunchStart)) return "lunch-order";
  if (toMin(day.lunchStart) <= toMin(day.arrival) || toMin(day.lunchEnd) >= toMin(day.departure)) {
    return "lunch-outside";
  }
  return null;
}

function cloneBreaks(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeBreak).filter(Boolean).slice(0, REMINDER_MAX);
}

/**
 * Libellé d'un motif hors tâche, normalisé : espaces repliés, borné, `""` s'il
 * ne reste rien. C'est ce que porte le segment — en clair, pas un identifiant.
 */
export function normalizeOffLabel(label) {
  return String(label ?? "").replace(/\s+/g, " ").trim().slice(0, OFF_LABEL_MAX).trim();
}

/**
 * Clé de regroupement d'un motif : « Pause », « pause » et «  PAUSE  » sont le
 * même vide. Une seule définition, lue par les totaux, les Stats et la
 * détection de doublon des épinglés — sans quoi ils divergeraient.
 */
export function offKey(label) {
  return normalizeOffLabel(label).toLowerCase();
}

/** Copie défensive de la liste des motifs épinglés : normalisés, dédoublonnés, bornés. */
function cloneOffReasons(list) {
  if (!Array.isArray(list)) return [];
  const out = [], seen = new Set();
  for (const raw of list) {
    const label = normalizeOffLabel(raw);
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= OFF_REASON_MAX) break;
  }
  return out;
}

/**
 * Réglages de l'application.
 *
 * Horaires sur 3 niveaux (du plus général au plus spécifique) :
 *   1. base        — une arrivée, un départ, et une pause déjeuner **ou non**
 *                    (`lunch`), appliquée aux `workDays` ;
 *   2. par jour de semaine — `weekdayHours[isoDow]` remplace la base ;
 *   3. par date    — `dateHours["YYYY-MM-DD"]` remplace tout.
 * Un planning est une liste de créneaux `[["HH:MM","HH:MM"], …]` ; `[]` = non
 * travaillé. On ne stocke que les exceptions → format léger.
 *
 * Une PÉRIODE n'est pas un 4ᵉ niveau : c'est une écriture en lot dans
 * `dateHours` (`setDateRange`) et un regroupement à l'affichage (`dateGroups`).
 * `blocksFor` — donc tout `TimeCalculator` — n'en sait rien.
 */
export class Settings {
  constructor(data = {}) {
    const d = DEFAULT_SETTINGS;
    this.appName = data.appName ?? d.appName;
    this.theme = data.theme ?? d.theme;
    this.workDays = Array.isArray(data.workDays) ? [...data.workDays] : [...d.workDays];
    this.arrival = data.arrival ?? d.arrival;
    this.departure = data.departure ?? d.departure;
    this.lunchStart = data.lunchStart ?? d.lunchStart;
    this.lunchEnd = data.lunchEnd ?? d.lunchEnd;
    // Reprise d'un stockage v10, où « pas de pause » ne pouvait s'encoder qu'en
    // collant les deux bornes : on le relit en `lunch: false` plutôt que de
    // faire réapparaître une case cochée. Local au champ et idempotent — d'où
    // sa place ici et non dans `Store.#migrate`.
    this.lunch = data.lunch ?? toMin(this.lunchEnd) > toMin(this.lunchStart);
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
    this.segments = {
      mergeGapMin: clampMergeGap(data.segments?.mergeGapMin ?? d.segments.mergeGapMin),
      minMin: clampMinSegment(data.segments?.minMin ?? d.segments.minMin),
    };
    // `??` et non `||` : une liste VIDÉE par l'utilisateur reste vide, seuls
    // l'absence (stockage < v13) et le null retombent sur les défauts.
    this.offReasons = cloneOffReasons(data.offReasons ?? d.offReasons);
  }

  /** Le motif est-il épinglé ? (comparaison par clé, cf. `offKey`) */
  isPinnedOff(label) {
    const key = offKey(label);
    return key !== "" && this.offReasons.some((r) => offKey(r) === key);
  }

  /**
   * Épingle un motif. Renvoie le libellé normalisé, ou une **raison** d'échec
   * (`"invalid"`, `"duplicate"`, `"full"`), comme `addBreak`.
   */
  addOffReason(label) {
    const clean = normalizeOffLabel(label);
    if (!clean) return "invalid";
    if (this.isPinnedOff(clean)) return "duplicate";
    if (this.offReasons.length >= OFF_REASON_MAX) return "full";
    this.offReasons.push(clean);
    return clean;
  }

  /** Retire un motif épinglé. L'historique n'est pas touché : ses segments deviennent « exceptionnels ». */
  removeOffReason(label) {
    const key = offKey(label);
    this.offReasons = this.offReasons.filter((r) => offKey(r) !== key);
  }

  /** Seuil de fusion des micro-pauses, en millisecondes (0 = jamais). */
  mergeGapMs() {
    return clampMergeGap(this.segments.mergeGapMin) * 60_000;
  }

  /** Durée sous laquelle le chrono jette un segment, en millisecondes (0 = tout garder). */
  minSegmentMs() {
    return clampMinSegment(this.segments.minMin) * 60_000;
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
   * Ajoute un rappel — ou remplace celui dont on donne l'`id` (édition).
   *
   * Renvoie l'entrée normalisée, ou une **raison** d'échec : la vue doit pouvoir
   * dire laquelle des trois s'est produite. Un message unique pour trois causes
   * n'aide personne à corriger sa saisie.
   * @returns {object | "invalid" | "full" | "duplicate"}
   */
  addBreak(entry) {
    const item = normalizeBreak(entry);
    if (!item) return "invalid";
    const at = this.reminders.breaks.findIndex((b) => b.id === item.id);
    // Deux rappels au même instant, c'est deux notifications qui se remplacent :
    // la seconde efface la première, et l'on n'en voit qu'une pour deux lignes.
    const clash = this.reminders.breaks.some(
      (b, i) => i !== at && b.time === item.time && b.date === item.date);
    if (clash) return "duplicate";
    if (at >= 0) this.reminders.breaks[at] = item;
    else if (this.reminders.breaks.length >= REMINDER_MAX) return "full";
    else this.reminders.breaks.push(item);
    this.reminders.breaks.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
    return item;
  }

  /** Retire un rappel par son identifiant. */
  removeBreak(id) {
    this.reminders.breaks = this.reminders.breaks.filter((b) => b.id !== id);
  }

  /** Le rappel d'identifiant donné, ou `null`. */
  breakById(id) {
    return this.reminders.breaks.find((b) => b.id === id) || null;
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

  /** Créneaux de la base : arrivée → départ, coupés par la pause si elle existe. */
  baseBlocks() {
    if (!HHMM.test(this.arrival) || !HHMM.test(this.departure)) return [];
    if (toMin(this.departure) <= toMin(this.arrival)) return [];
    if (!this.lunch) return [[this.arrival, this.departure]];
    // Une pause absurde (hors de la journée, ou fin avant début) est ignorée :
    // on rend la journée entière plutôt que de l'amputer en silence.
    const ok = HHMM.test(this.lunchStart) && HHMM.test(this.lunchEnd) &&
      toMin(this.arrival) < toMin(this.lunchStart) &&
      toMin(this.lunchStart) <= toMin(this.lunchEnd) &&
      toMin(this.lunchEnd) < toMin(this.departure);
    if (!ok) return [[this.arrival, this.departure]];
    return mergeBlocks([[this.arrival, this.lunchStart], [this.lunchEnd, this.departure]]);
  }

  /**
   * Le planning d'une date **sans** le niveau date : jour de semaine, sinon base.
   * C'est ce que lisent `setDateRange` (quels jours sauter) et `dateGroups`
   * (quels trous enjamber) — elles ne peuvent pas consulter `dateHours`, qu'elles
   * sont justement en train d'écrire ou de relire.
   */
  scheduleFor(date) {
    const dow = isoDow(date);
    if (this.weekdayHours[dow]) return this.weekdayHours[dow];
    if (this.workDays.includes(dow)) return this.baseBlocks();
    return [];
  }

  /** Planning effectif d'une date : date > jour de semaine > base. */
  blocksFor(date) {
    const key = fmtDateInput(date);
    if (this.dateHours[key]) return this.dateHours[key];
    return this.scheduleFor(date);
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

  /**
   * Pose (ou retire) un planning sur une **plage de dates**, bornes comprises.
   * `toKey` vide vaut `fromKey`. Renvoie le nombre de dates écrites, ou une
   * **raison** : `"invalid"`, `"range"` (plage inversée), `"too-long"`, `"full"`,
   * `"empty"` (aucun jour travaillé dans la plage).
   *
   * Les jours que la base et `weekdayHours` déclarent déjà non travaillés sont
   * **sautés** : poser des congés du lundi au vendredi suivant n'écrit pas les
   * deux samedis. C'est `dateGroups` qui recolle la période à l'affichage.
   *
   * `replacing` = les clés du groupe qu'on est en train de modifier ; celles qui
   * tombent hors de la nouvelle plage sont retirées. Sans ça, ramener « du 10 au
   * 21 » à « du 10 au 15 » ne rétrécirait pas la période : il la dédoublerait.
   */
  setDateRange(fromKey, toKey, blocks, { replacing = [] } = {}) {
    const from = String(fromKey || "");
    const to = String(toKey || "") || from;
    if (!DATE_KEY.test(from) || !DATE_KEY.test(to)) return "invalid";
    if (to < from) return "range";
    if (countDays(from, to) > DATE_RANGE_MAX_DAYS) return "too-long";

    const keys = eachDateKey(from, to);
    const removing = replacing.filter((k) => k < from || k > to);

    if (blocks == null) {
      for (const k of keys) delete this.dateHours[k];
      for (const k of removing) delete this.dateHours[k];
      return keys.length;
    }

    // Seuls les jours ouvrés du planning sous-jacent reçoivent l'exception.
    const targets = keys.filter((k) => this.scheduleFor(parseDateInput(k)).length > 0);
    if (targets.length === 0) return "empty";
    const after = new Set(Object.keys(this.dateHours));
    for (const k of removing) after.delete(k);
    for (const k of targets) after.add(k);
    if (after.size > DATE_HOURS_MAX) return "full";

    for (const k of removing) delete this.dateHours[k];
    // Copie PAR CLÉ : `blocksFor` rend le tableau stocké par référence, écrire la
    // même instance dans douze dates ferait de toute retouche une retouche à douze.
    for (const k of targets) this.dateHours[k] = blocks.map((pair) => [pair[0], pair[1]]);
    return targets.length;
  }

  /** Retire un lot de dates. Renvoie le nombre de clés effectivement supprimées. */
  removeDateRange(keys) {
    let n = 0;
    for (const k of keys || []) {
      if (this.dateHours[k]) { delete this.dateHours[k]; n++; }
    }
    return n;
  }

  /**
   * Les exceptions de date regroupées en périodes, pour l'affichage. **Pure.**
   *
   * Deux dates au planning identique appartiennent au même groupe si toutes les
   * dates entre elles sont non travaillées par ailleurs (`scheduleFor` vide) et
   * sans exception propre : c'est ce qui fait qu'une période de deux semaines
   * s'affiche en une ligne et non en trois, alors que les week-ends ne sont pas
   * écrits. Un jour travaillé sans exception, ou une exception au planning
   * différent, coupe le groupe.
   *
   * Renvoie `[{ from, to, keys, blocks }]`, trié chronologiquement.
   */
  dateGroups() {
    const sig = (b) => (b || []).map((p) => p.join("-")).join("|");
    const all = Object.keys(this.dateHours).sort();
    const groups = [];
    for (const key of all) {
      const last = groups[groups.length - 1];
      let joins = false;
      if (last && sig(last.blocks) === sig(this.dateHours[key])) {
        joins = true;
        // Tout ce qui sépare les deux dates doit être un jour qu'on ne travaille
        // pas de toute façon, et qui ne porte pas d'exception à lui.
        const between = eachDateKey(last.to, key).slice(1, -1);
        for (const mid of between) {
          if (this.dateHours[mid] || this.scheduleFor(parseDateInput(mid)).length > 0) {
            joins = false;
            break;
          }
        }
      }
      if (joins) { last.to = key; last.keys.push(key); }
      else groups.push({ from: key, to: key, keys: [key], blocks: this.dateHours[key] });
    }
    return groups;
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
      departure: this.departure,
      lunch: this.lunch,
      lunchStart: this.lunchStart,
      lunchEnd: this.lunchEnd,
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
      segments: { ...this.segments },
      offReasons: [...this.offReasons],
    };
  }
}
