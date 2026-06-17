import { Modal } from "./Modal.js";
import { el, escapeHtml } from "../../utils/dom.js";
import { fmtDateTimeLocal, parseDateTimeLocal, toLocalISO, sameDay, atTime } from "../../utils/datetime.js";

/**
 * Création / édition d'un segment (tâche, début, fin, brut). Remplace l'édition
 * en ligne du tableau : la table est en lecture seule, tout passe par ici.
 * Fin laissée vide ⇒ segment « en cours » (end = null).
 */
export class SegmentModal extends Modal {
  constructor(app) {
    super("segmentModal");
    this.app = app;
    this.segId = null;
  }

  bind() {
    this.bindDismiss();
    el("smSave").addEventListener("click", () => this.#save());
    el("smDelete").addEventListener("click", () => this.#delete());
  }

  #fillTasks(selectedId) {
    el("smTask").innerHTML = this.app.store.tasks.map((t) =>
      `<option value="${t.id}"${t.id === selectedId ? " selected" : ""}>${escapeHtml(t.displayName)}</option>`
    ).join("");
  }

  open(segId = null) {
    const { store } = this.app;
    this.segId = segId;
    const seg = segId ? store.segments.find((s) => s.id === segId) : null;

    if (seg) {
      this.#fillTasks(seg.taskId);
      el("smStart").value = fmtDateTimeLocal(new Date(seg.start));
      el("smEnd").value = seg.end ? fmtDateTimeLocal(new Date(seg.end)) : "";
      el("smRaw").checked = !!seg.raw;
      el("segmentModalTitle").textContent = "Modifier le segment";
      el("smDelete").hidden = false;
    } else {
      // Défaut : maintenant (si on est sur aujourd'hui) sinon l'arrivée du jour affiché, +1 h.
      const base = sameDay(this.app.viewDay, new Date())
        ? new Date()
        : atTime(this.app.viewDay, store.settings.arrival);
      base.setSeconds(0, 0);
      this.#fillTasks(store.lastUsedTask()?.id ?? store.tasks[0]?.id);
      el("smStart").value = fmtDateTimeLocal(base);
      el("smEnd").value = fmtDateTimeLocal(new Date(base.getTime() + 3_600_000));
      el("smRaw").checked = false;
      el("segmentModalTitle").textContent = "Segment manuel";
      el("smDelete").hidden = true;
    }
    super.open();
  }

  #save() {
    const taskId = el("smTask").value;
    const startV = el("smStart").value;
    if (!taskId || !startV) return;
    const start = parseDateTimeLocal(startV);
    const endV = el("smEnd").value;
    const end = endV ? parseDateTimeLocal(endV) : null;
    const raw = el("smRaw").checked;

    if (this.segId) {
      this.app.store.updateSegment(this.segId, {
        taskId, raw,
        start: toLocalISO(start),
        end: end ? toLocalISO(end) : null,
      });
    } else {
      this.app.store.addSegment({ taskId, start, end, raw });
      this.app.toast.show("Segment ajouté");
    }
    this.close();
  }

  #delete() {
    if (!this.segId) return;
    if (!confirm("Supprimer ce segment ?")) return;
    this.app.store.deleteSegment(this.segId);
    this.close();
  }
}
