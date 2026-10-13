import { createEl, escapeHtml } from "../../utils/dom.js";
import { icon } from "../icons.js";
import { createCopyButton } from "./CopyButton.js";

/**
 * Les actions d'une tâche dans une liste — les mêmes partout où une ligne de
 * tâche les porte (Tâches du jour, onglet Tâches, Stats, Saisie). Chaque vue
 * les recopiait : titres différents (« Éditer » / « Éditer la tâche »),
 * icônes de 14 ou 15 px, et une règle qui avait divergé — « Reprendre »
 * s'offrait sur une tâche archivée dans une liste, pas dans l'autre (reprise,
 * elle aurait tourné masquée de toutes les listes).
 *
 * Ordre dans le DOM (donc au clavier) : les contrôles de cycle de vie
 * (`ctrl-*`, toujours visibles), puis copie, lien, édition (révélés au survol
 * par la vue). À l'écran, les `ctrl-*` ferment la file (`order: 1`, cf.
 * CLAUDE.md §7 — ce qui est visible ne bouge pas au survol).
 */

const ICON = 15;

/** Pastilles de la tâche à côté de son nom : type, « terminé », « archivé ». */
export function taskBadgesHtml(task) {
  return `<span class="type-badge type-${escapeHtml(task.type)}">${escapeHtml(task.type)}</span>` +
    (task.done ? '<span class="badge-done">terminé</span>' : "") +
    (task.archived ? '<span class="badge-done">archivé</span>' : "");
}

/** Le bouton « ouvrir le lien » (la fiche Jira), en balisage — pour les vues qui construisent en chaîne. */
export function linkButtonHtml(link) {
  return `<a class="mini-btn icon-only link-btn" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" ` +
    `title="Ouvrir le lien" aria-label="Ouvrir le lien">${icon("external-link", { size: ICON })}</a>`;
}

/** Le bouton « ouvrir le lien », en élément ; son clic ne remonte pas (une ligne cliquable ne s'ouvre pas avec). */
export function linkButton(link) {
  const tpl = document.createElement("template");
  tpl.innerHTML = linkButtonHtml(link);
  const a = tpl.content.firstChild;
  a.addEventListener("click", (e) => e.stopPropagation());
  return a;
}

/** Le bouton « Éditer la tâche », en balisage ; `attrs` = les `data-*` de la délégation de la vue. */
export function editButtonHtml(task, attrs = "") {
  return `<button class="mini-btn icon-only" ${attrs} title="Éditer la tâche" ` +
    `aria-label="Éditer ${escapeHtml(task.displayName)}">${icon("pencil", { size: ICON })}</button>`;
}

function iconBtn(name, title, onClick, extra = "") {
  return createEl("button", {
    className: "mini-btn icon-only" + (extra ? " " + extra : ""),
    html: icon(name, { size: ICON }),
    attrs: { title, "aria-label": title },
    on: { click: (e) => { e.stopPropagation(); onClick(); } },
  });
}

/**
 * Les contrôles de cycle de vie : Rouvrir (terminée) ; Pause + Terminer (en
 * cours) ; Reprendre + Terminer (ouverte). Rien pour une archivée.
 */
export function lifecycleButtons(app, task) {
  const store = app.store;
  if (task.done) return [iconBtn("rotate-ccw", "Rouvrir", () => store.reopenTask(task.id), "ctrl-play")];
  if (task.archived) return [];
  if (store.activeSegment()?.taskId === task.id) {
    return [
      iconBtn("pause", "Pause", () => store.pause(), "ctrl-pause"),
      iconBtn("check", "Terminer", () => store.closeTask(task.id), "ctrl-finish"),
    ];
  }
  return [
    iconBtn("play", "Reprendre", () => store.resume(task.id), "ctrl-play"),
    iconBtn("check", "Terminer", () => store.closeTask(task.id), "ctrl-finish"),
  ];
}

/**
 * Le groupe d'actions complet d'une ligne de tâche.
 * @param {object} app
 * @param {object|null} task  `null` : une tâche supprimée (copie seule)
 * @param {number} minutes  la durée que copient Déc. et Jira
 * @param {object} [o]
 * @param {string} [o.className]  la classe du groupe dans la vue hôte
 * @param {boolean} [o.lifecycle]  contrôles de cycle de vie (pas dans une rétrospective)
 * @param {boolean} [o.edit]  bouton « Éditer » (inutile si la ligne entière édite)
 */
export function taskActions(app, task, minutes, { className = "task-actions", lifecycle = true, edit = true } = {}) {
  const fmt = app.formatter;
  const box = createEl("div", { className });
  if (task && lifecycle) box.append(...lifecycleButtons(app, task));
  box.append(
    createCopyButton(app, fmt.decimal(minutes), "Déc."),
    createCopyButton(app, fmt.jira(minutes), "Jira"),
  );
  if (task?.link) box.appendChild(linkButton(task.link));
  if (task && edit) box.appendChild(iconBtn("pencil", "Éditer la tâche", () => app.openEditTask(task.id)));
  return box;
}
