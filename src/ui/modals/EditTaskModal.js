import { Modal } from "./Modal.js";
import { el } from "../../utils/dom.js";

/** Édition d'une tâche : nom (qui porte la clé Jira), type, couleur, archiver, supprimer. */
export class EditTaskModal extends Modal {
  constructor(app) {
    super("editTaskModal");
    this.app = app;
    this.taskId = null;
  }

  bind() {
    this.bindDismiss();
    el("etSave").addEventListener("click", () => this.#save());
    el("etArchive").addEventListener("click", () => this.#archive());
    el("etDelete").addEventListener("click", () => this.#delete());
  }

  open(taskId) {
    const t = this.app.store.taskById(taskId);
    if (!t) return;
    this.taskId = taskId;
    el("etName").value = t.name;
    el("etType").value = t.type;
    el("etColor").value = t.color;
    el("etArchive").textContent = t.archived ? "Désarchiver" : "Archiver";
    super.open();
    setTimeout(() => el("etName").focus(), 50);
  }

  #save() {
    this.app.store.updateTask(this.taskId, {
      name: el("etName").value.trim(),
      type: el("etType").value,
      color: el("etColor").value,
    });
    this.close();
  }

  #archive() {
    this.app.store.toggleArchive(this.taskId);
    this.close();
  }

  #delete() {
    const t = this.app.store.taskById(this.taskId);
    if (!t) return;
    const count = this.app.store.segmentCountFor(this.taskId);
    if (!confirm(`Supprimer « ${t.displayName} » et ses ${count} segment(s) ?`)) return;
    this.app.store.deleteTask(this.taskId);
    this.close();
  }
}
