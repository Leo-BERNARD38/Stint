import { DAY_MS } from "../core/constants.js";
import { startOfDay, atTime, sameDay } from "../utils/datetime.js";
import { overlap, unionIntervals, subtractIntervals } from "../utils/intervals.js";

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

  /** Durée ouvrée (ms) d'un intervalle, jour par jour (gère le multi-jours). */
  workedMs(startMs, endMs) {
    if (endMs <= startMs) return 0;
    let total = 0;
    let cursor = startOfDay(new Date(startMs)).getTime();
    const guard = startOfDay(new Date(endMs)).getTime();
    let safety = 0;
    while (cursor <= guard && safety < 400) {
      for (const [rs, re] of this.workRangesForDay(new Date(cursor))) {
        total += overlap(startMs, endMs, rs, re);
      }
      cursor += DAY_MS;
      safety += 1;
    }
    return total;
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

  /** Agrégats d'une journée : total, par type, par tâche. */
  totalsForDay(day) {
    const segs = this.store.segmentsForDay(day);
    const ds = startOfDay(day).getTime();
    const de = ds + DAY_MS;
    const byType = { dev: 0, support: 0, autre: 0 };
    const byTask = new Map();
    let total = 0;
    for (const seg of segs) {
      const ms = this.segmentMs(seg, ds, de);
      total += ms;
      byTask.set(seg.taskId, (byTask.get(seg.taskId) ?? 0) + ms);
      const type = this.store.taskById(seg.taskId)?.type ?? "autre";
      byType[type] = (byType[type] ?? 0) + ms;
    }
    return { total, byType, byTask, segments: segs };
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
