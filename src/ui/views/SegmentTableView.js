import { el, escapeHtml } from "../../utils/dom.js";
import { fmtClock, fmtDateInput } from "../../utils/datetime.js";
import { icon } from "../icons.js";

/**
 * Tableau des segments du jour, **en lecture seule** : toute modification passe
 * par la modale (clic sur une ligne) ou par la timeline au-dessus (glisser).
 * Survol croisé avec la timeline via `app.highlightSegment` (data-seg-row ⇄ data-id).
 */
export class SegmentTableView {
  constructor(app) {
    this.app = app;
    this.body = el("segBody");
    this.anchor = this.body;
  }

  bind() {
    this.body.addEventListener("click", (e) => {
      // Clic sur la pastille de couleur = éditer la tâche (et non le segment).
      const sw = e.target.closest?.("[data-edit-task]");
      if (sw) { this.app.openEditTask(sw.getAttribute("data-edit-task")); return; }
      // Boutons de copie : copient sans ouvrir l'édition.
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
      // Reste de la ligne : ouvre la modale d'édition du segment.
      const row = e.target.closest?.("tr[data-seg-row]");
      if (row) this.app.openSegmentModal(row.getAttribute("data-seg-row"));
    });

    // Survol croisé : relie la ligne au bloc correspondant de la timeline.
    this.body.addEventListener("mouseover", (e) => {
      const row = e.target.closest?.("tr[data-seg-row]");
      this.app.highlightSegment(row ? row.getAttribute("data-seg-row") : null);
    });
    this.body.addEventListener("mouseleave", () => this.app.highlightSegment(null));

    el("addSegment").addEventListener("click", () => this.app.openSegmentModal());
  }

  render(viewDay) {
    const { store } = this.app;
    this.body.innerHTML = "";
    const segs = store.segmentsForDay(viewDay).sort((a, b) => a.startMs() - b.startMs());
    if (segs.length === 0) {
      this.body.innerHTML = '<tr><td colspan="6" class="empty">Aucun segment ce jour.</td></tr>';
      return;
    }
    for (const seg of segs) this.body.appendChild(this.#row(seg, viewDay));
  }

  #row(seg, viewDay) {
    const { store, calc, formatter } = this.app;
    const tr = document.createElement("tr");
    tr.setAttribute("data-seg-row", seg.id);
    tr.className = "seg-clickable" + (seg.isRunning ? " running" : "");
    tr.title = "Modifier ce segment";

    const start = new Date(seg.start);
    const end = seg.end ? new Date(seg.end) : null;
    const minutes = calc.segmentMs(seg) / 60000;
    const task = seg.isOff ? null : store.taskById(seg.taskId);
    const color = task ? task.color : "var(--text-faint)";
    const name = seg.isOff ? seg.reason : task ? task.displayName : "?";

    // Préfixe la date quand un bord n'est pas le jour affiché (segment multi-jours).
    const dayStr = fmtDateInput(viewDay);
    const stamp = (d) => (fmtDateInput(d) === dayStr ? "" : this.#shortDate(d) + " ") + fmtClock(d);
    const startTxt = stamp(start);
    const endTxt = end ? stamp(end) : '<span class="seg-live">en cours</span>';

    // Un vide justifié : pastille vide (aucune tâche à éditer), le motif suivi
    // d'un tag, pas de copie — rien à reporter dans Jira.
    const swatch = seg.isOff
      ? `<span class="seg-swatch off" title="Hors tâche"></span>`
      : `<span class="seg-swatch" style="background:${color}" data-edit-task="${seg.taskId}" title="Éditer la tâche"></span>`;
    tr.innerHTML =
      `<td><div class="seg-task-cell">${swatch}` +
        `<span class="seg-task-name">${escapeHtml(name)}</span>` +
        (seg.isOff ? `<span class="raw-tag">hors tâche</span>` : "") + `</div></td>` +
      `<td class="seg-time">${startTxt}</td>` +
      `<td class="seg-time">${endTxt}</td>` +
      `<td>${seg.raw ? '<span class="raw-tag">brut</span>' : '<span class="seg-dash">—</span>'}</td>` +
      `<td class="seg-dur">${formatter.clock(minutes)}</td>` +
      `<td><div class="seg-actions">` +
        (seg.isOff ? "" :
          `<button class="mini-btn" data-copy="${seg.id}" data-fmt="dec" title="Copier en décimal">${icon("copy", { size: 14 })} Déc.</button>` +
          `<button class="mini-btn" data-copy="${seg.id}" data-fmt="jira" title="Copier en Jira">${icon("copy", { size: 14 })} Jira</button>`) +
      `</div></td>`;
    return tr;
  }

  #shortDate(d) {
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  }
}
