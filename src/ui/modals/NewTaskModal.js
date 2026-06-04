import { Modal } from "./Modal.js";
import { el } from "../../utils/dom.js";

/** « Nouvelle tâche » : crée et démarre immédiatement. */
export class NewTaskModal extends Modal {
  constructor(app) {
    super("newTaskModal");
    this.app = app;
  }

  bind() {
    this.bindDismiss();
    el("ntCreate").addEventListener("click", () => this.#create());
    el("ntName").addEventListener("keydown", (e) => { if (e.key === "Enter") this.#create(); });
  }

  open() {
    el("ntName").value = "";
    el("ntType").value = "dev";
    super.open();
    setTimeout(() => el("ntName").focus(), 50);
  }

  #create() {
    this.app.store.startNew({
      name: el("ntName").value.trim(),
      type: el("ntType").value,
    });
    this.close();
  }
}
