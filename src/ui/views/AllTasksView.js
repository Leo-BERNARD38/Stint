import { el, createEl, escapeHtml } from "../../utils/dom.js";
import { TASK_TYPES } from "../../core/constants.js";
import { icon } from "../icons.js";
import { createCopyButton } from "../components/CopyButton.js";
import {
  sameDay, addDays, isoDow, startOfDay, fmtClock, fmtDateInput, pad2, cap,
} from "../../utils/datetime.js";

/**
 * Onglet Tâches : recherche/filtres + liste des tâches **regroupées** par jour,
 * semaine ou mois (selon la date d'ouverture). Chaque en-tête de groupe affiche
 * le total du groupe et un bouton « Récap Jira » (une ligne « tâche → durée »
 * par tâche, prêt à coller). Les temps sont en brut/net selon les segments.
 */
export class AllTasksView {
  constructor(app) {
    this.app = app;
    this.root = el("allTasks");
    this.expanded = new Set();
    this.filter = { q: "", types: new Set(TASK_TYPES), state: "all", group: "day" };
  }

  bind() {
    this.root.addEventListener("click", (e) => {
      // Les boutons de copie (en-tête de tâche, en-tête de groupe) agissent sans
      // déclencher le plier/déplier.
      if (e.target.closest(".at-actions, .at-date-copy")) return;
      const head = e.target.closest("[data-task-toggle]");
      if (head) { this.#toggle(head.dataset.taskToggle); return; }
      const seg = e.target.closest("[data-seg-day]");
      if (seg) this.app.goToDaySegments(seg.dataset.segDay);
    });
    this.root.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      if (e.target.closest(".at-actions, .at-date-copy")) return;
      const head = e.target.closest("[data-task-toggle]");
      if (head) { e.preventDefault(); this.#toggle(head.dataset.taskToggle); }
    });

    // --- contrôles (câblés une seule fois ; ne touchent qu'à `filter` puis re-rendu) ---
    el("atSearch").addEventListener("input", (e) => { this.filter.q = e.target.value.trim().toLowerCase(); this.render(); });
    el("atTypes").addEventListener("click", (e) => {
      const b = e.target.closest("[data-type]");
      if (!b) return;
      const t = b.dataset.type;
      this.filter.types.has(t) ? this.filter.types.delete(t) : this.filter.types.add(t);
      b.classList.toggle("active");
      this.render();
    });
    el("atState").addEventListener("change", (e) => { this.filter.state = e.target.value; this.render(); });
    const groupGroup = el("atGroup");
    groupGroup.addEventListener("click", (e) => {
      const b = e.target.closest("[data-group]");
      if (!b) return;
      this.filter.group = b.dataset.group;
      [...groupGroup.children].forEach((c) => c.classList.toggle("active", c === b));
      this.render();
    });
  }

  /**
   * Plie/déplie une tâche en agissant sur le DOM vivant (pas de re-render
   * complet) pour que la transition CSS hauteur + chevron puisse jouer.
   */
  #toggle(id) {
    const willOpen = !this.expanded.has(id);
    willOpen ? this.expanded.add(id) : this.expanded.delete(id);
    const head = this.root.querySelector(`[data-task-toggle="${CSS.escape(id)}"]`);
    const card = head?.closest(".at-task");
    if (!card) { this.render(); return; }
    card.classList.toggle("open", willOpen);
    head.setAttribute("aria-expanded", String(willOpen));
  }

  render() {
    const { store, calc } = this.app;
    const f = this.filter;

    const matches = (t) => {
      if (!f.types.has(t.type)) return false;
      if (f.state === "open" && (t.done || t.archived)) return false;
      if (f.state === "done" && !t.done) return false;
      if (f.state === "archived" && !t.archived) return false;
      if (f.q && !t.displayName.toLowerCase().includes(f.q)) return false;
      return true;
    };

    const metas = store.tasks.filter(matches).map((task) => {
      const segs = store.segments.filter((s) => s.taskId === task.id).sort((a, b) => b.startMs() - a.startMs());
      const openedAt = segs.length ? Math.min(...segs.map((s) => s.startMs())) : null;
      return { task, segs, openedAt, total: calc.taskTotalMs(task.id) };
    });

    this.#renderList(metas);
  }

  /** Clé/étiquette/ordre du groupe d'une tâche selon la granularité choisie. */
  #groupOf(openedAt) {
    if (openedAt == null) return { key: "—", label: "Sans segment", order: -Infinity };
    const d = new Date(openedAt);
    if (this.filter.group === "month") {
      return {
        key: d.getFullYear() + "-" + pad2(d.getMonth() + 1),
        label: cap(d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })),
        order: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
      };
    }
    if (this.filter.group === "week") {
      const monday = addDays(startOfDay(d), -(isoDow(d) - 1));
      return {
        key: fmtDateInput(monday),
        label: "Semaine du " + monday.toLocaleDateString("fr-FR", { day: "numeric", month: "long" }),
        order: monday.getTime(),
      };
    }
    return { key: fmtDateInput(d), label: this.#dayLabel(d), order: startOfDay(d).getTime() };
  }

  #renderList(metas) {
    this.root.innerHTML = "";
    if (metas.length === 0) {
      this.root.innerHTML = '<div class="empty">Aucune tâche ne correspond.</div>';
      return;
    }

    // Regroupe puis ordonne les groupes (plus récents en haut).
    const groups = new Map();
    for (const m of metas) {
      const g = this.#groupOf(m.openedAt);
      if (!groups.has(g.key)) groups.set(g.key, { g, items: [] });
      groups.get(g.key).items.push(m);
    }
    const ordered = [...groups.values()].sort((a, b) => b.g.order - a.g.order);

    for (const grp of ordered) {
      grp.items.sort((a, b) => (b.openedAt ?? -Infinity) - (a.openedAt ?? -Infinity));
      this.root.appendChild(this.#groupHeader(grp));
      for (const m of grp.items) this.root.appendChild(this.#taskCard(m));
    }
  }

  #groupHeader({ g, items }) {
    const fmt = this.app.formatter;
    const totalMs = items.reduce((s, m) => s + m.total, 0);
    const lines = items.filter((m) => m.total > 0)
      .sort((a, b) => b.total - a.total)
      .map((m) => `${m.task.displayName}\t${fmt.jira(m.total / 60000)}`)
      .join("\n");

    const head = createEl("div", { className: "at-date" });
    head.appendChild(createEl("span", { className: "at-date-label", text: g.label }));
    head.appendChild(createEl("span", { className: "at-date-total", text: fmt.clock(totalMs / 60000) }));
    const copyBtn = createEl("button", {
      className: "mini-btn at-date-copy",
      html: icon("copy", { size: 13 }) + " Jira",
      attrs: { title: "Copier le récap Jira de ce groupe (tâche → durée)" },
      on: { click: (e) => this.app.copy(lines, e.currentTarget) },
    });
    copyBtn.disabled = !lines;
    head.appendChild(copyBtn);
    return head;
  }

  #taskCard({ task, segs, total }) {
    const fmt = this.app.formatter;
    const open = this.expanded.has(task.id);
    const card = createEl("div", { className: "at-task" + (open ? " open" : "") });

    const head = createEl("div", {
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
    });

    // Copie du temps total de la tâche (brut/net déjà pris en compte dans `total`).
    const mins = total / 60000;
    const actions = createEl("div", { className: "at-actions" });
    actions.append(
      createCopyButton(this.app, fmt.decimal(mins), "Déc."),
      createCopyButton(this.app, fmt.jira(mins), "Jira"),
      createEl("button", {
        className: "mini-btn icon-only",
        html: icon("pencil", { size: 15 }),
        attrs: { title: "Éditer la tâche", "aria-label": "Éditer la tâche" },
        on: { click: () => this.app.openEditTask(task.id) },
      }),
    );
    head.appendChild(actions);
    card.appendChild(head);

    // La liste est toujours dans le DOM (repliée en hauteur 0 via CSS) : c'est
    // ce qui permet d'animer l'ouverture/fermeture sans reconstruire la carte.
    const wrap = createEl("div", { className: "at-segs-wrap" });
    const list = createEl("div", { className: "at-segs" });
    if (segs.length === 0) {
      list.appendChild(createEl("div", { className: "at-empty", text: "Aucun segment." }));
    } else {
      for (const s of segs) list.appendChild(this.#segLine(s));
    }
    wrap.appendChild(list);
    card.appendChild(wrap);
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
