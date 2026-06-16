import { el, escapeHtml } from "../../utils/dom.js";
import { icon } from "../icons.js";

/** Notification éphémère en bas d'écran (coche verte + message). */
export class Toast {
  constructor() {
    this.node = el("toast");
    this.timer = null;
  }

  show(message) {
    this.node.innerHTML = icon("check", { size: 15 }) + `<span>${escapeHtml(message)}</span>`;
    this.node.classList.add("show");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.node.classList.remove("show"), 1900);
  }
}
