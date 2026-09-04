/**
 * Un segment horodaté (début → fin). Deux natures, jamais les deux à la fois :
 *   - rattaché à une **tâche** (`taskId`) : du temps de travail, compté partout ;
 *   - **hors tâche** (`reason`, un libellé) : un vide justifié — pause café,
 *     réunion, papotage. Il explique un trou de la journée (il compte dans la
 *     couverture) mais n'est ni du travail, ni du Jira, ni une tâche.
 * La durée n'est jamais stockée : elle se dérive toujours des timestamps,
 * ce qui garantit une reconstruction fiable après veille / fermeture d'onglet.
 *
 * `startMs`/`endMs` sont appelés dans toutes les boucles de calcul (agrégats,
 * timelines) : le parsing ISO est mémoïsé, et `start`/`end` sont des accesseurs
 * pour invalider le cache à chaque écriture.
 */
export class Segment {
  #start;          // ISO local
  #end;            // ISO local | null (en cours)
  #startMs = null; // timestamps mémoïsés (invalidés par les setters)
  #endMs = null;

  constructor({ id, taskId = null, reason = null, start, end = null, raw = false }) {
    this.id = id;
    // Invariant : une tâche OU un motif. Un motif posé l'emporte, la tâche tombe.
    const off = typeof reason === "string" && reason.trim() !== "";
    this.reason = off ? reason.trim() : null;
    this.taskId = off ? null : (taskId ?? null);
    this.start = start;
    this.end = end;
    this.raw = raw;     // true = temps brut (sans rognage ouvré)
  }

  static fromJSON(o) {
    return new Segment(o);
  }

  get start() { return this.#start; }
  set start(v) { this.#start = v; this.#startMs = null; }

  get end() { return this.#end; }
  set end(v) { this.#end = v; this.#endMs = null; }

  get isRunning() {
    return !this.#end;
  }

  /** Vide justifié (hors tâche) ? */
  get isOff() {
    return this.reason != null;
  }

  startMs() {
    if (this.#startMs === null) this.#startMs = new Date(this.#start).getTime();
    return this.#startMs;
  }

  /** Fin en ms ; pour un segment en cours, utilise `now`. */
  endMs(now = Date.now()) {
    if (!this.#end) return now;
    if (this.#endMs === null) this.#endMs = new Date(this.#end).getTime();
    return this.#endMs;
  }

  toJSON() {
    return {
      id: this.id,
      taskId: this.taskId,
      reason: this.reason,
      start: this.#start,
      end: this.#end,
      raw: this.raw,
    };
  }
}
