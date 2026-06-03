import { createEl } from "../../utils/dom.js";
import { icon } from "../icons.js";

/**
 * Bouton « copier » avec icône + libellé et retour visuel. Délègue la copie
 * à `app.copy`, qui gère le presse-papier et le toast.
 */
export function createCopyButton(app, value, label) {
  return createEl("button", {
    className: "mini-btn",
    html: icon("copy", { size: 14 }) + " " + label,
    attrs: { title: "Copier « " + value + " »" },
    on: { click: (e) => app.copy(value, e.currentTarget) },
  });
}
