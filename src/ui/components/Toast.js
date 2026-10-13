import { el, escapeHtml } from "../../utils/dom.js";
import { icon } from "../icons.js";

/* Le pictogramme dit la nature du message, le texte dit le reste. Une coche
   devant « Import impossible » affirmait le contraire de la phrase. */
const KINDS = {
  ok: { icon: "check", ms: 1900 },      // une action a eu lieu
  info: { icon: null, ms: 2400 },       // rien à faire, rien d'anormal (« Aucun jour à compléter »)
  error: { icon: "x", ms: 3200 },       // refusé : le message dit comment se corriger, il se lit plus longtemps
};

/**
 * Notification éphémère en bas d'écran : `show(message, { kind })`, `kind` =
 * `ok` (coche, défaut), `info` (sans pictogramme) ou `error` (croix, plus long).
 */
export class Toast {
  constructor() {
    this.node = el("toast");
    this.timer = null;
  }

  show(message, { kind = "ok" } = {}) {
    const k = KINDS[kind] ?? KINDS.ok;
    this.node.innerHTML = (k.icon ? icon(k.icon, { size: 15 }) : "") + `<span>${escapeHtml(message)}</span>`;
    this.node.setAttribute("role", kind === "error" ? "alert" : "status");
    this.node.classList.add("show");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.node.classList.remove("show"), k.ms);
  }
}
