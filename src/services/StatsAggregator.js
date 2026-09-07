import { DAY_MS, TASK_TYPES } from "../core/constants.js";
import { offKey } from "../models/Settings.js";
import { unionIntervals, subtractIntervals } from "../utils/intervals.js";
import {
  startOfDay, addDays, isoWeek, mondayOf, fmtDateInput, cap,
} from "../utils/datetime.js";

/**
 * Les quatre grains de l'onglet Stats. Ce sont des **périodes calendaires
 * nommées** — S37, septembre 2026, T3 2026, 2026 — et non des fenêtres
 * glissantes : on débriefe « la semaine », pas « les 28 derniers jours ».
 * Une fenêtre glissante n'a pas de nom, donc pas de voisine : impossible de
 * dire « + 6 % par rapport à S36 » quand la référence bouge avec l'horloge.
 */
export const STATS_GRAINS = [
  { key: "week", label: "Semaine" },
  { key: "month", label: "Mois" },
  { key: "quarter", label: "Trimestre" },
  { key: "year", label: "Année" },
];

/** Au-delà, la vue « Continuité » ferait une ligne par jour sur un mètre. */
export const CONTINUITY_MAX_DAYS = 45;

const emptyByType = () => ({ dev: 0, support: 0, autre: 0 });

// Formateurs mémoïsés : un historique de 12 ans balaie plus de 4000 jours.
const FMT_MONTH_LONG = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const FMT_MONTH_SHORT = new Intl.DateTimeFormat("fr-FR", { month: "short" });
const FMT_DAY_LONG = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const FMT_DM = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const FMT_DMY = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

const noDot = (s) => s.replace(/\./g, "");

/**
 * Début de la période calendaire contenant `date`, à minuit **local**.
 *
 * Tout passe par `new Date(y, m, d)` ou `addDays` (donc `setDate`) : jamais
 * d'arithmétique en millisecondes. Un trimestre qui enjambe le changement
 * d'heure ne fait pas un nombre entier de journées de 24 h — cf. CLAUDE.md §11.
 */
export function periodStart(grain, date) {
  const d = startOfDay(date);
  if (grain === "week") return mondayOf(d);
  if (grain === "month") return new Date(d.getFullYear(), d.getMonth(), 1);
  if (grain === "quarter") return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
  return new Date(d.getFullYear(), 0, 1);
}

/** Décale un **début de période** de `n` périodes (n négatif = vers le passé). */
export function stepPeriod(grain, startDate, n) {
  const y = startDate.getFullYear(), m = startDate.getMonth();
  if (grain === "week") return addDays(startDate, 7 * n);
  if (grain === "month") return new Date(y, m + n, 1);
  if (grain === "quarter") return new Date(y, m + 3 * n, 1);
  return new Date(y + n, 0, 1);
}

/** Nom court de la période : « S37 », « Septembre 2026 », « T3 2026 », « 2026 ». */
function periodLabel(grain, start) {
  if (grain === "week") return "S" + isoWeek(start);
  if (grain === "month") return cap(FMT_MONTH_LONG.format(start));
  if (grain === "quarter") return `T${Math.floor(start.getMonth() / 3) + 1} ${start.getFullYear()}`;
  return String(start.getFullYear());
}

/** Nom encore plus court, pour un axe de graphique. */
function tickLabel(grain, start) {
  if (grain === "week") return "S" + isoWeek(start);
  if (grain === "month") return cap(noDot(FMT_MONTH_SHORT.format(start)));
  if (grain === "quarter") return `T${Math.floor(start.getMonth() / 3) + 1}`;
  return String(start.getFullYear());
}

/** Étendue en clair : « 8 – 14 sept. 2026 ». Bornes **incluses**. */
function spanLabel(start, lastDay) {
  const sameMonth = start.getFullYear() === lastDay.getFullYear()
    && start.getMonth() === lastDay.getMonth();
  const left = sameMonth ? String(start.getDate()) : noDot(FMT_DM.format(start));
  return `${left} – ${noDot(FMT_DMY.format(lastDay))}`;
}

/**
 * Agrégats rétrospectifs de l'onglet Stats : la période choisie, son historique
 * de contexte, son découpage interne, ses tâches et ses indicateurs.
 *
 * Une seule agrégation sert **toutes** les vues Stats : `snapshot(grain, ref)`
 * renvoie un objet mémoïsé sur `store.rev`, sinon chaque bloc rebalaierait
 * l'historique à chaque rendu (`App.render()` tourne à chaque mutation et
 * toutes les 15 s).
 *
 * Tout repose sur `TimeCalculator.segmentMs(seg, from, to)` : c'est lui qui
 * connaît le brut/net et le rognage sur les horaires. Comme le temps compté est
 * additif sur des intervalles disjoints, il suffit d'agréger **par jour** puis
 * de recomposer périodes, historique et découpage — c'est exact, et ça ne
 * balaie l'historique qu'une fois.
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

  /**
   * Bornes de la période calendaire contenant `refMs`, plus celles de la
   * période **précédente de même nature** — S36 avant S37, août avant
   * septembre. C'est ce qui rend l'écart lisible : comparer une semaine aux
   * « sept jours d'avant » n'apprend rien qu'on ne sache déjà.
   */
  range(grain, refMs = Date.now()) {
    const start = periodStart(grain, new Date(refMs));
    const end = stepPeriod(grain, start, 1);
    const prevStart = stepPeriod(grain, start, -1);
    const lastDay = addDays(end, -1);
    return {
      grain,
      start: start.getTime(),
      end: end.getTime(),
      startDate: start,
      prevStart: prevStart.getTime(),
      prevEnd: start.getTime(),
      label: periodLabel(grain, start),
      prevLabel: periodLabel(grain, prevStart),
      sub: spanLabel(start, lastDay),
      /** Vrai si la période contient aujourd'hui (elle est donc incomplète). */
      current: Date.now() >= start.getTime() && Date.now() < end.getTime(),
    };
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
   * période affichée, son historique de 12 périodes et son découpage retombent
   * tous sur les mêmes journées — sans ce cache, un grain « Année » recalculerait
   * chaque jour treize fois.
   */
  #dayStats(dayStart) {
    // L'index d'abord : c'est lui qui vide le cache quand le store a changé.
    const index = this.#dayIndex();
    const cached = this.#dayCache.get(dayStart);
    if (cached) return cached;
    const entry = index.get(fmtDateInput(new Date(dayStart)));
    // `offMs` / `offByReason` : les vides justifiés, à part — ni dans `ms` (ce
    // n'est pas du travail : l'historique et le découpage l'ignorent) ni dans
    // `byTask`. Ils ne servent qu'à la couverture et au bloc Hors tâche.
    const out = {
      ms: 0, byType: emptyByType(), byTask: new Map(),
      offMs: 0, offByReason: new Map(), covered: [],
    };
    if (!entry) { this.#dayCache.set(dayStart, out); return out; }
    // `addDays`, jamais `+ DAY_MS` : le 25 octobre dure 25 h en Europe, et
    // `dayStart + DAY_MS` tombait alors à 23:00 **du même jour** — la dernière
    // heure de la journée n'appartenait à aucun jour et disparaissait des
    // totaux. Le 29 mars (23 h), la même borne mordait sur le lendemain.
    const dayEnd = addDays(new Date(dayStart), 1).getTime();
    const spans = [];
    for (const seg of entry.segs) {
      const ms = this.calc.segmentMs(seg, dayStart, dayEnd);
      // L'empreinte du segment sur la journée, indépendamment de ce qu'il
      // *compte* : c'est elle qui dit ce qui reste à combler.
      const a = Math.max(seg.startMs(), dayStart), b = Math.min(seg.endMs(), dayEnd);
      if (b > a) spans.push([a, b]);
      if (ms <= 0) continue;
      if (seg.isOff) {
        out.offMs += ms;
        const key = offKey(seg.reason);
        const cur = out.offByReason.get(key) ?? { label: seg.reason, ms: 0 };
        cur.ms += ms;
        out.offByReason.set(key, cur);
        continue;
      }
      out.ms += ms;
      const type = this.store.taskById(seg.taskId)?.type ?? "autre";
      out.byType[type] = (out.byType[type] ?? 0) + ms;
      out.byTask.set(seg.taskId, (out.byTask.get(seg.taskId) ?? 0) + ms);
    }
    out.covered = unionIntervals(spans);
    // Un segment en cours grandit sans muter le store : ce jour-là n'est pas
    // mémoïsable (le cache du snapshot, lui, tourne à la minute).
    if (!entry.segs.some((seg) => seg.isRunning)) this.#dayCache.set(dayStart, out);
    return out;
  }

  /**
   * Une entrée par jour de `[from, to[`, jours vides compris — ils portent la
   * journée planifiée, donc la couverture et le temps non tracé.
   *
   * `plannedMs` = la journée planifiée **entière** ; `scheduledMs` s'arrête à
   * maintenant. C'est `scheduledMs` qui sert de dénominateur : sinon la journée
   * en cours ferait chuter la couverture toute la matinée, et l'après-midi pas
   * encore vécu compterait comme « non tracé ».
   */
  #daysBetween(from, to) {
    const now = Date.now();
    const days = [];
    for (let t = from; t < to; t = addDays(new Date(t), 1).getTime()) {
      const date = new Date(t);
      const stats = this.#dayStats(t);
      const ranges = this.calc.workRangesForDay(date);
      let plannedMs = 0, scheduledMs = 0, untrackedMs = 0;
      for (const [rs, re] of ranges) {
        plannedMs += re - rs;
        const cap = Math.min(re, now);
        if (cap <= rs) continue;
        scheduledMs += cap - rs;
        // Le manque se MESURE, il ne se déduit pas : c'est la part d'horaire
        // écoulé qu'aucun segment ne recouvre. Une soustraction
        // (`horaire − compté`) mentirait dès que deux segments se chevauchent
        // ou qu'un segment brut déborde — et surtout elle ne désignerait pas
        // la même matière que le bouton « Combler », qui lui part de la
        // géométrie. Deux définitions du vide seraient pires que pas de barre.
        for (const [gs, ge] of subtractIntervals([rs, cap], stats.covered)) {
          untrackedMs += ge - gs;
        }
      }
      days.push({
        key: fmtDateInput(date), date, start: t,
        end: addDays(date, 1).getTime(),
        ms: stats.ms, byType: stats.byType, byTask: stats.byTask,
        offMs: stats.offMs, offByReason: stats.offByReason, covered: stats.covered,
        ranges, plannedMs, scheduledMs, untrackedMs, isWorkDay: ranges.length > 0,
      });
    }
    return days;
  }

  /** Somme des agrégats d'une liste de jours. Base de tout ce qui suit. */
  #fold(days) {
    const byType = emptyByType();
    const byTask = new Map();
    let ms = 0, offMs = 0, untrackedMs = 0, scheduledMs = 0, activeDays = 0, workDays = 0;
    for (const d of days) {
      ms += d.ms;
      offMs += d.offMs;
      untrackedMs += d.untrackedMs;
      scheduledMs += d.scheduledMs;
      if (d.ms > 0) activeDays += 1;
      if (d.isWorkDay) workDays += 1;
      for (const t of TASK_TYPES) byType[t] += d.byType[t] ?? 0;
      for (const [taskId, v] of d.byTask) byTask.set(taskId, (byTask.get(taskId) ?? 0) + v);
    }
    return {
      ms, byType, byTask, offMs, untrackedMs, scheduledMs, activeDays, workDays,
      avgPerActiveDay: activeDays ? ms / activeDays : 0,
    };
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

  /**
   * L'agrégat de la période affichée. `history()` et `subPeriods()` sont des
   * dérivés **paresseux et mémoïsés sur l'objet** : la tête de période n'a
   * besoin ni de l'un ni de l'autre, et le bloc Détail n'a pas besoin de
   * l'historique — on ne paie que ce qui est à l'écran.
   */
  snapshot(grain, refMs = Date.now()) {
    const start = periodStart(grain, new Date(refMs)).getTime();
    const end = stepPeriod(grain, new Date(start), 1).getTime();
    const now = Date.now();
    // La composante « minute » suit la PÉRIODE COURANTE, pas un chrono qui
    // tourne : `scheduledMs` et le temps non tracé s'écoulent avec l'horloge
    // même quand rien ne tourne — sans quoi la couverture du jour resterait
    // figée jusqu'à la prochaine mutation. Corollaire heureux : une période
    // passée se met en cache sans composante temporelle, et feuilleter
    // l'historique ne recalcule plus rien.
    const live = now >= start && now < end;
    const cacheKey = `${grain}|${start}|${this.store.rev}|${live ? Math.floor(now / 60000) : ""}`;
    if (this.#cache && this.#cache.key === cacheKey) return this.#cache.data;
    const data = this.#build(grain, start);
    this.#cache = { key: cacheKey, data };
    return data;
  }

  #build(grain, refMs) {
    const range = this.range(grain, refMs);
    const days = this.#daysBetween(range.start, range.end);
    const fold = this.#fold(days);

    const snapshot = {
      range,
      days,
      byTask: this.#tasksOf(fold.byTask, fold.ms),
      kpi: this.#kpi(days, fold, range),
      history: (count = 12) => {
        snapshot._hist ??= {};
        return (snapshot._hist[count] ??= this.#history(grain, range.start, count));
      },
      subPeriods: () => (snapshot._subs ??= this.#subPeriods(grain, days)),
    };
    return snapshot;
  }

  /* ----------------- historique de contexte ----------------- */

  /**
   * Les `count` dernières périodes de même grain, la courante en dernier.
   *
   * C'est ce qui remplace l'ancien sélecteur de granularité du graphique : le
   * contexte suit la période au lieu d'être choisi à part. Sur S37 on voit les
   * douze dernières semaines, sur septembre les douze derniers mois — et il n'y
   * a plus qu'une seule navigation temporelle dans tout l'onglet.
   */
  #history(grain, startMs, count) {
    const out = [];
    for (let i = count - 1; i >= 0; i--) {
      const start = stepPeriod(grain, new Date(startMs), -i);
      const end = stepPeriod(grain, start, 1);
      const fold = this.#fold(this.#daysBetween(start.getTime(), end.getTime()));
      out.push({
        key: fmtDateInput(start),
        refMs: start.getTime(),
        start: start.getTime(),
        end: end.getTime(),
        label: tickLabel(grain, start),
        sub: periodLabel(grain, start),
        span: spanLabel(start, addDays(end, -1)),
        ms: fold.ms,
        byType: fold.byType,
        activeDays: fold.activeDays,
        current: i === 0,
      });
    }
    return out;
  }

  /* ----------------- découpage interne ----------------- */

  /**
   * Le découpage de la période, l'unité dérivée du grain : une semaine se lit
   * en jours, un mois en semaines, un trimestre et une année en mois.
   *
   * Les tranches sont **bornées à la période** : la somme de leurs totaux vaut
   * donc toujours celui de la période (le temps compté est additif sur des
   * jours disjoints). C'est aussi pourquoi elles ne portent pas d'écart — une
   * semaine coupée par le début du mois donnerait un « -60 % » mensonger.
   */
  #subPeriods(grain, days) {
    const unit = grain === "week" ? "day" : grain === "month" ? "week" : "month";
    const out = [];
    let current = null;
    for (const day of days) {
      const id = unit === "day" ? day.key
        : unit === "week" ? fmtDateInput(mondayOf(day.date))
          : `${day.date.getFullYear()}-${day.date.getMonth()}`;
      if (!current || current.id !== id) {
        current = { id, unit, start: day.start, end: day.end, days: [], fullDays: this.#fullDays(unit, day.date) };
        Object.assign(current, this.#subLabels(unit, day.date));
        out.push(current);
      }
      current.end = day.end;
      current.days.push(day);
    }
    return out.map((slot) => {
      const fold = this.#fold(slot.days);
      return {
        key: slot.id, unit, start: slot.start, end: slot.end,
        label: slot.label,
        // Le sous-titre dit l'étendue RÉELLE de la tranche, pas celle de la
        // semaine ou du mois dont elle est le morceau : la première semaine de
        // septembre n'y compte que du 1er au 6, et annoncer « 31 août – 6 sept »
        // sous un total qui ne contient pas le 31 août serait un mensonge.
        // (Un jour n'a pas d'étendue : il garde son nom complet.)
        sub: unit === "day" ? slot.sub
          : spanLabel(new Date(slot.start), slot.days[slot.days.length - 1].date),
        partial: slot.days.length < slot.fullDays,
        ms: fold.ms, byType: fold.byType, offMs: fold.offMs,
        activeDays: fold.activeDays, avgPerActiveDay: fold.avgPerActiveDay,
        tasks: this.#tasksOf(fold.byTask, fold.ms),
      };
    });
  }

  /** Jours qu'aurait la tranche entière : sert à repérer celles que la période coupe. */
  #fullDays(unit, date) {
    if (unit === "day") return 1;
    if (unit === "week") return 7;
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  #subLabels(unit, date) {
    if (unit === "day") {
      return {
        label: cap(date.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", ""))
          + " " + date.getDate(),
        sub: cap(FMT_DAY_LONG.format(date)),
      };
    }
    if (unit === "week") {
      const monday = mondayOf(date);
      return { label: "S" + isoWeek(monday), sub: spanLabel(monday, addDays(monday, 6)) };
    }
    return {
      label: cap(noDot(FMT_MONTH_SHORT.format(date))),
      sub: cap(FMT_MONTH_LONG.format(date)),
    };
  }

  /* ----------------- répartitions ----------------- */

  #tasksOf(byTask, total) {
    return [...byTask.entries()]
      .map(([id, ms]) => ({ task: this.store.taskById(id), ms, share: total > 0 ? ms / total : 0 }))
      .filter((r) => r.ms > 0)
      .sort((a, b) => b.ms - a.ms);
  }

  /* ----------------- indicateurs ----------------- */

  #kpi(days, fold, range) {
    const prevTotal = this.#totalBetween(range.prevStart, range.prevEnd);
    // Hors tâche sur la période : total, et une ligne par motif (clé `offKey`),
    // triées par durée décroissante. La partition épinglés / exceptionnels se
    // fait au rendu, d'après les réglages du moment : retirer un épinglé le
    // fait basculer dans « exceptionnels » sans rien recalculer.
    const offMap = new Map();
    for (const d of days) {
      for (const [key, { label, ms }] of d.offByReason) {
        const cur = offMap.get(key) ?? { key, label, ms: 0 };
        cur.ms += ms;
        offMap.set(key, cur);
      }
    }
    const total = fold.ms;
    return {
      total,
      byType: fold.byType,
      prevTotal,
      offMs: fold.offMs,
      offByReason: [...offMap.values()].sort((a, b) => b.ms - a.ms),
      untrackedMs: fold.untrackedMs,
      deltaMs: total - prevTotal,
      deltaPct: prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null,
      activeDays: fold.activeDays,
      workDays: fold.workDays,
      avgPerActiveDay: fold.avgPerActiveDay,
      scheduledMs: fold.scheduledMs,
      // Un vide justifié n'est plus un manque : il compte dans la couverture.
      coveragePct: fold.scheduledMs > 0 ? ((total + fold.offMs) / fold.scheduledMs) * 100 : null,
    };
  }
}
