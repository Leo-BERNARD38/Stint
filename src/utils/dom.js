/** Petites aides DOM partagées par les vues. */

export const el = (id) => document.getElementById(id);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

export function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/** Crée un élément avec classe/attributs/contenu. */
export function createEl(tag, { className, html, text, attrs, on } = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html != null) node.innerHTML = html;
  if (text != null) node.textContent = text;
  if (attrs) for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (on) for (const [evt, fn] of Object.entries(on)) node.addEventListener(evt, fn);
  return node;
}
