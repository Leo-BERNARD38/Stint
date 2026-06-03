/** Une tâche : nom, clé Jira optionnelle, type (dev/support/autre), couleur. */
export class Task {
  constructor({ id, name = "", jiraKey = "", type = "dev", color = "#475569", archived = false }) {
    this.id = id;
    this.name = name;
    this.jiraKey = jiraKey;
    this.type = type;
    this.color = color;
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
      archived: this.archived,
    };
  }
}
