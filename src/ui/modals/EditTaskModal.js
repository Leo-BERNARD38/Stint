import { Modal } from "./Modal.js";
import { el } from "../../utils/dom.js";
import { createMemoList } from "../components/MemoList.js";

/** Édition d'une tâche : nom (qui porte la clé Jira), type (chips), couleur
 *  (color picker libre), lien externe (ex. URL Jira), archiver, supprimer. */
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
    // Mémos de la tâche : la liste partagée, sans puce de tâche (on est dedans).
    this.memoList = createMemoList({ app: this.app, root: el("etMemos"), showTask: false });
    el("etMemoText").addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (this.app.store.addMemo({ text: e.target.value, taskId: this.taskId }) === "invalid") return;
      e.target.value = "";
    });
    // La modale n'est pas dans `App.views` : elle suit le store elle-même, tant
    // qu'elle est ouverte (cocher, supprimer, ajouter re-rendent la liste).
    this.app.store.on("change", () => { if (this.backdrop.classList.contains("open")) this.#renderMemos(); });
  }

  #renderMemos() {
    if (!this.taskId || !this.app.store.taskById(this.taskId)) return;
    this.memoList.render(this.app.store.memosFor(this.taskId), { empty: "Aucun mémo sur cette tâche." });
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
    el("etLink").value = t.link || "";
    this.#setType(t.type);
    el("etColor").value = t.color;
    this.#reflectColor();
    el("etArchive").textContent = t.archived ? "Désarchiver" : "Archiver";
    el("etMemoText").value = "";
    this.#renderMemos();
    super.open();
    setTimeout(() => el("etName").focus(), 50);
  }

  #save() {
    this.app.store.updateTask(this.taskId, {
      name: el("etName").value.trim(),
      type: this.type,
      color: el("etColor").value,
      link: el("etLink").value.trim(),
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
    const memos = this.app.store.memosFor(this.taskId).length;
    if (!confirm(`Supprimer « ${t.displayName} », ses ${count} segment(s)${memos ? ` et ses ${memos} mémo(s)` : ""} ?`)) return;
    this.app.store.deleteTask(this.taskId);
    this.close();
  }
}
