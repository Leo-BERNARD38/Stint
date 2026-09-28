import { escapeHtml } from "../../utils/dom.js";
import { icon } from "../icons.js";

/**
 * Sélecteur de tâche des popovers — la même liste partout où l'on choisit une
 * tâche sur place (combler un trou de la timeline, compléter un jour de la
 * Saisie). Un `<select>` natif y avait été essayé : pas de recherche, et les
 * tâches terminées noyaient les tâches en cours dans une liste sans fin.
 *
 * - un champ de recherche en tête (inclusion sur le nom, donc la clé Jira) ;
 * - les groupes « en cours » (et ce que l'hôte veut mettre au-dessus, la
 *   réserve de la Saisie), avec une valeur optionnelle en dernière piste ;
 * - les AUTRES tâches (terminées) repliées derrière un bouton — une recherche
 *   les déplie d'office : on cherche dans tout, pas dans ce qui est visible.
 *
 * Deux fonctions, parce que les hôtes reconstruisent leur carte à chaque
 * ouverture : `taskPickerHtml()` produit le balisage, `bindTaskPicker()` câble
 * UNE fois, par délégation, le conteneur stable qui le recevra.
 *
 * La sélection (lavis + anneau, choix unique) est le curseur du clavier :
 * ↑ ↓ dans le champ la déplacent parmi les lignes visibles, un filtre la pose
 * sur la première visible si elle a disparu. Entrée reste à l'hôte (créer le
 * segment, valider la durée) : il lit `pickedTask(root)`.
 */

/**
 * @param {object} o
 * @param {{label:string, tasks:{id,name,color,extra?}[]}[]} o.groups  toujours visibles
 * @param {{id,name,color,extra?}[]} [o.more]  tâches terminées, repliées
 * @param {string|null} [o.selected]
 */
export function taskPickerHtml({ groups, more = [], selected = null }) {
  const row = (t) =>
    `<button type="button" class="tp-item${t.id === selected ? " is-sel" : ""}" data-tp-task="${escapeHtml(t.id)}" ` +
      `data-tp-name="${escapeHtml(t.name.toLowerCase())}" aria-pressed="${t.id === selected}">` +
      `<span class="o-dot" style="background:${escapeHtml(t.color ?? "")}"></span>` +
      `<span class="tp-name">${escapeHtml(t.name)}</span>` +
      (t.extra ? `<span class="tp-extra">${escapeHtml(t.extra)}</span>` : "") +
    "</button>";
  const group = (label, tasks, cls = "") =>
    `<div class="tp-group${cls}"><span class="tp-lab">${escapeHtml(label)}</span>${tasks.map(row).join("")}</div>`;
  const shown = groups.filter((g) => g.tasks.length);
  // La tâche sélectionnée peut être une terminée : le repli s'ouvre alors
  // d'emblée, sinon la sélection serait invisible.
  const moreOpen = more.some((t) => t.id === selected);
  return '<div class="tp">' +
    '<input type="search" class="at-search tp-search" placeholder="Rechercher (nom, clé Jira)…" ' +
      'autocomplete="off" spellcheck="false" aria-label="Rechercher une tâche">' +
    '<div class="tp-list">' +
      shown.map((g) => group(g.label, g.tasks)).join("") +
      (more.length
        ? `<button type="button" class="tp-more${moreOpen ? " open" : ""}" data-tp-more data-count="${more.length}" aria-expanded="${moreOpen}">` +
            `<span class="tp-more-lab">${moreLabel(moreOpen, more.length)}</span>` +
            `<span class="o-chev">${icon("chevron-down", { size: 16 })}</span></button>` +
          `<div class="tp-more-list"${moreOpen ? "" : " hidden"}>${group("Terminées", more, " tp-done")}</div>`
        : "") +
      (!shown.length && !more.length ? '<div class="tp-empty">Aucune tâche.</div>' : "") +
      '<div class="tp-empty tp-none" hidden>Aucune tâche ne correspond.</div>' +
    "</div></div>";
}

const moreLabel = (open, n) => `${open ? "Masquer" : "Afficher"} les tâches terminées (${n})`;

/** L'identifiant de la tâche sélectionnée dans `root`, ou `null`. */
export function pickedTask(root) {
  return root.querySelector(".tp-item.is-sel")?.dataset.tpTask ?? null;
}

/**
 * Câble le sélecteur dans `root` (conteneur stable). `onSelect(id, { click })`
 * est appelé à chaque changement de sélection ; `click` dit si elle vient d'un
 * clic (la timeline crée alors le segment tout de suite).
 */
export function bindTaskPicker(root, { onSelect }) {
  const items = () => [...root.querySelectorAll(".tp-item")];
  const visible = () => items().filter((b) => !b.hidden && !b.closest("[hidden]"));

  function select(btn, click = false) {
    for (const b of items()) {
      const on = b === btn;
      b.classList.toggle("is-sel", on);
      b.setAttribute("aria-pressed", String(on));
    }
    if (!btn) return;
    btn.scrollIntoView({ block: "nearest" });
    onSelect?.(btn.dataset.tpTask, { click });
  }

  function setMore(open) {
    const box = root.querySelector(".tp-more-list");
    const btn = root.querySelector("[data-tp-more]");
    if (!box || !btn) return;
    box.toggleAttribute("hidden", !open);
    btn.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
    btn.querySelector(".tp-more-lab").textContent = moreLabel(open, btn.dataset.count);
  }

  function filter(input) {
    const q = input.value.trim().toLowerCase();
    const tp = input.closest(".tp");
    // Une recherche porte sur TOUT : le repli s'ouvre, son bouton se retire.
    if (q) setMore(true);
    tp.querySelector("[data-tp-more]")?.toggleAttribute("hidden", !!q);
    for (const b of items()) b.hidden = q !== "" && !b.dataset.tpName.includes(q);
    for (const g of tp.querySelectorAll(".tp-group")) {
      g.hidden = ![...g.querySelectorAll(".tp-item")].some((b) => !b.hidden);
    }
    const vis = visible();
    tp.querySelector(".tp-none").hidden = vis.length > 0 || items().length === 0;
    const cur = root.querySelector(".tp-item.is-sel");
    if (q && vis.length && (!cur || !vis.includes(cur))) select(vis[0]);
  }

  function move(dir) {
    const vis = visible();
    if (!vis.length) return;
    const i = vis.indexOf(root.querySelector(".tp-item.is-sel"));
    const next = i < 0 ? (dir > 0 ? 0 : vis.length - 1) : Math.max(0, Math.min(vis.length - 1, i + dir));
    if (vis[next] !== vis[i]) select(vis[next]);
  }

  root.addEventListener("input", (e) => {
    if (e.target.matches(".tp-search")) filter(e.target);
  });
  root.addEventListener("keydown", (e) => {
    if (!e.target.matches(".tp-search")) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); move(e.key === "ArrowDown" ? 1 : -1); }
  });
  root.addEventListener("click", (e) => {
    const more = e.target.closest("[data-tp-more]");
    if (more) { setMore(!more.classList.contains("open")); return; }
    const btn = e.target.closest(".tp-item");
    if (btn) select(btn, true);
  });
}

/** Une tâche du Store au format du sélecteur. */
export const pickerTask = (t, extra = "") => ({ id: t.id, name: t.displayName, color: t.color, extra });
