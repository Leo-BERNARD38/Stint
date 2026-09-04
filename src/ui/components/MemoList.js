import { createEl, escapeHtml } from "../../utils/dom.js";
import { icon } from "../icons.js";

/**
 * Liste de mémos (factory, comme `FillPopover`) : une case « fait », le texte,
 * la tâche rattachée (puce + nom, clic = éditer la tâche) et une croix. Montée
 * une fois sur `root`, câblée par délégation ; `render(memos)` reconstruit.
 * Servie par le panneau ET par la modale de tâche — une seule grammaire.
 */
export function createMemoList({ app, root, showTask = true }) {
  root.addEventListener("click", (e) => {
    const toggle = e.target.closest("[data-toggle-memo]");
    if (toggle) { app.store.toggleMemo(toggle.dataset.toggleMemo); return; }
    const rm = e.target.closest("[data-rm-memo]");
    if (rm) { app.store.deleteMemo(rm.dataset.rmMemo); return; }
    const task = e.target.closest("[data-memo-task]");
    if (task) app.openEditTask(task.dataset.memoTask);
  });

  function render(memos, { empty = "Aucun mémo." } = {}) {
    root.innerHTML = "";
    if (!memos.length) {
      root.appendChild(createEl("div", { className: "ov-empty", text: empty }));
      return;
    }
    for (const m of memos) {
      const task = m.taskId ? app.store.taskById(m.taskId) : null;
      root.appendChild(createEl("div", {
        className: "memo-item" + (m.done ? " done" : ""),
        html:
          `<label class="memo-check"><input type="checkbox" data-toggle-memo="${escapeHtml(m.id)}"${m.done ? " checked" : ""} aria-label="Fait"></label>` +
          `<div class="memo-main"><div class="memo-text">${escapeHtml(m.text)}</div>` +
            (showTask && task
              ? `<button class="memo-task" data-memo-task="${escapeHtml(task.id)}" title="Éditer la tâche">` +
                  `<span class="swatch" style="background:${task.color}"></span>${escapeHtml(task.displayName)}</button>`
              : "") +
          `</div>` +
          `<button class="ov-rm" data-rm-memo="${escapeHtml(m.id)}" title="Supprimer" aria-label="Supprimer">×</button>`,
      }));
    }
  }

  return { render };
}

/**
 * L'indicateur d'une ligne de tâche : icône + nombre de mémos ouverts, ou rien.
 * Posé dans la colonne élastique (le nom) : rien ne bouge. Clic = ouvrir le
 * panneau sur cette tâche.
 */
export function memoBadge(app, taskId) {
  const n = app.store.openMemoCountFor(taskId);
  if (!n) return null;
  return createEl("button", {
    className: "memo-badge",
    html: icon("sticky-note", { size: 12 }) + `<span>${n}</span>`,
    attrs: { title: n > 1 ? `${n} mémos` : "1 mémo", "aria-label": n > 1 ? `${n} mémos` : "1 mémo", type: "button" },
    on: { click: (e) => { e.stopPropagation(); app.openMemos(taskId); } },
  });
}
