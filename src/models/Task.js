/**
 * Une tâche : nom (qui porte la clé Jira si c'en est une), type (dev/support/
 * autre), couleur, lien externe optionnel (ex. URL du ticket Jira). Cycle de
 * vie : `done=false` ⇒ en cours (visible dans « Reprise ») ; `done=true` ⇒
 * terminée. `archived` la masque des listes.
 */
export class Task {
  constructor({ id, name = "", type = "dev", color = "#475569", link = "", done = false, archived = false }) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.color = color;
    this.link = link;
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
      link: this.link,
      done: this.done,
      archived: this.archived,
    };
  }
}
