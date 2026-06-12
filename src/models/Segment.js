/**
 * Un segment de travail horodaté (début → fin), rattaché à une tâche.
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

  constructor({ id, taskId, start, end = null, raw = false }) {
    this.id = id;
    this.taskId = taskId;
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
      start: this.#start,
      end: this.#end,
      raw: this.raw,
    };
  }
}
