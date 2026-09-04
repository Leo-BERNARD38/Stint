import { Modal } from "./Modal.js";
import { el, escapeHtml } from "../../utils/dom.js";
import { fmtDateTimeLocal, parseDateTimeLocal, toLocalISO, sameDay, atTime, pad2 } from "../../utils/datetime.js";

/* Une raison par cause, comme partout : un bouton impossible est désactivé et
   DIT pourquoi dans son `title`, il n'est pas caché. */
const MERGE_WHY = {
  prev: { missing: "Aucun segment avant celui-ci", task: "Le segment précédent est d'une autre tâche", blocked: "Un autre segment s'intercale" },
  next: { missing: "Aucun segment après celui-ci", task: "Le segment suivant est d'une autre tâche", blocked: "Un autre segment s'intercale" },
};

/**
 * Création / édition d'un segment (tâche, début, fin, brut). Remplace l'édition
 * en ligne du tableau : la table est en lecture seule, tout passe par ici.
 * Fin laissée vide ⇒ segment « en cours » (end = null).
 *
 * En édition, deux outils de plus : **couper** le segment à une heure (« en fait
 * j'ai changé de tâche à 14 h 30 » = couper, puis changer la tâche de la moitié
 * droite) et **fusionner** avec le voisin de même tâche (l'écart est absorbé).
 * Les deux vivent ici et pas sur la timeline : un Alt+clic serait indevinable,
 * et le popover « Prolonger » couvre déjà la fusion à travers un trou.
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
    el("smSplit").addEventListener("click", () => this.#split());
    el("smMergePrev").addEventListener("click", () => this.#merge("prev"));
    el("smMergeNext").addEventListener("click", () => this.#merge("next"));
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
      this.#renderTools(seg);
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
      el("smTools").hidden = true;
    }
    super.open();
  }

  /** Outils d'édition : heure de coupe par défaut au milieu (calée à 5 min), fusion selon `canMerge`. */
  #renderTools(seg) {
    const { store } = this.app;
    el("smTools").hidden = false;
    const end = seg.isRunning ? Date.now() : seg.endMs();
    const mid = new Date(Math.round((seg.startMs() + end) / 2 / 300_000) * 300_000);
    el("smSplitAt").value = pad2(mid.getHours()) + ":" + pad2(mid.getMinutes());
    const { prev, next } = store.neighbours(seg.id);
    for (const [side, other] of [["prev", prev], ["next", next]]) {
      const btn = el(side === "prev" ? "smMergePrev" : "smMergeNext");
      const why = other ? store.canMerge(seg.id, other.id) : "missing";
      btn.disabled = !!why;
      btn.title = why ? MERGE_WHY[side][why] : `Absorber l'écart et ne faire qu'un segment avec ${side === "prev" ? "le précédent" : "le suivant"}`;
    }
  }

  #split() {
    const seg = this.app.store.segments.find((s) => s.id === this.segId);
    const v = el("smSplitAt").value;
    if (!seg || !/^\d{2}:\d{2}$/.test(v)) return;
    // L'heure est posée sur la date du début ; si elle tombe avant lui (segment
    // de nuit), c'est le lendemain — même astuce que `updateSegment`.
    let at = atTime(new Date(seg.start), v);
    if (at.getTime() <= seg.startMs()) at.setDate(at.getDate() + 1);
    const res = this.app.store.splitSegment(seg.id, at.getTime());
    if (res === "outside") { el("smSplitAt").focus(); return; }
    this.close();
  }

  #merge(side) {
    const other = this.app.store.neighbours(this.segId)[side];
    if (!other) return;
    if (this.app.store.mergeSegments(this.segId, other.id) === "merged") this.close();
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
