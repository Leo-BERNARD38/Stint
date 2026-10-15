import { TASK_TYPES } from "../core/constants.js";
import { addDays, fmtDateInput, isoDow, isoWeek, mondayOf, startOfDay } from "../utils/datetime.js";

/** Tolérance des comparaisons en minutes flottantes (le réel vient de ms). */
const EPS = 1e-6;

/**
 * SAISIE LISSÉE (§17) : passer de ce qu'on a POINTÉ à ce qu'on DÉCLARE dans Jira.
 *
 * La règle, jour après jour, du lundi au dimanche :
 *   1. chaque jour travaillé vise le « 1d » Jira (`jiraDayMinutes`, 7 h), quels
 *      que soient ses horaires — un vendredi de 4 h 10 se déclare 7 h ; un jour
 *      non travaillé vise 0 ;
 *   2. le pointé du jour est celui de la vue arrondie de JOURNÉE : chaque tâche
 *      au bloc de son type, au plus proche (`totalsForDay(day, true)`, une tâche
 *      dev de moins de 15 min y vaut 0). Ce que Journée affiche est exactement
 *      ce que la Saisie répartit — un premier jet partait des minutes exactes et
 *      arrondissait vers le bas : une tâche de 28 min (0:30 dans Journée)
 *      disparaissait alors dans des miettes invisibles de la réserve ;
 *   3. chaque tâche a une **cagnotte** = sa réserve des jours précédents + son
 *      pointé arrondi du jour (hors tâche exclu : ce n'est pas du travail). Le
 *      jour propose **tout son pointé, sans le couper** : au-delà de la cible
 *      il est en DÉPASSEMENT (rouge), et c'est l'utilisateur qui choisit quoi
 *      réduire — « je préfère ramener à 7 h moi-même, savoir quoi couper ».
 *      Couper d'office suivait l'ordre des segments, donc tombait sur la
 *      dernière tâche de la journée, qui n'était pas forcément la bonne ;
 *   4. un jour COURT prend dans la réserve (la plus ancienne d'abord), par
 *      blocs entiers, jusqu'à la cible ; ce qui n'est pas déclaré (réduit à la
 *      main) reste en **réserve**, attaché à sa tâche — reporter, pour Jira,
 *      c'est logguer MOD-123 un autre jour ;
 *   5. ce qui manque à la cible reste un **vide** que l'utilisateur comble à la
 *      main (aucune tâche bouche-trou n'est inventée).
 *
 * Aujourd'hui d'abord, réserve ensuite : le travail d'un jour reste déclaré à sa
 * date, et seul ce qu'on réduit glisse. L'ordre inverse décalait toute la
 * semaine d'un cran.
 *
 * Ce qu'on touche est **fixé case par case**, jamais le jour entier (cf.
 * `TimesheetLines`) : les cases fixées passent d'abord, le reste du jour reste
 * une proposition qui suit le pointage, dans ce qui reste de la cible. Figer le
 * jour au premier geste envoyait en réserve tout ce qu'on pointait ensuite —
 * « ça part en réserve alors que je ne suis pas à 7 h ». La réserve tient
 * compte des cases fixées (cagnotte − déclaré, éventuellement négative : du
 * temps déclaré d'avance sur une tâche). Un jour **à venir** ne propose rien :
 * il ne doit pas aspirer une réserve que la journée d'aujourd'hui n'a pas
 * encore fini de remplir. La réserve repart de zéro chaque semaine.
 *
 * Service pur : il lit le Store et le calculateur, ne mute rien.
 */
export class Timesheet {
  constructor(store, calc) {
    this.store = store;
    this.calc = calc;
  }

  get settings() { return this.store.settings; }

  /** Bloc de saisie (minutes) d'une tâche, selon son type. */
  stepFor(taskId) {
    const type = this.store.taskById(taskId)?.type;
    return this.settings.timesheetStep(TASK_TYPES.includes(type) ? type : "autre");
  }

  /** Cible d'un jour travaillé, en minutes : le « 1d » Jira (réglages › Jira). */
  dayTarget() {
    return Math.round(this.settings.jiraDayMinutes());
  }

  /** Cible d'un jour, en minutes : le « 1d » Jira s'il est travaillé, 0 sinon. */
  targetFor(date) {
    return this.settings.blocksFor(date).length > 0 ? this.dayTarget() : 0;
  }

  /**
   * Pointé du jour par tâche, en minutes, ARRONDI comme dans Journée (bloc du
   * type, au plus proche ; une tâche arrondie à 0 n'y figure pas), dans l'ordre du premier segment
   * de chaque tâche. Le hors tâche n'y est pas (`totalsForDay`).
   */
  #realFor(date) {
    const { byTask } = this.calc.totalsForDay(date, true);
    const first = new Map();
    for (const s of this.store.segmentsForDay(date)) {
      if (!byTask.has(s.taskId)) continue;
      const cur = first.get(s.taskId);
      if (cur == null || s.startMs() < cur) first.set(s.taskId, s.startMs());
    }
    const ids = [...byTask.keys()].filter((id) => byTask.get(id) > 0)
      .sort((a, b) => (first.get(a) ?? 0) - (first.get(b) ?? 0));
    return new Map(ids.map((id) => [id, byTask.get(id) / 60000]));
  }

  /**
   * La semaine (lundi → dimanche) qui contient `ref`. Renvoie :
   *   { monday, key, label, sub, current, workedDays, days[], reserve[], totals }
   * avec pour chaque jour :
   *   { key, date, dow, target, real, lines[{taskId,min,done,pinned}], pins,
   *     declared, done, gap, over, touched, future, today, worked, leave, visible }
   * où `pins` = les cases fixées stockées (retraits compris) et `pinned` dit
   * d'une ligne qu'elle est fixée (sinon : proposée, elle suit le pointage).
   * et `reserve` = [{ taskId, min }], la réserve À CE JOUR, en blocs entiers du
   * type de la tâche. `real` (jour et total) est le pointé ARRONDI de Journée.
   */
  week(ref, now = Date.now()) {
    const monday = mondayOf(new Date(ref));
    const today = startOfDay(new Date(now)).getTime();
    const reserve = new Map(); // taskId → minutes ; l'ordre d'insertion = ancienneté
    const days = [];
    const totals = { target: 0, real: 0, declared: 0, done: 0, reserve: 0, upcoming: 0, over: 0 };

    for (let i = 0; i < 7; i++) {
      const date = addDays(monday, i);
      const key = fmtDateInput(date);
      const dayStart = date.getTime();
      const future = dayStart > today;
      const target = this.targetFor(date);
      const real = future ? new Map() : this.#realFor(date);
      const stored = this.store.timesheetDay(key);

      // Cagnotte du jour : réserve + réel. Une tâche qui retravaille déjà en
      // réserve garde sa place d'ancienneté.
      const pool = new Map(reserve);
      for (const [id, min] of real) pool.set(id, (pool.get(id) ?? 0) + min);

      // Les cases fixées d'abord (retraits exclus), puis la proposition dans ce
      // qui reste de la cible — sans les tâches fixées ou retirées ce jour-là.
      const pins = stored ? stored.map((l) => ({ ...l })) : [];
      const fixed = pins.filter((p) => p.min > 0).map((p) => ({ taskId: p.taskId, min: p.min, done: p.done, pinned: true }));
      const room = target - fixed.reduce((a, l) => a + l.min, 0);
      const skip = new Set(pins.map((p) => p.taskId));
      const lines = future ? fixed : [...fixed, ...this.#propose(pool, real, room, skip)];

      // La réserve après ce jour : cagnotte − déclaré. Une tâche soldée sort de
      // la file et y rentrera en queue (elle redevient la plus récente).
      for (const l of lines) pool.set(l.taskId, (pool.get(l.taskId) ?? 0) - l.min);
      reserve.clear();
      for (const [id, min] of pool) if (Math.abs(min) > EPS) reserve.set(id, min);

      const declared = lines.reduce((a, l) => a + l.min, 0);
      const done = lines.reduce((a, l) => a + (l.done ? l.min : 0), 0);
      const realMin = [...real.values()].reduce((a, m) => a + m, 0);
      const dow = isoDow(date);
      const worked = target > 0;
      days.push({
        key, date, dow, target, real: realMin, lines, pins, declared, done,
        // Un jour à venir ne manque de rien : il n'a pas encore commencé.
        gap: future ? 0 : Math.max(0, target - declared),
        over: Math.max(0, declared - target),
        touched: pins.length > 0, future, today: dayStart === today, worked,
        // Un jour ouvré de semaine qu'une exception par date a vidé : des congés.
        leave: !worked && Array.isArray(this.settings.dateHours[key]),
        // Lundi → vendredi toujours ; le week-end seulement s'il porte quelque chose.
        visible: dow <= 5 || worked || realMin > 0 || lines.length > 0,
      });
      totals.target += target;
      totals.real += realMin;
      totals.declared += declared;
      totals.done += done;
      totals.over += Math.max(0, declared - target);
      if (future) totals.upcoming += Math.max(0, target - declared);
    }

    // La réserve se dit en blocs. Le pointé arrivant arrondi et les retouches
    // étant ramenées au bloc, elle n'en contient déjà que des entiers ; le
    // plancher ne fait que garantir l'affichage (une tâche changée de type en
    // cours de semaine, par exemple).
    const res = [...reserve]
      .map(([taskId, min]) => {
        const step = this.stepFor(taskId);
        return { taskId, min: Math.floor((min + EPS) / step) * step };
      })
      .filter((r) => r.min > 0);
    totals.reserve = res.reduce((a, r) => a + r.min, 0);
    // Ce qui manque aux jours COMMENCÉS : les jours à venir ne sont pas un
    // manque (`upcoming`), on ne peut rien y compléter.
    totals.gap = Math.max(0, totals.target - totals.declared - totals.upcoming);

    const sunday = addDays(monday, 6);
    const fr = (d, o) => d.toLocaleDateString("fr-FR", o);
    const sameMonth = monday.getMonth() === sunday.getMonth();
    return {
      monday,
      key: fmtDateInput(monday),
      label: "S" + isoWeek(monday),
      sub: (sameMonth ? fr(monday, { day: "numeric" }) : fr(monday, { day: "numeric", month: "short" })) +
        " – " + fr(sunday, { day: "numeric", month: "short", year: "numeric" }),
      current: today >= monday.getTime() && today < addDays(monday, 7).getTime(),
      workedDays: days.filter((d) => d.worked).length,
      days,
      reserve: res,
      totals,
    };
  }

  /**
   * Proposition d'un jour : son pointé ENTIER (rien n'est coupé, un dépassement
   * se voit et se réduit à la main), puis — s'il reste de la place sous
   * `target`, ce que les cases fixées laissent de la cible — la réserve, par
   * blocs entiers de son type, la plus ancienne d'abord. Les tâches de `skip`
   * (fixées ou retirées ce jour-là) ne sont pas proposées.
   */
  #propose(pool, real, target, skip = new Set()) {
    const lines = [];
    const byTask = new Map();
    const floor = (m, step) => Math.floor((m + EPS) / step) * step;
    let cap = target;
    for (const [id, min] of real) {
      if (skip.has(id)) continue;
      // Une avance déclarée plus tôt (réserve négative) se reprend ici.
      const take = floor(Math.min(min, pool.get(id) ?? 0), this.stepFor(id));
      if (take <= 0) continue;
      const line = { taskId: id, min: take, done: false, pinned: false };
      lines.push(line);
      byTask.set(id, line);
      cap -= take;
    }
    for (const [id, avail] of pool) {
      if (cap <= 0) break;
      if (skip.has(id)) continue;
      const step = this.stepFor(id);
      const left = avail - (byTask.get(id)?.min ?? 0);
      const take = Math.min(floor(left, step), floor(cap, step));
      if (take <= 0) continue;
      const line = byTask.get(id);
      if (line) line.min += take;
      else lines.push({ taskId: id, min: take, done: false, pinned: false });
      cap -= take;
    }
    return lines;
  }
}
