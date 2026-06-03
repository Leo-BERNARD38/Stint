/**
 * Une tâche : nom, clé Jira optionnelle, type (dev/support/autre), couleur.
 * Cycle de vie : `done=false` ⇒ en cours (visible dans « Reprise ») ;
 * `done=true` ⇒ terminée (conservée pour les totaux, retirée de « Reprise »).
 * `archived` la masque des listes courantes.
 */
export class Task {
  constructor({ id, name = "", jiraKey = "", type = "dev", color = "#475569", done = false, archived = false }) {
    this.id = id;
    this.name = name;
    this.jiraKey = jiraKey;
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
      jiraKey: this.jiraKey,
      type: this.type,
      color: this.color,
      done: this.done,
      archived: this.archived,
    };
  }
}
