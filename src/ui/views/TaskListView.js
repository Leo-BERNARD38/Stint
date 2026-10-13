import { el, createEl, escapeHtml } from "../../utils/dom.js";
import { sameDay } from "../../utils/datetime.js";
import { taskActions, taskBadgesHtml } from "../components/TaskActions.js";
import { memoBadge } from "../components/MemoList.js";

/**
 * Liste des tâches du jour : durée, copie, et actions selon le cycle de vie.
 * Porte aussi l'interrupteur « Arrondi » : bascule l'affichage de la journée sur
 * les totaux arrondis au bloc du type de chaque tâche (les blocs de la Saisie).
 */
export class TaskListView {
  constructor(app) {
    this.app = app;
    this.list = el("taskList");
    this.anchor = this.list;
    this.toggle = el("roundedDay");
    this.toggleRow = el("roundedDayRow");
    this.toggleLabel = el("roundedDayLabel");
  }

  bind() {
    this.toggle.addEventListener("change", (e) =>
      this.app.store.updateSettings((s) => { s.roundedDay = e.target.checked; }));
    // Survol croisé : la ligne survolée allume ses segments sur la timeline
    // (même délégation que le tableau de l'onglet Segments).
    this.list.addEventListener("mouseover", (e) => {
      const row = e.target.closest?.(".task-row[data-task]");
      this.app.highlightTask(row ? row.getAttribute("data-task") : null);
    });
    this.list.addEventListener("mouseleave", () => this.app.highlightTask(null));
  }

  render(viewDay) {
    const { store, calc } = this.app;
    this.list.innerHTML = "";
    const rounded = this.#syncToggle();
    this.list.classList.toggle("is-rounded", rounded);

    // Uniquement les tâches réellement tracées ce jour (un jour vide → liste vide).
    const { byTask } = calc.totalsForDay(viewDay, rounded);
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

  /**
   * Met l'interrupteur en phase avec les réglages et renvoie l'état effectif.
   * Il n'y a plus de pas unique : chaque tâche s'arrondit au bloc de son type,
   * que l'infobulle rappelle (les blocs se règlent dans Réglages › Jira).
   */
  #syncToggle() {
    const s = this.app.store.settings;
    const st = s.timesheet.steps;
    const active = !!s.roundedDay;
    this.toggle.checked = active;
    this.toggleRow.classList.toggle("on", active);
    this.toggleRow.title = `Arrondir chaque tâche au bloc de son type, au plus proche : ` +
      `dev ${st.dev} min · support ${st.support} min · autre ${st.autre} min`;
    this.toggleLabel.textContent = "Arrondi";
    return active;
  }

  #row(task, minutes, isActive, share) {
    const fmt = this.app.formatter;
    const row = createEl("div", {
      className: "task-row" + (isActive ? " active" : "") + (task.done ? " done" : "") + (task.archived ? " archived" : ""),
      attrs: { "data-task": task.id },
      html:
        `<button class="swatch" style="background:${task.color}" title="Éditer la tâche" aria-label="Éditer la tâche"></button>` +
        `<div class="task-main"><div class="task-name">${escapeHtml(task.displayName)}` + taskBadgesHtml(task) +
        `</div>` +
        `<div class="task-share"><span style="width:${share}%;background:${task.color}"></span></div>` +
        `</div>` +
        `<div class="task-dur">${fmt.clock(minutes)}</div>`,
    });

    // Les actions communes (`TaskActions`) : cycle de vie, copie, lien, édition.
    const actions = taskActions(this.app, task, minutes);
    row.appendChild(actions);
    row.querySelector(".swatch").addEventListener("click", () => this.app.openEditTask(task.id));
    const badge = memoBadge(this.app, task.id);
    if (badge) row.querySelector(".task-name").appendChild(badge);
    return row;
  }
}
