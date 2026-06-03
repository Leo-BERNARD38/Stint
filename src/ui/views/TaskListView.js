import { el, createEl, escapeHtml } from "../../utils/dom.js";
import { createCopyButton } from "../components/CopyButton.js";

/** Liste des tâches du jour : durée, copie déc./Jira, reprise/stop, édition. */
export class TaskListView {
  constructor(app) {
    this.app = app;
    this.list = el("taskList");
  }

  render(viewDay) {
    const { store, calc } = this.app;
    this.list.innerHTML = "";

    const { byTask } = calc.totalsForDay(viewDay);
    let taskIds = [...byTask.keys()];
    if (taskIds.length === 0) {
      taskIds = store.tasks.filter((t) => !t.archived).map((t) => t.id);
    }
    taskIds.sort((a, b) => (byTask.get(b) ?? 0) - (byTask.get(a) ?? 0));

    if (taskIds.length === 0) {
      this.list.innerHTML = '<div class="empty">Aucune tâche. Appuyez sur « Play » ou « Nouvelle tâche ».</div>';
      return;
    }

    const activeSeg = store.activeSegment();
    for (const id of taskIds) {
      const t = store.taskById(id);
      if (!t) continue;
      this.list.appendChild(this.#row(t, (byTask.get(id) ?? 0) / 60000, activeSeg?.taskId === id));
    }
  }

  #row(task, minutes, isActive) {
    const fmt = this.app.formatter;
    const row = createEl("div", {
      className: "task-row" + (isActive ? " active" : "") + (task.archived ? " archived" : ""),
      html:
        `<button class="swatch" style="background:${task.color}" title="Éditer"></button>` +
        `<div class="task-main"><div class="task-name">${escapeHtml(task.displayName)}` +
          (task.jiraKey ? `<span class="jira">${escapeHtml(task.jiraKey)}</span>` : "") +
          `<span class="type-badge type-${task.type}">${task.type}</span>` +
        `</div></div>` +
        `<div class="task-dur">${fmt.decimal(minutes)} h</div>`,
    });

    const actions = createEl("div", { className: "task-actions" });
    actions.append(
      createCopyButton(this.app, fmt.decimal(minutes), "Déc."),
      createCopyButton(this.app, fmt.jira(minutes), "Jira"),
    );

    actions.appendChild(createEl("button", {
      className: "mini-btn",
      html: isActive ? "■ Stop" : "▶ Reprendre",
      on: { click: () => (isActive ? this.app.store.stop() : this.app.store.resume(task.id)) },
    }));
    actions.appendChild(createEl("button", {
      className: "mini-btn",
      html: "✎",
      attrs: { title: "Éditer" },
      on: { click: () => this.app.openEditTask(task.id) },
    }));

    row.appendChild(actions);
    row.querySelector(".swatch").addEventListener("click", () => this.app.openEditTask(task.id));
    return row;
  }
}
