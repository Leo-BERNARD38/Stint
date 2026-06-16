import { el, createEl, escapeHtml } from "../../utils/dom.js";
import { createCopyButton } from "../components/CopyButton.js";
import { icon } from "../icons.js";

/** Liste des tâches du jour : durée, copie, et actions selon le cycle de vie. */
export class TaskListView {
  constructor(app) {
    this.app = app;
    this.list = el("taskList");
    this.anchor = this.list;
  }

  render(viewDay) {
    const { store, calc } = this.app;
    this.list.innerHTML = "";

    const { byTask } = calc.totalsForDay(viewDay);
    let taskIds = [...byTask.keys()];
    if (taskIds.length === 0) {
      taskIds = store.tasks.filter((t) => !t.archived).map((t) => t.id);
    }
    // tri : en cours d'abord, terminées ensuite, puis par temps décroissant
    taskIds.sort((a, b) => {
      const da = store.taskById(a)?.done ? 1 : 0;
      const db = store.taskById(b)?.done ? 1 : 0;
      return da - db || (byTask.get(b) ?? 0) - (byTask.get(a) ?? 0);
    });

    if (taskIds.length === 0) {
      this.list.innerHTML = '<div class="empty">Aucune tâche. Appuyez sur « Play » ou « Nouvelle tâche ».</div>';
      return;
    }

    const activeSeg = store.activeSegment();
    const maxMs = Math.max(1, ...[...byTask.values()]);
    for (const id of taskIds) {
      const t = store.taskById(id);
      if (!t) continue;
      const ms = byTask.get(id) ?? 0;
      this.list.appendChild(this.#row(t, ms / 60000, activeSeg?.taskId === id, (ms / maxMs) * 100));
    }
  }

  #row(task, minutes, isActive, share) {
    const fmt = this.app.formatter;
    const row = createEl("div", {
      className: "task-row" + (isActive ? " active" : "") + (task.done ? " done" : "") + (task.archived ? " archived" : ""),
      html:
        `<button class="swatch" style="background:${task.color}" title="Éditer"></button>` +
        `<div class="task-main"><div class="task-name">${escapeHtml(task.displayName)}` +
          (isActive ? `<span class="live-dot"></span>` : "") +
          `<span class="type-badge type-${task.type}">${task.type}</span>` +
          (task.done ? `<span class="badge-done">terminé</span>` : "") +
        `</div>` +
        `<div class="task-share"><span style="width:${share}%;background:${task.color}"></span></div>` +
        `</div>` +
        `<div class="task-dur">${fmt.clock(minutes)}</div>`,
    });

    const actions = createEl("div", { className: "task-actions" });
    const store = this.app.store;
    // contrôles de cycle de vie (pastilles colorées), puis copie + édition
    if (task.done) {
      actions.appendChild(this.#iconBtn("rotate-ccw", "Rouvrir", () => store.reopenTask(task.id), "ctrl-play"));
    } else if (isActive) {
      actions.appendChild(this.#iconBtn("pause", "Pause", () => store.pause(), "ctrl-pause"));
      actions.appendChild(this.#iconBtn("check", "Terminer", () => store.closeTask(task.id)));
    } else {
      actions.appendChild(this.#iconBtn("play", "Reprendre", () => store.resume(task.id), "ctrl-play"));
      actions.appendChild(this.#iconBtn("check", "Terminer", () => store.closeTask(task.id)));
    }
    actions.append(
      createCopyButton(this.app, fmt.decimal(minutes), "Déc."),
      createCopyButton(this.app, fmt.jira(minutes), "Jira"),
    );
    actions.appendChild(this.#iconBtn("pencil", "Éditer", () => this.app.openEditTask(task.id)));

    row.appendChild(actions);
    row.querySelector(".swatch").addEventListener("click", () => this.app.openEditTask(task.id));
    return row;
  }

  #iconBtn(name, title, onClick, extra = "") {
    return createEl("button", {
      className: "mini-btn icon-only" + (extra ? " " + extra : ""),
      html: icon(name, { size: 15 }),
      attrs: { title, "aria-label": title },
      on: { click: onClick },
    });
  }
}
