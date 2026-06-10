import { el, createEl, escapeHtml } from "../../utils/dom.js";
import { icon } from "../icons.js";
import { createCopyButton } from "../components/CopyButton.js";
import {
  sameDay, addDays, isoDow, startOfDay, fmtClock, fmtDateInput, parseDateInput,
} from "../../utils/datetime.js";

const TYPES = ["dev", "support", "autre"];

/**
 * Onglet Tâches : recherche/filtres + agrégation par période (récap Jira) + liste
 * des tâches groupées par date d'ouverture. Quand une période est choisie, les
 * temps et les segments affichés sont bornés à cette fenêtre (brut/net respecté).
 */
export class AllTasksView {
  constructor(app) {
    this.app = app;
    this.root = el("allTasks");
    this.recap = el("atRecap");
    this.expanded = new Set();
    this.filter = { period: "all", from: "", to: "", q: "", types: new Set(TYPES), state: "all" };
    this._win = null; // fenêtre courante (ms) ou null, partagée avec les helpers de rendu
  }

  bind() {
    this.root.addEventListener("click", (e) => {
      // Les boutons de copie vivent dans l'en-tête : on les laisse agir sans
      // déclencher le plier/déplier de la tâche.
      if (e.target.closest(".at-actions")) return;
      const head = e.target.closest("[data-task-toggle]");
      if (head) { this.#toggle(head.dataset.taskToggle); return; }
      const seg = e.target.closest("[data-seg-day]");
      if (seg) this.app.goToDaySegments(seg.dataset.segDay);
    });
    this.root.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      if (e.target.closest(".at-actions")) return;
      const head = e.target.closest("[data-task-toggle]");
      if (head) { e.preventDefault(); this.#toggle(head.dataset.taskToggle); }
    });

    // --- contrôles (câblés une seule fois ; ne touchent qu'à `filter` puis re-rendu) ---
    const periodGroup = el("atPeriod");
    periodGroup.addEventListener("click", (e) => {
      const b = e.target.closest("[data-period]");
      if (!b) return;
      this.filter.period = b.dataset.period;
      [...periodGroup.children].forEach((c) => c.classList.toggle("active", c === b));
      el("atCustom").hidden = this.filter.period !== "custom";
      this.render();
    });
    el("atFrom").addEventListener("change", (e) => { this.filter.from = e.target.value; this.render(); });
    el("atTo").addEventListener("change", (e) => { this.filter.to = e.target.value; this.render(); });
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

  /** Fenêtre temporelle de la période choisie : {start, end, label} ou null (« Tout »). */
  #window() {
    const f = this.filter;
    if (f.period === "all") return null;
    const today = startOfDay(new Date());
    if (f.period === "week") {
      const monday = addDays(today, -(isoDow(today) - 1));
      return { start: monday.getTime(), end: addDays(monday, 7).getTime(), label: "Cette semaine" };
    }
    if (f.period === "month") {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      const e = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      return { start: s.getTime(), end: e.getTime(), label: s.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) };
    }
    if (f.from && f.to) { // période personnalisée (bornes incluses)
      const s = parseDateInput(f.from);
      const e = addDays(parseDateInput(f.to), 1);
      if (e.getTime() > s.getTime()) {
        return { start: s.getTime(), end: e.getTime(), label: `${this.#shortDate(s)} – ${this.#shortDate(addDays(e, -1))}` };
      }
    }
    return null;
  }

  render() {
    const { store, calc } = this.app;
    const win = this._win = this.#window();
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
      let segs = store.segments.filter((s) => s.taskId === task.id);
      if (win) segs = segs.filter((s) => s.startMs() < win.end && s.endMs() > win.start);
      segs.sort((a, b) => b.startMs() - a.startMs());
      const openedAt = segs.length ? Math.min(...segs.map((s) => s.startMs())) : null;
      const total = win ? calc.taskTotalMs(task.id, win.start, win.end) : calc.taskTotalMs(task.id);
      return { task, segs, openedAt, total };
    });

    const visible = win ? metas.filter((m) => m.total > 0) : metas;
    this.#renderRecap(win, visible);
    this.#renderList(visible);
  }

  /* ----------------- récap période ----------------- */
  #renderRecap(win, metas) {
    this.recap.hidden = !win;
    this.recap.innerHTML = "";
    if (!win) return;
    const fmt = this.app.formatter;
    const totalMs = metas.reduce((s, m) => s + m.total, 0);
    const byType = {};
    for (const m of metas) byType[m.task.type] = (byType[m.task.type] ?? 0) + m.total;

    this.recap.appendChild(createEl("div", {
      className: "at-recap-head",
      html:
        `<span class="at-recap-total">${fmt.clock(totalMs / 60000)}</span>` +
        `<span class="at-recap-label">${escapeHtml(win.label)} · ${metas.length} tâche${metas.length > 1 ? "s" : ""}</span>`,
    }));

    const types = createEl("div", { className: "at-recap-types" });
    for (const t of TYPES) if (byType[t] > 0) {
      types.appendChild(createEl("span", {
        html: `<span class="type-badge type-${t}">${t}</span> ${fmt.clock(byType[t] / 60000)}`,
      }));
    }
    if (types.children.length) this.recap.appendChild(types);

    const actions = createEl("div", { className: "at-recap-actions" });
    actions.append(
      createCopyButton(this.app, fmt.decimal(totalMs / 60000), "Total déc."),
      createCopyButton(this.app, fmt.jira(totalMs / 60000), "Total Jira"),
    );
    // Récap « tâche → durée Jira », une ligne par tâche, prêt à coller.
    const lines = metas.filter((m) => m.total > 0)
      .sort((a, b) => b.total - a.total)
      .map((m) => `${m.task.displayName}\t${fmt.jira(m.total / 60000)}`)
      .join("\n");
    const recapBtn = createEl("button", {
      className: "mini-btn",
      html: icon("copy", { size: 14 }) + " Récap Jira",
      attrs: { title: "Copier la liste « tâche → durée Jira »" },
      on: { click: (e) => this.app.copy(lines, e.currentTarget) },
    });
    recapBtn.disabled = !lines;
    actions.appendChild(recapBtn);
    this.recap.appendChild(actions);
  }

  /* ----------------- liste ----------------- */
  #renderList(metas) {
    this.root.innerHTML = "";
    if (metas.length === 0) {
      this.root.innerHTML = '<div class="empty">Aucune tâche ne correspond.</div>';
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
    const dur = this.app.calc.segmentMs(seg, this._win?.start ?? null, this._win?.end ?? null) / 60000;
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
