import { Modal } from "./Modal.js";
import { el } from "../../utils/dom.js";

/** Édition d'une tâche : nom (qui porte la clé Jira), type (chips), couleur
 *  (color picker libre), archiver, supprimer. */
export class EditTaskModal extends Modal {
  constructor(app) {
    super("editTaskModal");
    this.app = app;
    this.taskId = null;
    this.type = "dev";
  }

  bind() {
    this.bindDismiss();
    el("etSave").addEventListener("click", () => this.#save());
    el("etArchive").addEventListener("click", () => this.#archive());
    el("etDelete").addEventListener("click", () => this.#delete());
    el("etTypeChips").addEventListener("click", (e) => {
      const b = e.target.closest("[data-type]");
      if (b) this.#setType(b.dataset.type);
    });
    el("etColor").addEventListener("input", () => this.#reflectColor());
  }

  #setType(type) {
    this.type = type;
    [...el("etTypeChips").children].forEach((c) => c.classList.toggle("active", c.dataset.type === type));
  }

  #reflectColor() {
    const v = el("etColor").value;
    el("etColor").style.background = v; // le carré se remplit de la couleur choisie
    el("etColorHex").textContent = v.toUpperCase();
  }

  open(taskId) {
    const t = this.app.store.taskById(taskId);
    if (!t) return;
    this.taskId = taskId;
    el("etName").value = t.name;
    this.#setType(t.type);
    el("etColor").value = t.color;
    this.#reflectColor();
    el("etArchive").textContent = t.archived ? "Désarchiver" : "Archiver";
    super.open();
    setTimeout(() => el("etName").focus(), 50);
  }

  #save() {
    this.app.store.updateTask(this.taskId, {
      name: el("etName").value.trim(),
      type: this.type,
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
