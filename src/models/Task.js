/**
 * Une tâche : nom (qui porte la clé Jira si c'en est une), type (dev/support/
 * autre), couleur. Cycle de vie : `done=false` ⇒ en cours (visible dans
 * « Reprise ») ; `done=true` ⇒ terminée. `archived` la masque des listes.
 */
export class Task {
  constructor({ id, name = "", type = "dev", color = "#475569", done = false, archived = false }) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.color = color;
    this.done = done;
    this.archived = archived;
  }

  static fromJSON(o) {
    return new Task(o);
  }

  get displayName() {
    return this.name || "(sans nom)";
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      color: this.color,
      done: this.done,
      archived: this.archived,
    };
  }
}
