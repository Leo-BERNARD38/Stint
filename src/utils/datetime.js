/**
 * Aides date/heure. Tout passe par des `Date` locales ; la sérialisation
 * conserve l'offset (ISO local) pour rester lisible et fidèle au fuseau.
 */
export const pad2 = (n) => String(n).padStart(2, "0");

/** Capitalise la première lettre (libellés de dates `toLocaleDateString`). */
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Convertit "HH:MM" en minutes depuis minuit. */
export function toMin(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Minuit local du jour de `d` (nouvelle Date). */
export function startOfDay(d) {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

/** `d` décalée de `n` jours CALENDAIRES (par `setDate` : juste aux changements d'heure, contrairement à `+ DAY_MS`). */
export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Jour ISO : 1 = lundi … 7 = dimanche. */
export function isoDow(d) {
  const g = d.getDay();
  return g === 0 ? 7 : g;
}

/** `true` si `a` et `b` tombent le même jour local. */
export function sameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/** Date `dayDate` ramenée à l'heure "HH:MM". */
export function atTime(dayDate, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(dayDate);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Heure locale « HH:MM ». */
export function fmtClock(d) {
  return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
}

/** Clé de jour « YYYY-MM-DD » (valeur d'un <input type="date">, clé de `dateHours`). */
export function fmtDateInput(d) {
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

/** Inverse de `fmtDateInput` : minuit LOCAL du jour « YYYY-MM-DD ». */
export function parseDateInput(str) {
  const [y, m, dd] = str.split("-").map(Number);
  return new Date(y, m - 1, dd);
}

/** Valeur d'un <input type="datetime-local"> : "YYYY-MM-DDTHH:MM". */
export function fmtDateTimeLocal(d) {
  return fmtDateInput(d) + "T" + fmtClock(d);
}

/** Inverse de `fmtDateTimeLocal` : « YYYY-MM-DDTHH:MM » en Date locale. */
export function parseDateTimeLocal(str) {
  const [datePart, timePart] = String(str).split("T");
  const [y, m, dd] = datePart.split("-").map(Number);
  const [h, mi] = (timePart || "00:00").split(":").map(Number);
  return new Date(y, m - 1, dd, h, mi, 0, 0);
}

/** Sérialise une `Date` en ISO local avec offset, ex. 2026-06-03T09:12:00+02:00. */
export function toLocalISO(d) {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  return (
    d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) +
    "T" + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds()) +
    sign + pad2(Math.floor(abs / 60)) + ":" + pad2(abs % 60)
  );
}

/** Date longue française : « mardi 13 octobre 2026 ». */
export function formatLongDate(d) {
  return d.toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

/**
 * Numéro de semaine ISO 8601 (1..53). Convention : la semaine 1 est celle qui
 * contient le premier jeudi de l'année. On se déplace donc au jeudi de la
 * semaine visée, puis on compte les semaines depuis le 1ᵉʳ janvier de SON année
 * (une date de fin décembre peut appartenir à la semaine 1 de l'année suivante).
 */
export function isoWeek(d) {
  const thu = startOfDay(d);
  thu.setDate(thu.getDate() + (4 - isoDow(thu)));
  const jan1 = new Date(thu.getFullYear(), 0, 1);
  return Math.round((thu - jan1) / 604800000) + 1;
}

/** Lundi de la semaine ISO contenant `d` (minuit local). */
export function mondayOf(d) {
  return addDays(startOfDay(d), -(isoDow(d) - 1));
}

/**
 * Nombre de jours d'une plage de dates, bornes comprises.
 *
 * **`Math.round`, pas `Math.floor`** : `parseDateInput` rend des minuits
 * *locaux*, et une plage qui enjambe un changement d'heure ne fait pas un
 * nombre entier de jours de 24 h. Du 25 au 31 mars 2026 vaut 5,958 jours —
 * `floor` répondrait 6, il y en a 7.
 */
export function countDays(fromKey, toKey) {
  const a = parseDateInput(fromKey), b = parseDateInput(toKey);
  return Math.round((b - a) / 86400000) + 1;
}

/**
 * Les clés "YYYY-MM-DD" d'une plage, bornes comprises. L'itération passe par
 * `addDays` (donc `setDate`), **jamais** par `+= DAY_MS` : c'est la même raison
 * que ci-dessus, et un pas de 24 h dériverait au changement d'heure.
 */
export function eachDateKey(fromKey, toKey) {
  const out = [];
  const end = parseDateInput(toKey).getTime();
  let d = parseDateInput(fromKey);
  while (d.getTime() <= end) {
    out.push(fmtDateInput(d));
    d = addDays(d, 1);
  }
  return out;
}

/** Date courte d'une clé "YYYY-MM-DD" : « lun. 10 août 2026 ». */
export function formatDateShort(key) {
  return parseDateInput(key).toLocaleDateString("fr-FR", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

/**
 * Libellé d'une plage : « du lun. 10 au ven. 21 août 2026 ». On ne répète que
 * ce qui diffère — mois et année sortent à la fin quand ils sont communs, sinon
 * une ligne de liste devient illisible à force de redites.
 */
export function formatDateRange(fromKey, toKey) {
  if (!toKey || toKey === fromKey) return formatDateShort(fromKey);
  const a = parseDateInput(fromKey), b = parseDateInput(toKey);
  const fr = (d, o) => d.toLocaleDateString("fr-FR", o);
  const sameYear = a.getFullYear() === b.getFullYear();
  const sameMonth = sameYear && a.getMonth() === b.getMonth();
  const left = sameMonth
    ? fr(a, { weekday: "short", day: "numeric" })
    : sameYear
      ? fr(a, { weekday: "short", day: "numeric", month: "short" })
      : formatDateShort(fromKey);
  return `du ${left} au ${formatDateShort(toKey)}`;
}

/**
 * Une durée tapée → minutes (fractionnaires si des secondes sont saisies),
 * `null` si rien ne se lit. LA grammaire de toute l'app : popover de la
 * Saisie, convertisseur des Outils. Deux parseurs avaient divergé — « 90 » y
 * valait 90 minutes d'un côté, 90 heures de l'autre, « 1h30 » ne passait que
 * dans l'un.
 *
 * - horloge : « 1:30 », « 1:30:15 » (minutes et secondes sur deux chiffres :
 *   « 1:5 » est ambigu, donc refusé) ;
 * - unités : « 1h30 », « 1h 30m », « 45m », « 90 min », « 30s », « 2d 3h »,
 *   « 1w », « 1j » — `w`/`d` (`sem`/`j`) suivent les unités Jira passées en
 *   option, sans elles ils ne se lisent pas ;
 * - nombre seul, virgule ou point : des HEURES (« 1.5 » = 1:30). C'est le
 *   format décimal que l'app copie elle-même : ce qu'elle écrit, elle doit
 *   pouvoir le relire.
 *
 * @param {string} text
 * @param {{ hoursPerDay?: number, daysPerWeek?: number }} [jira]
 */
export function parseDuration(text, { hoursPerDay, daysPerWeek } = {}) {
  const s = String(text ?? "").trim().toLowerCase().replace(/,/g, ".").replace(/\s+/g, " ");
  if (!s) return null;
  let m = s.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (m) return +m[2] < 60 && (m[3] == null || +m[3] < 60) ? +m[1] * 60 + +m[2] + (m[3] ? +m[3] / 60 : 0) : null;
  if (/^\d+(\.\d+)?$/.test(s)) return +s * 60;
  const perUnit = {
    w: hoursPerDay && daysPerWeek ? hoursPerDay * daysPerWeek * 60 : null,
    d: hoursPerDay ? hoursPerDay * 60 : null,
    h: 60, m: 1, s: 1 / 60,
  };
  const alias = { sem: "w", j: "d", min: "m", mn: "m", sec: "s" };
  const re = /(\d+(?:\.\d+)?) ?(sem|min|mn|sec|w|d|j|h|m|s)?/y;
  let total = 0, i = 0, last = null;
  while (i < s.length) {
    if (s[i] === " ") { i++; continue; }
    re.lastIndex = i;
    m = re.exec(s);
    if (!m) return null;
    let unit = m[2] ? (alias[m[2]] ?? m[2]) : null;
    // « 1h30 » : un nombre sans unité APRÈS des heures, ce sont des minutes.
    if (!unit) { if (last !== "h" || re.lastIndex !== s.length) return null; unit = "m"; }
    if (perUnit[unit] == null) return null;
    total += +m[1] * perUnit[unit];
    last = unit;
    i = re.lastIndex;
  }
  return last ? total : null;
}
