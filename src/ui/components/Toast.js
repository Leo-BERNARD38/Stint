import { el } from "../../utils/dom.js";

/** Notification éphémère en bas d'écran. */
export class Toast {
  constructor() {
    this.node = el("toast");
    this.timer = null;
  }

  show(message) {
    this.node.textContent = message;
    this.node.classList.add("show");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.node.classList.remove("show"), 1900);
  }
}
