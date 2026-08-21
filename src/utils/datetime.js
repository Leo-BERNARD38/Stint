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

export function startOfDay(d) {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

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

export function fmtClock(d) {
  return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
}

export function fmtDateInput(d) {
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

export function parseDateInput(str) {
  const [y, m, dd] = str.split("-").map(Number);
  return new Date(y, m - 1, dd);
}

/** Valeur d'un <input type="datetime-local"> : "YYYY-MM-DDTHH:MM". */
export function fmtDateTimeLocal(d) {
  return fmtDateInput(d) + "T" + fmtClock(d);
}

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
