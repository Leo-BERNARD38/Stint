import { el, escapeHtml } from "../../utils/dom.js";
import { fmtDateTimeLocal, parseDateTimeLocal, toLocalISO } from "../../utils/datetime.js";
import { icon } from "../icons.js";

/**
 * Tableau des segments éditables (heures, date, tâche, mode brut) + suppression.
 * Toute édition d'une ligne reconstruit start/end puis délègue à `store.updateSegment`.
 */
export class SegmentTableView {
  constructor(app) {
    this.app = app;
    this.body = el("segBody");
    this.anchor = this.body;
  }

  bind() {
    this.body.addEventListener("change", (e) => this.#onChange(e));
    this.body.addEventListener("click", (e) => {
      const sw = e.target.closest?.("[data-edit-task]");
      if (sw) { this.app.openEditTask(sw.getAttribute("data-edit-task")); return; }
      const cp = e.target.closest?.("[data-copy]");
      if (cp) {
        const seg = this.app.store.segments.find((s) => s.id === cp.getAttribute("data-copy"));
        if (seg) {
          const minutes = this.app.calc.segmentMs(seg) / 60000;
          const fmt = this.app.formatter;
          const value = cp.getAttribute("data-fmt") === "jira" ? fmt.jira(minutes) : fmt.decimal(minutes);
          this.app.copy(value, cp);
        }
        return;
      }
      const btn = e.target.closest?.("[data-del]");
      if (!btn || !confirm("Supprimer ce segment ?")) return;
      // Le bouton est dans la table : tant qu'il garde le focus, render() ignore
      // la reconstruction (garde-fou anti-vol de focus) et la ligne resterait
      // affichée. On libère le focus pour que la table se reconstruise aussitôt.
      btn.blur();
      this.app.store.deleteSegment(btn.getAttribute("data-del"));
    });
    el("addSegment").addEventListener("click", () => this.app.addManualSegmentDefault());
  }

  render(viewDay) {
    // Ne pas reconstruire le tableau pendant qu'on édite une cellule : cela
    // volerait le focus (notamment sur les champs date/heure).
    if (this.body.contains(document.activeElement)) return;
    const { store } = this.app;
    this.body.innerHTML = "";
    const segs = store.segmentsForDay(viewDay).sort((a, b) => a.startMs() - b.startMs());
    if (segs.length === 0) {
      this.body.innerHTML = '<tr><td colspan="6" class="empty">Aucun segment ce jour.</td></tr>';
      return;
    }
    for (const seg of segs) this.body.appendChild(this.#row(seg));
  }

  #row(seg) {
    const { store, calc } = this.app;
    const tr = document.createElement("tr");
    if (seg.isRunning) tr.className = "running";
    const start = new Date(seg.start);
    const end = seg.end ? new Date(seg.end) : null;
    const minutes = calc.segmentMs(seg) / 60000;

    const task = store.taskById(seg.taskId);
    const color = task ? task.color : "var(--text-faint)";
    const options = store.tasks.map((t) =>
      `<option value="${t.id}"${t.id === seg.taskId ? " selected" : ""}>` +
      escapeHtml(t.displayName) + "</option>"
    ).join("");

    tr.innerHTML =
      `<td><div class="seg-task-cell"><span class="seg-swatch" style="background:${color}" data-edit-task="${seg.taskId}" title="Éditer la tâche"></span>` +
        `<select data-seg="${seg.id}" data-field="taskId">${options}</select></div></td>` +
      `<td><input type="datetime-local" data-seg="${seg.id}" data-field="start" value="${fmtDateTimeLocal(start)}"></td>` +
      `<td>${end
        ? `<input type="datetime-local" data-seg="${seg.id}" data-field="end" value="${fmtDateTimeLocal(end)}">`
        : '<span style="color:var(--play);font-weight:600">en cours</span>'}</td>` +
      `<td><input type="checkbox" class="raw-toggle" data-seg="${seg.id}" data-field="raw"${seg.raw ? " checked" : ""} title="Temps brut (sans rognage ouvré)"></td>` +
      `<td class="seg-dur">${this.app.formatter.clock(minutes)}</td>` +
      `<td><div class="seg-actions">` +
        `<button class="mini-btn" data-copy="${seg.id}" data-fmt="dec" title="Copier en décimal">${icon("copy", { size: 14 })} Déc.</button>` +
        `<button class="mini-btn" data-copy="${seg.id}" data-fmt="jira" title="Copier en Jira">${icon("copy", { size: 14 })} Jira</button>` +
        `<button class="mini-btn icon-only" data-del="${seg.id}" title="Supprimer">${icon("trash", { size: 15 })}</button>` +
      `</div></td>`;
    return tr;
  }

  #onChange(e) {
    const segId = e.target.getAttribute("data-seg");
    if (!segId) return;
    const seg = this.app.store.segments.find((s) => s.id === segId);
    if (!seg) return;
    const row = e.target.closest("tr");
    const field = (name) => row.querySelector(`[data-field="${name}"]`);

    const patch = { taskId: field("taskId").value, raw: field("raw").checked };

    const startInput = field("start");
    if (startInput && startInput.value) patch.start = toLocalISO(parseDateTimeLocal(startInput.value));

    const endInput = field("end");
    if (endInput && endInput.value) patch.end = toLocalISO(parseDateTimeLocal(endInput.value));

    this.app.store.updateSegment(segId, patch);

    // Le re-rendu est ignoré tant que le focus reste dans le tableau : on met
    // donc à jour la durée de la ligne à la main pour un retour immédiat.
    const durCell = row.querySelector(".seg-dur");
    if (durCell) durCell.textContent = this.app.formatter.clock(this.app.calc.segmentMs(seg) / 60000);
  }
}
