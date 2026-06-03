/**
 * Un segment de travail horodaté (début → fin), rattaché à une tâche.
 * La durée n'est jamais stockée : elle se dérive toujours des timestamps,
 * ce qui garantit une reconstruction fiable après veille / fermeture d'onglet.
 */
export class Segment {
  constructor({ id, taskId, start, end = null, raw = false }) {
    this.id = id;
    this.taskId = taskId;
    this.start = start; // ISO local
    this.end = end;     // ISO local | null (en cours)
    this.raw = raw;     // true = temps brut (sans rognage ouvré)
  }

  static fromJSON(o) {
    return new Segment(o);
  }

  get isRunning() {
    return !this.end;
  }

  startMs() {
    return new Date(this.start).getTime();
  }

  /** Fin en ms ; pour un segment en cours, utilise `now`. */
  endMs(now = Date.now()) {
    return this.end ? new Date(this.end).getTime() : now;
  }

  toJSON() {
    return {
      id: this.id,
      taskId: this.taskId,
      start: this.start,
      end: this.end,
      raw: this.raw,
    };
  }
}
