import { TASK_TYPES } from "../core/constants.js";
import { addDays, fmtDateInput, isoDow, isoWeek, mondayOf, startOfDay } from "../utils/datetime.js";

/** Tolérance des comparaisons en minutes flottantes (le réel vient de ms). */
const EPS = 1e-6;

/**
 * SAISIE LISSÉE (§17) : passer de ce qu'on a POINTÉ à ce qu'on DÉCLARE dans Jira.
 *
 * La règle, jour après jour, du lundi au dimanche :
 *   1. chaque jour travaillé vise `dayMin` (7 h), quels que soient ses horaires
 *      — un vendredi de 4 h 10 se déclare 7 h ; un jour non travaillé vise 0 ;
 *   2. chaque tâche a une **cagnotte** = sa réserve des jours précédents + son
 *      réel du jour (hors tâche exclu : ce n'est pas du travail) ;
 *   3. on déclare par **blocs du type** (dev 30 min, support et autre 15),
 *      arrondis vers le BAS, dans l'ordre : les tâches du jour d'abord (par
 *      premier segment), puis la réserve (la plus ancienne d'abord), jusqu'à la
 *      cible ;
 *   4. ce qui n'est pas déclaré reste en **réserve**, attaché à sa tâche —
 *      reporter, pour Jira, c'est logguer MOD-123 un autre jour ;
 *   5. ce qui manque à la cible reste un **vide** que l'utilisateur comble à la
 *      main (aucune tâche bouche-trou n'est inventée).
 *
 * Aujourd'hui d'abord, réserve ensuite : le travail d'un jour reste déclaré à sa
 * date tant qu'il tient, et seul le surplus glisse. L'ordre inverse décalait
 * toute la semaine d'un cran.
 *
 * Un jour **figé** (coché, retouché) garde ses lignes stockées ; la réserve en
 * tient compte (cagnotte − déclaré, éventuellement négative : du temps déclaré
 * d'avance sur une tâche). Un jour **à venir** ne propose rien : il ne doit pas
 * aspirer une réserve que la journée d'aujourd'hui n'a pas encore fini de
 * remplir. La réserve repart de zéro chaque semaine.
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

  /** Cible d'un jour, en minutes : `dayMin` s'il est travaillé, 0 sinon. */
  targetFor(date) {
    return this.settings.blocksFor(date).length > 0 ? this.settings.timesheet.dayMin : 0;
  }

  /**
   * Réel du jour par tâche, en minutes (flottantes), dans l'ordre du premier
   * segment de chaque tâche. Le hors tâche n'y est pas (`totalsForDay`).
   */
  #realFor(date) {
    const { byTask } = this.calc.totalsForDay(date);
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
   *   { key, date, dow, target, real, lines[{taskId,min,done}], declared, done,
   *     gap, over, frozen, future, today, worked, leave, visible }
   * et `reserve` = [{ taskId, min }] (positif, ≥ 1 min), la réserve À CE JOUR.
   */
  week(ref, now = Date.now()) {
    const monday = mondayOf(new Date(ref));
    const today = startOfDay(new Date(now)).getTime();
    const reserve = new Map(); // taskId → minutes ; l'ordre d'insertion = ancienneté
    const days = [];
    const totals = { target: 0, real: 0, declared: 0, done: 0, reserve: 0 };

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

      let lines;
      if (stored) lines = stored.map((l) => ({ ...l }));
      else if (future) lines = [];
      else lines = this.#propose(pool, real, target);

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
        key, date, dow, target, real: realMin, lines, declared, done,
        gap: Math.max(0, target - declared),
        over: Math.max(0, declared - target),
        frozen: !!stored, future, today: dayStart === today, worked,
        // Un jour ouvré de semaine qu'une exception par date a vidé : des congés.
        leave: !worked && Array.isArray(this.settings.dateHours[key]),
        // Lundi → vendredi toujours ; le week-end seulement s'il porte quelque chose.
        visible: dow <= 5 || worked || realMin > 0 || lines.length > 0,
      });
      totals.target += target;
      totals.real += realMin;
      totals.declared += declared;
      totals.done += done;
    }

    const res = [...reserve].filter(([, m]) => m >= 1).map(([taskId, min]) => ({ taskId, min: Math.floor(min + EPS) }));
    totals.reserve = res.reduce((a, r) => a + r.min, 0);
    totals.gap = Math.max(0, totals.target - totals.declared);

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
   * Proposition d'un jour non figé : les tâches du jour dans l'ordre, puis la
   * réserve, par blocs entiers de leur type et sans dépasser la cible.
   */
  #propose(pool, real, target) {
    const order = [...real.keys()];
    for (const id of pool.keys()) if (!real.has(id)) order.push(id);
    const lines = [];
    let cap = target;
    for (const id of order) {
      if (cap <= 0) break;
      const avail = pool.get(id) ?? 0;
      if (avail <= 0) continue;
      const step = this.stepFor(id);
      const blocks = Math.floor((avail + EPS) / step) * step;
      const room = Math.floor((cap + EPS) / step) * step;
      const take = Math.min(blocks, room);
      if (take <= 0) continue;
      lines.push({ taskId: id, min: take, done: false });
      cap -= take;
    }
    return lines;
  }
}
