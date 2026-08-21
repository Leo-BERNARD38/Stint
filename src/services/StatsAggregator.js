import { DAY_MS, TASK_TYPES } from "../core/constants.js";
import {
  startOfDay, addDays, isoDow, isoWeek, mondayOf, fmtDateInput, pad2, cap,
} from "../utils/datetime.js";

/** Périodes proposées en tête de l'onglet Stats (fenêtres glissantes). */
export const STATS_PERIODS = [
  { key: "4w", label: "4 semaines", days: 28 },
  { key: "3m", label: "3 mois", months: 3 },
  { key: "12m", label: "12 mois", months: 12 },
  { key: "all", label: "Tout" },
];

const emptyByType = () => ({ dev: 0, support: 0, autre: 0 });

// Formateurs mémoïsés : une série au jour peut compter plus de 1000 tranches.
const FMT_DAY_LONG = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const FMT_MONTH_SHORT = new Intl.DateTimeFormat("fr-FR", { month: "short" });
const FMT_MONTH_LONG = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

/**
 * Agrégats rétrospectifs de l'onglet Stats : séries temporelles par type,
 * récap hebdomadaire, rythme journalier, top tâches et indicateurs.
 *
 * Une seule agrégation sert **toutes** les vues Stats : `snapshot(période)`
 * renvoie un objet mémoïsé sur `store.rev`, sinon chaque bloc rebalaierait
 * l'historique à chaque rendu (`App.render()` tourne à chaque mutation et
 * toutes les 15 s).
 *
 * Tout repose sur `TimeCalculator.segmentMs(seg, from, to)` : c'est lui qui
 * connaît le brut/net et le rognage sur les horaires. Comme le temps compté est
 * additif sur des intervalles disjoints, il suffit d'agréger **par jour** puis
 * de recomposer semaines et mois — c'est exact et ça ne balaie l'historique
 * qu'une fois.
 */
export class StatsAggregator {
  #cache = null;
  #index = null; // { rev, map: Map<"YYYY-MM-DD", { start, segs }> }
  #dayCache = new Map(); // dayStart → agrégats du jour, vidé avec l'index

  constructor(store, calc) {
    this.store = store;
    this.calc = calc;
  }

  /* ----------------- périodes ----------------- */

  /** Bornes de la période choisie + la période précédente de même durée. */
  range(key) {
    const today = startOfDay(new Date());
    const end = addDays(today, 1).getTime(); // demain minuit ⇒ aujourd'hui inclus
    const def = STATS_PERIODS.find((p) => p.key === key) ?? STATS_PERIODS[1];
    let start;
    if (def.days) {
      start = addDays(today, -(def.days - 1)).getTime();
    } else if (def.months) {
      const s = new Date(today);
      s.setMonth(s.getMonth() - def.months);
      start = addDays(s, 1).getTime();
    } else {
      const first = this.store.segments.reduce(
        (min, s) => Math.min(min, s.startMs()), Infinity);
      start = Number.isFinite(first) ? startOfDay(new Date(first)).getTime()
        : addDays(today, -27).getTime();
    }
    if (start >= end) start = addDays(today, -6).getTime();
    const span = end - start;
    return { key: def.key, start, end, prevStart: start - span, prevEnd: start, label: def.label };
  }

  /* ----------------- index par jour (mémoïsé) ----------------- */

  /**
   * Segments indexés par jour couvert (un segment de nuit apparaît dans les
   * deux jours). Évite de refiltrer `store.segments` pour chaque journée.
   */
  #dayIndex() {
    if (this.#index && this.#index.rev === this.store.rev) return this.#index.map;
    const map = new Map();
    for (const seg of this.store.segments) {
      let cursor = startOfDay(new Date(seg.startMs()));
      const last = startOfDay(new Date(seg.endMs())).getTime();
      let guard = 0;
      while (cursor.getTime() <= last && guard < 400) {
        const key = fmtDateInput(cursor);
        let entry = map.get(key);
        if (!entry) { entry = { start: cursor.getTime(), segs: [] }; map.set(key, entry); }
        entry.segs.push(seg);
        cursor = addDays(cursor, 1);
        guard += 1;
      }
    }
    this.#index = { rev: this.store.rev, map };
    this.#dayCache.clear();
    return map;
  }

  /**
   * Agrégats d'un jour (ms, par type, par tâche) depuis l'index. Mémoïsé : la
   * construction du snapshot, le récap hebdo et la série en cours retombent tous
   * sur les mêmes journées.
   */
  #dayStats(dayStart) {
    // L'index d'abord : c'est lui qui vide le cache quand le store a changé.
    const index = this.#dayIndex();
    const cached = this.#dayCache.get(dayStart);
    if (cached) return cached;
    const entry = index.get(fmtDateInput(new Date(dayStart)));
    const out = { ms: 0, byType: emptyByType(), byTask: new Map() };
    if (!entry) { this.#dayCache.set(dayStart, out); return out; }
    const dayEnd = dayStart + DAY_MS;
    for (const seg of entry.segs) {
      const ms = this.calc.segmentMs(seg, dayStart, dayEnd);
      if (ms <= 0) continue;
      out.ms += ms;
      const type = this.store.taskById(seg.taskId)?.type ?? "autre";
      out.byType[type] = (out.byType[type] ?? 0) + ms;
      out.byTask.set(seg.taskId, (out.byTask.get(seg.taskId) ?? 0) + ms);
    }
    // Un segment en cours grandit sans muter le store : ce jour-là n'est pas
    // mémoïsable (le cache du snapshot, lui, tourne à la minute).
    if (!entry.segs.some((seg) => seg.isRunning)) this.#dayCache.set(dayStart, out);
    return out;
  }

  /** Total compté sur une fenêtre quelconque, sans construire de jours vides. */
  #totalBetween(from, to) {
    let total = 0;
    for (const { start } of this.#dayIndex().values()) {
      if (start >= to || start + DAY_MS <= from) continue;
      total += this.#dayStats(start).ms;
    }
    return total;
  }

  /* ----------------- snapshot ----------------- */

  snapshot(key) {
    const running = this.store.segments.some((s) => s.isRunning);
    // Un segment en cours grandit sans muter le store : on rafraîchit à la minute.
    const cacheKey = `${key}|${this.store.rev}|${running ? Math.floor(Date.now() / 60000) : ""}`;
    if (this.#cache && this.#cache.key === cacheKey) return this.#cache.data;
    const data = this.#build(key);
    this.#cache = { key: cacheKey, data };
    return data;
  }

  #build(key) {
    const range = this.range(key);
    const now = Date.now();

    // --- une entrée par jour de la période (les jours vides comptent : rythme,
    // jours ouvrés, couverture) ---
    const days = [];
    const byTask = new Map();
    for (let t = range.start; t < range.end; t = addDays(new Date(t), 1).getTime()) {
      const date = new Date(t);
      const stats = this.#dayStats(t);
      const ranges = this.calc.workRangesForDay(date);
      // `plannedMs` = la journée planifiée entière (référence d'intensité du
      // rythme) ; `scheduledMs` s'arrête à maintenant (base de la couverture,
      // sinon la journée en cours ferait toujours chuter le pourcentage).
      let plannedMs = 0, scheduledMs = 0;
      for (const [rs, re] of ranges) {
        plannedMs += re - rs;
        scheduledMs += Math.max(0, Math.min(re, now) - rs);
      }
      for (const [taskId, ms] of stats.byTask) byTask.set(taskId, (byTask.get(taskId) ?? 0) + ms);
      days.push({
        key: fmtDateInput(date), date, start: t, end: t + DAY_MS,
        ms: stats.ms, byType: stats.byType, byTask: stats.byTask,
        plannedMs, scheduledMs, isWorkDay: ranges.length > 0,
      });
    }

    const total = days.reduce((a, d) => a + d.ms, 0);
    const snapshot = {
      range,
      days,
      weeks: this.#weeks(range),
      byTask: this.#topTasks(byTask, total),
      byWeekday: this.#byWeekday(days),
      kpi: this.#kpi(days, total, range),
      maxDayMs: days.reduce((m, d) => Math.max(m, d.ms), 0),
      series: (grain) => {
        snapshot._series ??= {};
        return (snapshot._series[grain] ??= this.#series(days, grain));
      },
    };
    return snapshot;
  }

  /* ----------------- séries temporelles ----------------- */

  /**
   * Recompose les jours en tranches jour / semaine / mois. Le temps compté
   * étant additif sur des jours disjoints, la somme des tranches vaut toujours
   * le total de la période — pas de double comptage possible.
   */
  #series(days, grain) {
    const multiYear = days.length > 0
      && days[0].date.getFullYear() !== days[days.length - 1].date.getFullYear();
    const buckets = [];
    let current = null;
    for (const day of days) {
      const id = grain === "week" ? fmtDateInput(mondayOf(day.date))
        : grain === "month" ? `${day.date.getFullYear()}-${pad2(day.date.getMonth() + 1)}`
          : day.key;
      if (!current || current.id !== id) {
        current = { id, start: day.start, end: day.end, ms: 0, byType: emptyByType(), days: 0, active: 0 };
        Object.assign(current, this.#bucketLabels(day.date, grain, multiYear));
        buckets.push(current);
      }
      current.end = day.end;
      current.ms += day.ms;
      current.days += 1;
      if (day.ms > 0) current.active += 1;
      for (const t of TASK_TYPES) current.byType[t] += day.byType[t] ?? 0;
    }
    const max = buckets.reduce((m, b) => Math.max(m, b.ms), 0);
    const maxType = buckets.reduce(
      (m, b) => Math.max(m, ...TASK_TYPES.map((t) => b.byType[t])), 0);
    return { grain, buckets, max, maxType };
  }

  #bucketLabels(date, grain, multiYear) {
    if (grain === "week") {
      const monday = mondayOf(date);
      const sunday = addDays(monday, 6);
      return {
        label: "S" + isoWeek(monday),
        sub: `${monday.getDate()} – ${sunday.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`,
      };
    }
    if (grain === "month") {
      return {
        label: cap(FMT_MONTH_SHORT.format(date).replace(".", ""))
          + (multiYear ? " " + String(date.getFullYear()).slice(2) : ""),
        sub: cap(FMT_MONTH_LONG.format(date)),
      };
    }
    return {
      label: `${date.getDate()}/${pad2(date.getMonth() + 1)}`,
      sub: cap(FMT_DAY_LONG.format(date)),
    };
  }

  /* ----------------- semaines ----------------- */

  /**
   * Récap hebdomadaire. Les semaines sont calculées **entières** (lundi →
   * dimanche) même quand la période les coupe : un total de semaine tronqué
   * donnerait un écart mensonger. On calcule une semaine de plus en amont, qui
   * ne sert que de base à l'écart de la plus ancienne affichée.
   */
  #weeks(range) {
    const firstMonday = mondayOf(new Date(range.start));
    const lastMonday = mondayOf(new Date(range.end - 1));
    const out = [];
    for (let m = addDays(firstMonday, -7); m.getTime() <= lastMonday.getTime(); m = addDays(m, 7)) {
      const monday = new Date(m);
      let total = 0, activeDays = 0;
      const byType = emptyByType();
      const byTask = new Map();
      for (let i = 0; i < 7; i++) {
        const stats = this.#dayStats(addDays(monday, i).getTime());
        if (stats.ms > 0) activeDays += 1;
        total += stats.ms;
        for (const t of TASK_TYPES) byType[t] += stats.byType[t] ?? 0;
        for (const [taskId, ms] of stats.byTask) byTask.set(taskId, (byTask.get(taskId) ?? 0) + ms);
      }
      const sunday = addDays(monday, 6);
      out.push({
        key: fmtDateInput(monday), monday, total, byType, activeDays,
        label: "S" + isoWeek(monday),
        sub: `${monday.getDate()} – ${sunday.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }).replace(".", "")}`,
        avgPerActiveDay: activeDays ? total / activeDays : 0,
        deltaMs: null, deltaPct: null,
        tasks: [...byTask.entries()]
          .map(([id, ms]) => ({ task: this.store.taskById(id), ms }))
          .filter((r) => r.ms > 0)
          .sort((a, b) => b.ms - a.ms),
      });
    }
    for (let i = 1; i < out.length; i++) {
      const prev = out[i - 1].total;
      out[i].deltaMs = out[i].total - prev;
      out[i].deltaPct = prev > 0 ? ((out[i].total - prev) / prev) * 100 : null;
    }
    return out.slice(1).reverse(); // la plus récente d'abord ; la base d'écart est retirée
  }

  /* ----------------- répartitions ----------------- */

  #topTasks(byTask, total) {
    return [...byTask.entries()]
      .map(([id, ms]) => ({ task: this.store.taskById(id), ms, share: total > 0 ? ms / total : 0 }))
      .filter((r) => r.ms > 0)
      .sort((a, b) => b.ms - a.ms);
  }

  /** Total par jour de semaine, index 0 = lundi (aligné sur `WEEKDAY_LABELS`). */
  #byWeekday(days) {
    const out = [0, 0, 0, 0, 0, 0, 0];
    for (const d of days) out[isoDow(d.date) - 1] += d.ms;
    return out;
  }

  /* ----------------- indicateurs ----------------- */

  #kpi(days, total, range) {
    const active = days.filter((d) => d.ms > 0);
    const elapsedWorkDays = days.filter((d) => d.isWorkDay).length;
    const scheduledMs = days.reduce((a, d) => a + d.scheduledMs, 0);
    const best = active.reduce((b, d) => (b && b.ms >= d.ms ? b : d), null);
    const prevTotal = this.#totalBetween(range.prevStart, range.prevEnd);
    const byType = emptyByType();
    for (const d of days) for (const t of TASK_TYPES) byType[t] += d.byType[t] ?? 0;
    return {
      total, byType, prevTotal,
      deltaMs: total - prevTotal,
      deltaPct: prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null,
      activeDays: active.length,
      workDays: elapsedWorkDays,
      avgPerActiveDay: active.length ? total / active.length : 0,
      bestDay: best ? { key: best.key, date: best.date, ms: best.ms } : null,
      streak: this.#streak(),
      scheduledMs,
      coveragePct: scheduledMs > 0 ? (total / scheduledMs) * 100 : null,
      taskCount: new Set(days.flatMap((d) => [...d.byTask.keys()])).size,
    };
  }

  /**
   * Jours d'affilée avec du temps tracé, en remontant depuis aujourd'hui.
   * Un jour **non travaillé** (week-end, congé : aucun créneau au planning) est
   * neutre — il ne casse pas la série. La journée en cours non plus, tant
   * qu'elle est vide : à 8 h du matin la série d'hier tient toujours.
   *
   * Volontairement indépendant de la période affichée : une série n'a pas de
   * raison de rétrécir parce qu'on est passé de « 12 mois » à « 4 semaines ».
   */
  #streak(maxBack = 400) {
    const today = startOfDay(new Date());
    let streak = 0;
    let i = this.#dayStats(today.getTime()).ms > 0 ? 0 : 1;
    for (; i < maxBack; i++) {
      const date = addDays(today, -i);
      const ms = this.#dayStats(date.getTime()).ms;
      if (ms > 0) { streak += 1; continue; }
      if (this.calc.workRangesForDay(date).length === 0) continue; // jour non travaillé : neutre
      break;
    }
    return streak;
  }
}
