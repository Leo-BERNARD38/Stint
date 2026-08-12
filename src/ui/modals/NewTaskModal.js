import { Modal } from "./Modal.js";
import { el } from "../../utils/dom.js";

/** « Nouvelle tâche » : crée et démarre immédiatement. Type choisi en chips. */
export class NewTaskModal extends Modal {
  constructor(app) {
    super("newTaskModal");
    this.app = app;
    this.type = "dev";
  }

  bind() {
    this.bindDismiss();
    el("ntCreate").addEventListener("click", () => this.#create());
    el("ntName").addEventListener("keydown", (e) => { if (e.key === "Enter") this.#create(); });
    el("ntLink").addEventListener("keydown", (e) => { if (e.key === "Enter") this.#create(); });
    el("ntTypeChips").addEventListener("click", (e) => {
      const b = e.target.closest("[data-type]");
      if (b) this.#setType(b.dataset.type);
    });
  }

  #setType(type) {
    this.type = type;
    [...el("ntTypeChips").children].forEach((c) => c.classList.toggle("active", c.dataset.type === type));
  }

  open() {
    el("ntName").value = "";
    el("ntLink").value = "";
    this.#setType("dev");
    super.open();
    setTimeout(() => el("ntName").focus(), 50);
  }

  #create() {
    this.app.store.startNew({
      name: el("ntName").value.trim(),
      type: this.type,
      link: el("ntLink").value.trim(),
    });
    this.close();
  }
}
