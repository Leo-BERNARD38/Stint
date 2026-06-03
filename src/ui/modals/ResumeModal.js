import { Modal } from "./Modal.js";
import { el, createEl, escapeHtml } from "../../utils/dom.js";

/** « Reprise » : liste des tâches du jour / en cours, reprend la sélection. */
export class ResumeModal extends Modal {
  constructor(app) {
    super("resumeModal");
    this.app = app;
    this.list = el("resumeList");
  }

  bind() {
    this.bindDismiss();
  }

  open() {
    const { store, calc } = this.app;
    this.list.innerHTML = "";

    const { byTask } = calc.totalsForDay(this.app.viewDay);
    const ids = [...byTask.keys()];
    for (const t of store.tasks) {
      if (!t.archived && !ids.includes(t.id)) ids.push(t.id);
    }
    const visible = ids.filter((id) => store.taskById(id) && !store.taskById(id).archived);
    visible.sort((a, b) => (byTask.get(b) ?? 0) - (byTask.get(a) ?? 0));

    if (visible.length === 0) {
      this.list.innerHTML = '<div class="empty">Aucune tâche à reprendre. Créez-en une.</div>';
    }

    const activeSeg = store.activeSegment();
    for (const id of visible) {
      const t = store.taskById(id);
      const minutes = (byTask.get(id) ?? 0) / 60000;
      const btn = createEl("button", {
        className: "resume-item",
        html:
          `<span class="swatch" style="background:${t.color}"></span>` +
          `<span class="nm">${escapeHtml(t.displayName)}` +
            (t.jiraKey ? ` <span class="jira">${escapeHtml(t.jiraKey)}</span>` : "") + `</span>` +
          `<span class="du">${this.app.formatter.decimal(minutes)} h</span>`,
        on: { click: () => { store.resume(id); this.close(); } },
      });
      if (activeSeg?.taskId === id) btn.style.borderColor = "var(--play)";
      this.list.appendChild(btn);
    }
    super.open();
  }
}
