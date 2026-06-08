import { el, createEl, escapeHtml } from "../../utils/dom.js";
import { icon } from "../icons.js";
import { sameDay, addDays, fmtClock, fmtDateInput } from "../../utils/datetime.js";

/**
 * Liste de toutes les tâches, groupées par date d'ouverture (la plus récente
 * en haut). Chaque tâche se déplie pour afficher tous ses segments ; cliquer
 * un segment ouvre son jour dans l'onglet Segments.
 */
export class AllTasksView {
  constructor(app) {
    this.app = app;
    this.root = el("allTasks");
    this.expanded = new Set();
  }

  bind() {
    this.root.addEventListener("click", (e) => {
      const head = e.target.closest("[data-task-toggle]");
      if (head) { this.#toggle(head.dataset.taskToggle); return; }
      const seg = e.target.closest("[data-seg-day]");
      if (seg) this.app.goToDaySegments(seg.dataset.segDay);
    });
    this.root.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const head = e.target.closest("[data-task-toggle]");
      if (head) { e.preventDefault(); this.#toggle(head.dataset.taskToggle); }
    });
  }

  #toggle(id) {
    this.expanded.has(id) ? this.expanded.delete(id) : this.expanded.add(id);
    this.render();
  }

  render() {
    const { store, calc } = this.app;
    this.root.innerHTML = "";

    const metas = store.tasks.map((task) => {
      const segs = store.segments
        .filter((s) => s.taskId === task.id)
        .sort((a, b) => b.startMs() - a.startMs());
      const openedAt = segs.length ? Math.min(...segs.map((s) => s.startMs())) : null;
      const total = segs.reduce((sum, s) => sum + calc.segmentMs(s), 0);
      return { task, segs, openedAt, total };
    });

    if (metas.length === 0) {
      this.root.innerHTML = '<div class="empty">Aucune tâche pour l\'instant.</div>';
      return;
    }

    metas.sort((a, b) => (b.openedAt ?? -Infinity) - (a.openedAt ?? -Infinity));

    let currentDay = null;
    for (const m of metas) {
      const dayKey = m.openedAt ? fmtDateInput(new Date(m.openedAt)) : "—";
      if (dayKey !== currentDay) {
        currentDay = dayKey;
        this.root.appendChild(createEl("div", {
          className: "at-date",
          text: m.openedAt ? this.#dayLabel(new Date(m.openedAt)) : "Sans segment",
        }));
      }
      this.root.appendChild(this.#taskCard(m));
    }
  }

  #taskCard({ task, segs, total }) {
    const fmt = this.app.formatter;
    const open = this.expanded.has(task.id);
    const card = createEl("div", { className: "at-task" + (open ? " open" : "") });

    card.appendChild(createEl("div", {
      className: "at-head",
      attrs: { "data-task-toggle": task.id, role: "button", tabindex: "0", "aria-expanded": String(open) },
      html:
        `<span class="at-chev">${icon("chevron-right", { size: 16 })}</span>` +
        `<span class="swatch" style="background:${task.color}"></span>` +
        `<div class="at-main"><div class="at-name">${escapeHtml(task.displayName)}` +
          `<span class="type-badge type-${task.type}">${task.type}</span>` +
          (task.done ? `<span class="badge-done">terminé</span>` : "") +
          (task.archived ? `<span class="badge-done">archivé</span>` : "") +
        `</div><div class="at-sub">${segs.length} segment${segs.length > 1 ? "s" : ""}</div></div>` +
        `<span class="at-total">${fmt.clock(total / 60000)}</span>`,
    }));

    if (open) {
      const list = createEl("div", { className: "at-segs" });
      if (segs.length === 0) {
        list.appendChild(createEl("div", { className: "at-empty", text: "Aucun segment." }));
      } else {
        for (const s of segs) list.appendChild(this.#segLine(s));
      }
      card.appendChild(list);
    }
    return card;
  }

  #segLine(seg) {
    const fmt = this.app.formatter;
    const start = new Date(seg.start);
    const end = seg.end ? new Date(seg.end) : null;
    const dur = this.app.calc.segmentMs(seg) / 60000;
    const oneDay = end && fmtDateInput(end) === fmtDateInput(start);
    const range = !end
      ? `${fmtClock(start)} · en cours`
      : oneDay
        ? `${fmtClock(start)}–${fmtClock(end)}`
        : `${this.#shortDate(start)} ${fmtClock(start)} → ${this.#shortDate(end)} ${fmtClock(end)}`;

    return createEl("div", {
      className: "at-seg",
      attrs: { "data-seg-day": fmtDateInput(start), title: "Ouvrir ce jour dans Segments" },
      html:
        `<span class="at-seg-date">${this.#shortDate(start)}</span>` +
        `<span class="at-seg-range">${range}</span>` +
        (seg.raw ? `<span class="raw-tag">brut</span>` : "") +
        `<span class="at-seg-dur">${fmt.clock(dur)}</span>`,
    });
  }

  #dayLabel(d) {
    const today = new Date();
    if (sameDay(d, today)) return "Aujourd'hui";
    if (sameDay(d, addDays(today, -1))) return "Hier";
    return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  #shortDate(d) {
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  }
}
