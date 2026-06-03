import { el, escapeHtml } from "../../utils/dom.js";
import { fmtClock, fmtDateInput, parseDateInput, toLocalISO } from "../../utils/datetime.js";

/**
 * Tableau des segments éditables (heures, date, tâche, mode brut) + suppression.
 * Toute édition d'une ligne reconstruit start/end puis délègue à `store.updateSegment`.
 */
export class SegmentTableView {
  constructor(app) {
    this.app = app;
    this.body = el("segBody");
  }

  bind() {
    this.body.addEventListener("change", (e) => this.#onChange(e));
    this.body.addEventListener("click", (e) => {
      const id = e.target.getAttribute?.("data-del");
      if (id && confirm("Supprimer ce segment ?")) this.app.store.deleteSegment(id);
    });
    el("addSegment").addEventListener("click", () => this.app.addManualSegmentDefault());
  }

  render(viewDay) {
    const { store } = this.app;
    this.body.innerHTML = "";
    const segs = store.segmentsForDay(viewDay).sort((a, b) => a.startMs() - b.startMs());
    if (segs.length === 0) {
      this.body.innerHTML = '<tr><td colspan="7" class="empty">Aucun segment ce jour.</td></tr>';
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

    const options = store.tasks.map((t) =>
      `<option value="${t.id}"${t.id === seg.taskId ? " selected" : ""}>` +
      escapeHtml(t.displayName + (t.jiraKey ? " · " + t.jiraKey : "")) + "</option>"
    ).join("");

    tr.innerHTML =
      `<td><select data-seg="${seg.id}" data-field="taskId">${options}</select></td>` +
      `<td class="col-date"><input type="date" data-seg="${seg.id}" data-field="startDate" value="${fmtDateInput(start)}"></td>` +
      `<td><input type="time" data-seg="${seg.id}" data-field="startTime" value="${fmtClock(start)}"></td>` +
      `<td>${end
        ? `<input type="time" data-seg="${seg.id}" data-field="endTime" value="${fmtClock(end)}">`
        : '<span style="color:var(--play);font-weight:600">en cours</span>'}</td>` +
      `<td><input type="checkbox" class="raw-toggle" data-seg="${seg.id}" data-field="raw"${seg.raw ? " checked" : ""} title="Temps brut (sans rognage ouvré)"></td>` +
      `<td class="seg-dur">${this.app.formatter.decimal(minutes)} h</td>` +
      `<td><button class="mini-btn" data-del="${seg.id}" title="Supprimer">🗑</button></td>`;
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

    const dateInput = field("startDate");
    const day = dateInput ? parseDateInput(dateInput.value) : new Date(seg.start);

    const start = new Date(seg.start);
    start.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    const [sh, sm] = field("startTime").value.split(":").map(Number);
    start.setHours(sh, sm, 0, 0);
    patch.start = toLocalISO(start);

    const endInput = field("endTime");
    if (endInput) {
      const end = new Date(seg.end);
      end.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
      const [eh, em] = endInput.value.split(":").map(Number);
      end.setHours(eh, em, 0, 0);
      patch.end = toLocalISO(end);
    }

    this.app.store.updateSegment(segId, patch);
  }
}
