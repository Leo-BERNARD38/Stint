import { DAY_MS } from "../core/constants.js";
import { startOfDay, atTime, sameDay } from "../utils/datetime.js";
import { intersect, unionIntervals, subtractIntervals } from "../utils/intervals.js";
import { offKey } from "../models/Settings.js";

/**
 * Calcule les durées ouvrées et les agrégats journaliers à partir des
 * segments et des réglages (§9.1). Lit toujours `store.settings` en direct.
 */
export class TimeCalculator {
  constructor(store) {
    this.store = store;
  }

  get settings() {
    return this.store.settings;
  }

  /** Plages ouvrées (en ms) d'un jour selon le planning résolu (base/jour/date). */
  workRangesForDay(day) {
    return this.settings.blocksFor(day)
      .map(([a, b]) => [atTime(day, a).getTime(), atTime(day, b).getTime()])
      .filter(([a, b]) => b > a);
  }

  /**
   * Portions ouvrées d'un intervalle, jour par jour (gère le multi-jours).
   * Renvoie les plages effectivement comptées, bornées à [startMs, endMs] :
   * c'est la matière du calcul de durée comme de son dessin (ruban brut/net
   * des Outils), et il n'y a donc qu'une seule règle à maintenir.
   */
  workRangesBetween(startMs, endMs) {
    if (endMs <= startMs) return [];
    const out = [];
    let cursor = startOfDay(new Date(startMs)).getTime();
    const guard = startOfDay(new Date(endMs)).getTime();
    let safety = 0;
    while (cursor <= guard && safety < 400) {
      for (const [rs, re] of this.workRangesForDay(new Date(cursor))) {
        const part = intersect(rs, re, startMs, endMs);
        if (part) out.push(part);
      }
      cursor += DAY_MS;
      safety += 1;
    }
    return out;
  }

  /** Durée ouvrée (ms) d'un intervalle. */
  workedMs(startMs, endMs) {
    return this.workRangesBetween(startMs, endMs).reduce((t, [a, b]) => t + (b - a), 0);
  }

  /** Durée planifiée (ms) d'une journée : la somme de ses plages ouvrées. */
  plannedMsForDay(day) {
    return this.workRangesForDay(day).reduce((t, [a, b]) => t + (b - a), 0);
  }

  /**
   * Minutes-équivalent (ms) comptées pour un segment, éventuellement bornées
   * à [clampS, clampE]. `raw` ⇒ temps réel sans rognage ; sinon temps ouvré.
   */
  segmentMs(seg, clampS = null, clampE = null) {
    let s = seg.startMs();
    let e = seg.endMs();
    if (clampS != null) s = Math.max(s, clampS);
    if (clampE != null) e = Math.min(e, clampE);
    if (e <= s) return 0;
    return seg.raw ? e - s : this.workedMs(s, e);
  }

  /**
   * Temps total (ms) d'une tâche, tous segments confondus (brut/net respecté).
   * Bornes optionnelles [clampS, clampE] pour ne compter qu'une fenêtre (période).
   */
  taskTotalMs(taskId, clampS = null, clampE = null) {
    let total = 0;
    for (const seg of this.store.segments) {
      if (seg.taskId === taskId) total += this.segmentMs(seg, clampS, clampE);
    }
    return total;
  }

  /**
   * Agrégats d'une journée : total, par type, par tâche.
   *
   * `rounded` ⇒ chaque **total de tâche** est arrondi au pas configuré (§ réglage
   * « Arrondi »), puis le total du jour et la ventilation par type sont
   * recalculés depuis ces valeurs arrondies : ce qu'on lit reste la somme de ce
   * qu'on reporte, ligne par ligne. On arrondit bien la tâche à la journée, et
   * non chaque segment (des segments arrondis séparément dérivent vite).
   */
  totalsForDay(day, rounded = false) {
    const raw = this.#rawTotalsForDay(day);
    if (!rounded || !this.settings.roundingMinutes()) return raw;

    const byTask = new Map();
    const byType = { dev: 0, support: 0, autre: 0 };
    let total = 0;
    for (const [taskId, ms] of raw.byTask) {
      const roundedMs = this.settings.roundMinutes(ms / 60000) * 60000;
      byTask.set(taskId, roundedMs);
      total += roundedMs;
      const type = this.store.taskById(taskId)?.type ?? "autre";
      byType[type] = (byType[type] ?? 0) + roundedMs;
    }
    // Le hors tâche n'est jamais arrondi : rien à reporter dans Jira.
    return { total, byType, byTask, segments: raw.segments, rounded: true, off: raw.off };
  }

  /**
   * Totaux bruts du jour. Les vides justifiés (`seg.isOff`) sortent de
   * `total` / `byType` / `byTask` — ce n'est pas du travail — et alimentent
   * `off = { total, byReason }`, regroupés par clé de motif (cf. `offKey`) en
   * gardant la première graphie rencontrée comme libellé.
   */
  #rawTotalsForDay(day) {
    const segs = this.store.segmentsForDay(day);
    const ds = startOfDay(day).getTime();
    const de = ds + DAY_MS;
    const byType = { dev: 0, support: 0, autre: 0 };
    const byTask = new Map();
    const off = { total: 0, byReason: new Map() };
    let total = 0;
    for (const seg of segs) {
      const ms = this.segmentMs(seg, ds, de);
      if (seg.isOff) {
        off.total += ms;
        const key = offKey(seg.reason);
        const cur = off.byReason.get(key) ?? { label: seg.reason, ms: 0 };
        cur.ms += ms;
        off.byReason.set(key, cur);
        continue;
      }
      total += ms;
      byTask.set(seg.taskId, (byTask.get(seg.taskId) ?? 0) + ms);
      const type = this.store.taskById(seg.taskId)?.type ?? "autre";
      byType[type] = (byType[type] ?? 0) + ms;
    }
    return { total, byType, byTask, segments: segs, rounded: false, off };
  }

  /**
   * Couverture du jour, en une seule définition : ce qui est tracé (travail,
   * arrondi ou non selon la vue), ce qui est justifié (hors tâche, jamais
   * arrondi) et ce qui était planifié. Un vide justifié n'est plus un manque,
   * il compte donc dans la couverture — mais pas dans le travaillé.
   */
  coverageForDay(day, rounded = false) {
    const t = this.totalsForDay(day, rounded);
    return { workedMs: t.total, offMs: t.off.total, plannedMs: this.plannedMsForDay(day) };
  }

  /** Fenêtre d'affichage de la timeline (plages ouvrées, élargies si débordement). */
  timelineWindow(day) {
    const ds = startOfDay(day).getTime();
    const de = ds + DAY_MS;
    const ranges = this.workRangesForDay(day);
    let start, end;
    if (ranges.length) {
      start = ranges[0][0];
      end = ranges[ranges.length - 1][1];
    } else {
      start = atTime(day, this.settings.arrival).getTime();
      end = atTime(day, this.settings.departure).getTime();
    }
    for (const seg of this.store.segmentsForDay(day)) {
      start = Math.min(start, Math.max(seg.startMs(), ds));
      end = Math.max(end, Math.min(seg.endMs(), de));
    }
    if (end <= start) end = start + 3_600_000;
    return { start, end };
  }

  /** Trous (≥ 5 min, DS §7.4) dans les plages ouvrées non couverts par un segment. */
  gapsForDay(day) {
    const ds = startOfDay(day).getTime();
    const de = ds + DAY_MS;
    const covered = unionIntervals(
      this.store.segmentsForDay(day).map((s) => [Math.max(s.startMs(), ds), Math.min(s.endMs(), de)])
    );
    const nowCap = sameDay(day, new Date()) ? Date.now() : Infinity;
    const gaps = [];
    for (const [rs, re] of this.workRangesForDay(day)) {
      for (const [gs, ge] of subtractIntervals([rs, re], covered)) {
        const end = Math.min(ge, nowCap);
        if (end - gs >= 300_000) gaps.push([gs, end]);
      }
    }
    return gaps;
  }
}
