/**
 * Opérations sur des intervalles temporels `[start, end]` (en ms).
 * Utilisées pour le temps ouvré (intersection) et le temps non tracé.
 */

/** Longueur du chevauchement entre [aS,aE] et [bS,bE] (0 si disjoints). */
export function overlap(aStart, aEnd, bStart, bEnd) {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

/** Fusionne une liste d'intervalles en intervalles disjoints triés. */
export function unionIntervals(intervals) {
  const sorted = intervals.filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [s, e] of sorted) {
    const last = out[out.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

/** Retire de `range` les intervalles `subtract`, renvoie les morceaux restants. */
export function subtractIntervals(range, subtract) {
  let parts = [range.slice()];
  for (const [ss, se] of subtract) {
    const next = [];
    for (const [s, e] of parts) {
      if (se <= s || ss >= e) { next.push([s, e]); continue; }
      if (ss > s) next.push([s, ss]);
      if (se < e) next.push([se, e]);
    }
    parts = next;
  }
  return parts.filter(([s, e]) => e > s);
}

/**
 * Découpe [s, e] en morceaux ordonnés `[from, to, counted]` selon les plages
 * ouvrées `ranges` : `counted=true` quand le morceau tombe dans une plage
 * (temps compté en net), `false` sinon (hors horaires, non compté). Sert à
 * estomper visuellement ce qui n'est pas comptabilisé dans un segment net.
 */
export function workedParts(s, e, ranges) {
  const out = [];
  let cursor = s;
  for (const [rs, re] of [...ranges].sort((a, b) => a[0] - b[0])) {
    if (re <= s || rs >= e) continue;
    const cs = Math.max(rs, s), ce = Math.min(re, e);
    if (cs > cursor) out.push([cursor, cs, false]);
    out.push([cs, ce, true]);
    cursor = ce;
  }
  if (cursor < e) out.push([cursor, e, false]);
  return out;
}

