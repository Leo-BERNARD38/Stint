import { el, qsa } from "../../utils/dom.js";

/** Base des modales : gestion ouverture/fermeture du backdrop. */
export class Modal {
  constructor(backdropId) {
    this.backdrop = el(backdropId);
  }

  /** Câble la fermeture sur [data-close] et le clic hors carte. */
  bindDismiss() {
    qsa("[data-close]", this.backdrop).forEach((b) =>
      b.addEventListener("click", () => this.close()));
    this.backdrop.addEventListener("click", (e) => {
      if (e.target === this.backdrop) this.close();
    });
  }

  open() {
    this.backdrop.classList.add("open");
  }

  close() {
    this.backdrop.classList.remove("open");
  }
}
