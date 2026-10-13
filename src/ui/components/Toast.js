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
 * Notification éphémère en bas d'écran : `show(message, { kind, action })`,
 * `kind` = `ok` (coche, défaut), `info` (sans pictogramme) ou `error` (croix,
 * plus long). `action` = `{ label, run }` : un bouton dans le toast (« Annuler »
 * d'une suppression, cf. `App.undoable`) — le toast reste alors plus longtemps
 * et devient cliquable.
 */
export class Toast {
  constructor() {
    this.node = el("toast");
    this.timer = null;
  }

  show(message, { kind = "ok", action = null } = {}) {
    const k = KINDS[kind] ?? KINDS.ok;
    this.node.innerHTML = (k.icon ? icon(k.icon, { size: 15 }) : "") + `<span>${escapeHtml(message)}</span>` +
      (action ? `<button type="button" class="toast-act">${escapeHtml(action.label)}</button>` : "");
    this.node.setAttribute("role", kind === "error" ? "alert" : "status");
    this.node.classList.toggle("has-action", !!action);
    this.node.classList.add("show");
    if (action) {
      this.node.querySelector(".toast-act").addEventListener("click", () => { this.hide(); action.run(); }, { once: true });
    }
    clearTimeout(this.timer);
    // Un bouton se lit, se vise et se clique : on lui laisse le temps.
    this.timer = setTimeout(() => this.hide(), action ? 6000 : k.ms);
  }

  hide() {
    clearTimeout(this.timer);
    this.node.classList.remove("show", "has-action");
  }
}
