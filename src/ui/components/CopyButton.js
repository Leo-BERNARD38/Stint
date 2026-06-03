import { createEl } from "../../utils/dom.js";

/**
 * Bouton « copier » avec retour visuel. Délègue la copie à `app.copy`,
 * qui gère le presse-papier et le toast.
 */
export function createCopyButton(app, value, label) {
  return createEl("button", {
    className: "mini-btn",
    html: "⧉ " + label,
    attrs: { title: "Copier « " + value + " »" },
    on: { click: (e) => app.copy(value, e.currentTarget) },
  });
}
