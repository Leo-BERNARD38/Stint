import { el, createEl, escapeHtml } from "../../utils/dom.js";
import { sameDay } from "../../utils/datetime.js";
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

    // Uniquement les tâches réellement tracées ce jour (un jour vide → liste vide).
    const { byTask } = calc.totalsForDay(viewDay);
    const taskIds = [...byTask.keys()];

    if (taskIds.length === 0) {
      this.list.innerHTML = sameDay(viewDay, new Date())
        ? '<div class="empty">Aucune tâche. Appuyez sur « Play » ou « Nouvelle tâche ».</div>'
        : '<div class="empty">Rien de tracé ce jour.</div>';
      return;
    }

    // tri : en cours d'abord, terminées ensuite, puis par temps décroissant
    taskIds.sort((a, b) => {
      const da = store.taskById(a)?.done ? 1 : 0;
      const db = store.taskById(b)?.done ? 1 : 0;
      return da - db || (byTask.get(b) ?? 0) - (byTask.get(a) ?? 0);
    });

    const activeSeg = store.activeSegment();
    const maxMs = Math.max(1, ...[...byTask.values()]);
    let prevDone = false; // pour aérer/séparer le groupe des terminées (en bas)
    for (const id of taskIds) {
      const t = store.taskById(id);
      if (!t) continue;
      const ms = byTask.get(id) ?? 0;
      const row = this.#row(t, ms / 60000, activeSeg?.taskId === id, (ms / maxMs) * 100);
      if (t.done && !prevDone) row.classList.add("done-sep"); // 1ʳᵉ terminée : séparateur
      prevDone = !!t.done;
      this.list.appendChild(row);
    }
  }

  #row(task, minutes, isActive, share) {
    const fmt = this.app.formatter;
    const row = createEl("div", {
      className: "task-row" + (isActive ? " active" : "") + (task.done ? " done" : "") + (task.archived ? " archived" : ""),
      html:
        `<button class="swatch" style="background:${task.color}" title="Éditer"></button>` +
        `<div class="task-main"><div class="task-name">${escapeHtml(task.displayName)}` +
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
    if (task.link) actions.appendChild(this.#linkBtn(task.link));
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

  /** Petit bouton discret : ouvre le lien de la tâche dans un nouvel onglet. */
  #linkBtn(link) {
    return createEl("a", {
      className: "mini-btn icon-only link-btn",
      html: icon("external-link", { size: 15 }),
      attrs: {
        href: link, target: "_blank", rel: "noopener noreferrer",
        title: "Ouvrir le lien", "aria-label": "Ouvrir le lien",
      },
      on: { click: (e) => e.stopPropagation() },
    });
  }
}
