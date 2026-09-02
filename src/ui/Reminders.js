import { atTime, fmtDateInput, fmtClock } from "../utils/datetime.js";

/**
 * Rappels de la journée : pause déjeuner, fin de journée, et les pauses qu'on
 * pose soi-même (« 10:00 pause café », « 14:00 réunion » le 8 septembre).
 *
 * Deux principes, et le second est le plus important :
 *
 *  1. **Midi et la fin de journée ne se saisissent pas, ils se déduisent.**
 *     L'application connaît déjà les horaires résolus du jour
 *     (`Settings.blocksFor`, précédence date > jour de semaine > base) : la
 *     pause déjeuner EST le trou entre deux créneaux, la fin de journée EST la
 *     fin du dernier. Les redemander, c'est se garantir qu'un jour ils diront
 *     autre chose que le planning — et c'est le planning qui a raison.
 *  2. **Un rappel est un repère, pas une coupure.** Rien n'est retranché du
 *     temps ouvré : `workRangesForDay`, `gapsForDay` et les durées ne bougent
 *     pas. Retrancher une pause café la transformerait mécaniquement en « temps
 *     non tracé » à combler dans la timeline, ce qui n'a aucun sens.
 *
 * Comme `EyeBreak`, le module tient **sa propre boucle** d'une seconde et
 * compare à l'**horloge murale**. Il ne peut pas se brancher sur le `Timer` de
 * l'app : `App.#onTick()` sort immédiatement si l'onglet est caché **ou si
 * aucun chrono ne tourne** — or « fin de journée » doit précisément tomber
 * quand plus rien ne tourne.
 *
 * Rien n'est persisté : les échéances déjà tirées vivent en mémoire, le temps
 * d'une journée. Un rechargement peut donc re-sonner un rappel de la minute
 * précédente — c'est le bon compromis face à l'alternative, qui serait
 * d'écrire dans le stockage à chaque rappel.
 */
export class Reminders {
  static TAG = "stint-reminder";
  /** Au-delà, l'échéance est périmée : machine en veille, onglet gelé, page
   *  rouverte le soir. On solde sans notifier plutôt que de tirer une rafale de
   *  rappels que personne n'a manqués — ils n'ont jamais été attendus. */
  static GRACE_MS = 300_000;

  constructor(app) {
    this.app = app;
    this.handle = null;
    this.fired = new Set();  // clés "YYYY-MM-DD|id" déjà déclenchées
    this.day = "";           // jour couvert par `fired`
  }

  /** Démarre la boucle (une seule fois, au démarrage de l'app). */
  start() {
    if (this.handle) return;
    // On adopte les échéances déjà passées du jour SANS les tirer : ouvrir Stint
    // à 15 h ne doit pas déclencher la pause de 10 h.
    this.#reset(fmtDateInput(new Date()), Date.now());
    this.handle = setInterval(() => this.tick(), 1000);
  }

  /**
   * Occurrences d'une date, triées. **Pure** : aucun effet, aucun DOM — c'est
   * elle que lisent la timeline, les réglages et la boucle.
   * Renvoie `[{ id, kind, label, at }]`, `at` en millisecondes.
   */
  occurrencesFor(date) {
    const s = this.app.store.settings;
    const ranges = this.app.calc.workRangesForDay(date);
    const key = fmtDateInput(date);
    const out = [];

    // La pause déjeuner est le PREMIER trou entre deux créneaux — pas
    // `settings.lunchStart`, qui n'existe que pour fabriquer les créneaux de
    // base et qui est ignoré dès qu'une exception s'applique.
    if (s.reminders.lunch && ranges.length > 1) {
      out.push({ id: "lunch", kind: "lunch", label: "Pause déjeuner", at: ranges[0][1] });
    }
    if (s.reminders.dayEnd && ranges.length) {
      out.push({ id: "dayEnd", kind: "dayEnd", label: "Fin de journée", at: ranges[ranges.length - 1][1] });
    }
    for (const b of s.reminders.breaks) {
      // Datée : ce jour-là seulement. Sinon : les jours travaillés, tels que
      // les horaires les définissent (exceptions comprises).
      if (b.date ? b.date !== key : ranges.length === 0) continue;
      out.push({ id: b.id, kind: "break", label: b.label, at: atTime(date, b.time).getTime() });
    }
    return out.sort((a, b) => a.at - b.at);
  }

  /** Un pas de la boucle : notifie les échéances du jour qui viennent d'échoir. */
  tick() {
    const now = Date.now();
    const today = new Date(now);
    const key = fmtDateInput(today);
    // Passage de minuit : on repart d'une ardoise propre, et l'on adopte tout ce
    // qui serait déjà passé (rien, à minuit — mais la règle vaut aussi au
    // premier tour, cf. `start()`).
    if (key !== this.day) this.#reset(key, now);

    for (const occ of this.occurrencesFor(today)) {
      const k = key + "|" + occ.id;
      if (this.fired.has(k)) continue;
      if (now < occ.at) continue;
      this.fired.add(k);
      if (now - occ.at > Reminders.GRACE_MS) continue;   // périmée : soldée, pas sonnée
      this.notify(occ);
    }
  }

  /** Marque comme déjà tirées toutes les échéances antérieures à `now`. */
  #reset(key, now) {
    this.day = key;
    this.fired = new Set();
    for (const occ of this.occurrencesFor(new Date(now))) {
      if (occ.at <= now) this.fired.add(key + "|" + occ.id);
    }
  }

  /** Notification système si possible, toast sinon (cf. `Notifier`). */
  notify(occ) {
    return this.app.notifier.send(occ.label, "Il est " + fmtClock(new Date(occ.at)) + ".", Reminders.TAG);
  }

  /** Bouton « Tester » des réglages. */
  test() {
    return this.app.notifier.send("Pause café", "Il est " + fmtClock(new Date()) + ".", Reminders.TAG);
  }
}
