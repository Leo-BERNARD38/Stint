import { escapeHtml } from "../../utils/dom.js";
import { searchKey, queryTerms } from "../../utils/search.js";
import { icon } from "../icons.js";

/**
 * LE sélecteur de tâche — la même liste partout où l'on choisit une tâche :
 * combler un trou de la timeline, compléter un jour de la Saisie, reprendre
 * une tâche (`ResumeModal`) et, replié derrière un déclencheur, le champ
 * « Tâche » d'un formulaire (`TaskField` : segment, mémo). Un `<select>` natif
 * y avait été essayé : pas de recherche, et les tâches terminées noyaient les
 * tâches en cours dans une liste sans fin. Ne pas en refaire un à côté.
 *
 * - un champ de recherche en tête (règle commune `utils/search.js` : casse et
 *   accents ignorés, tous les mots dans n'importe quel ordre) ;
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
 * sur la première visible si elle a disparu. Entrée appelle `onSubmit` de
 * l'hôte (créer le segment, reprendre, choisir) avec la tâche sélectionnée.
 */

/**
 * Le balisage du sélecteur (recherche + groupes + terminées repliées).
 *
 * @param {object} o
 * @param {{label:string, tasks:{id,name,color,extra?,hot?}[]}[]} o.groups  toujours visibles
 *        (`extra` : valeur en dernière piste ; `hot` : c'est le nombre qui
 *        tourne — la tâche du chrono —, il passe en minium)
 * @param {{id,name,color,extra?,hot?}[]} [o.more]  tâches terminées, repliées
 * @param {string|null} [o.selected]
 * @param {string} [o.none]  libellé d'une ligne « sans tâche » en tête (id `""`)
 */
export function taskPickerHtml({ groups, more = [], selected = null, none = null }) {
  const row = (t) =>
    `<button type="button" class="tp-item${t.id === selected ? " is-sel" : ""}" data-tp-task="${escapeHtml(t.id)}" ` +
      `data-tp-name="${escapeHtml(searchKey(t.name))}" aria-pressed="${t.id === selected}">` +
      (t.color ? `<span class="o-dot" style="background:${escapeHtml(t.color)}"></span>` : '<span class="o-dot off"></span>') +
      `<span class="tp-name">${escapeHtml(t.name)}</span>` +
      (t.extra ? `<span class="tp-extra${t.hot ? " is-hot" : ""}">${escapeHtml(t.extra)}</span>` : "") +
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
      (none != null ? `<div class="tp-group">${row({ id: "", name: none, color: null })}</div>` : "") +
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

/** L'identifiant de la tâche sélectionnée dans `root` (`""` = sans tâche), ou `null`. */
export function pickedTask(root) {
  return root.querySelector(".tp-item.is-sel")?.dataset.tpTask ?? null;
}

/**
 * Câble le sélecteur dans `root` (conteneur stable). `onSelect(id, { click })`
 * est appelé à chaque changement de sélection ; `click` dit si elle vient d'un
 * clic (la timeline crée alors le segment tout de suite). `onSubmit(id)` :
 * Entrée dans la recherche, sur la ligne sélectionnée.
 */
export function bindTaskPicker(root, { onSelect, onSubmit } = {}) {
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
    const terms = queryTerms(input.value);
    const q = terms.length > 0;
    const tp = input.closest(".tp");
    // Une recherche porte sur TOUT : le repli s'ouvre, son bouton se retire.
    if (q) setMore(true);
    tp.querySelector("[data-tp-more]")?.toggleAttribute("hidden", q);
    // `data-tp-name` est déjà normalisé (`searchKey`).
    for (const b of items()) b.hidden = q && !terms.every((t) => b.dataset.tpName.includes(t));
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
    else if (e.key === "Enter" && onSubmit) {
      e.preventDefault();
      const id = pickedTask(root);
      if (id != null) onSubmit(id);
    }
  });
  root.addEventListener("click", (e) => {
    const more = e.target.closest("[data-tp-more]");
    if (more) { setMore(!more.classList.contains("open")); return; }
    const btn = e.target.closest(".tp-item");
    if (btn) select(btn, true);
  });
}

/** Une tâche du Store au format du sélecteur. */
export const pickerTask = (t, extra = "", hot = false) => ({ id: t.id, name: t.displayName, color: t.color, extra, hot });

/**
 * Les tâches du Store dans l'ORDRE COMMUN à tous les sélecteurs : les plus
 * récemment pointées d'abord (celle qu'on cherche est presque toujours l'une
 * des dernières), puis les jamais pointées, les plus récentes en tête. Les
 * archivées sont exclues — elles sont masquées des listes (§4).
 *
 * @param {import("../../models/Store.js").Store} store
 * @param {object} [o]
 * @param {Set<string>} [o.exclude]  ids déjà proposés ailleurs (la réserve)
 * @param {(t) => string} [o.extra]  valeur en dernière piste
 * @returns {{ open: object[], done: object[] }}  au format `pickerTask`
 */
export function pickerTasks(store, { exclude = new Set(), extra = () => "" } = {}) {
  const lastUse = new Map();
  for (const s of store.segments) {
    if (!s.taskId) continue;
    const at = s.startMs();
    if (!(lastUse.get(s.taskId) >= at)) lastUse.set(s.taskId, at);
  }
  const running = store.activeSegment()?.taskId ?? null;
  const rank = new Map(store.tasks.map((t, i) => [t.id, i]));
  const tasks = store.tasks
    .filter((t) => !t.archived && !exclude.has(t.id))
    .sort((a, b) => (lastUse.get(b.id) ?? -Infinity) - (lastUse.get(a.id) ?? -Infinity) || rank.get(b.id) - rank.get(a.id));
  const fmt = (t) => pickerTask(t, extra(t), t.id === running);
  return { open: tasks.filter((t) => !t.done).map(fmt), done: tasks.filter((t) => t.done).map(fmt) };
}
