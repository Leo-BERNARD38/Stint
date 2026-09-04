import { el, createEl, escapeHtml } from "../../utils/dom.js";
import { TASK_TYPES, WEEKDAY_LABELS } from "../../core/constants.js";
import { icon } from "../icons.js";
import { createCopyButton } from "../components/CopyButton.js";

const TOP_N = 8;

/**
 * Les répartitions de la période : **par type**, **par jour de semaine** et
 * **top tâches**. Trois façons de répondre à « où est passé mon temps ? » —
 * la nature du travail, le moment où il tombe, et les sujets qui le mangent.
 */
export class StatsBreakdownView {
  constructor(app) {
    this.app = app;
    this.types = el("statsTypes");
    this.weekdays = el("statsWeekdays");
    this.tasks = el("statsTopTasks");
    this.off = el("statsOff");
    this.anchor = this.types;
    this.offOpen = false; // « Exceptionnels » déplié ? (état d'UI, pas de données)
  }

  bind() {
    this.tasks.addEventListener("click", (e) => {
      const row = e.target.closest("[data-task]");
      if (row && !e.target.closest(".mini-btn")) this.app.openEditTask(row.dataset.task);
    });
    this.off.addEventListener("click", (e) => {
      if (!e.target.closest('[data-act="toggle-off-other"]')) return;
      this.offOpen = !this.offOpen;
      this.#renderOff(this.app.stats.snapshot(this.app.statsPeriod));
    });
  }

  render() {
    const snap = this.app.stats.snapshot(this.app.statsPeriod);
    this.#renderTypes(snap);
    this.#renderWeekdays(snap);
    this.#renderTasks(snap);
    this.#renderOff(snap);
  }

  /* ----------------- hors tâche ----------------- */
  /**
   * Les vides justifiés de la période. Par ligne, la part du HORS TÂCHE (« un
   * tiers de mes vides sont des réunions ») ; en pied, la part des horaires de
   * la période, avec une décimale sous 10 % — sur trois mois, une heure de
   * réunions vaut 0,3 %, et un « 0 % » arrondi mentirait. Les motifs épinglés
   * d'abord, dans l'ordre des réglages ; les exceptionnels — tapés une fois —
   * repliés sous une ligne unique, pour que le bloc ne grandisse pas avec
   * l'historique. La partition se lit dans les réglages AU RENDU : retirer un
   * épinglé le fait basculer dans les exceptionnels sans rien recalculer.
   */
  #renderOff({ kpi }) {
    const { formatter, store } = this.app;
    const clock = (ms) => formatter.clock(ms / 60000);
    const pct = (ms) => (kpi.offMs > 0 ? Math.round((ms / kpi.offMs) * 100) : 0);
    const ofSchedule = () => {
      if (kpi.scheduledMs <= 0) return "";
      const p = (kpi.offMs / kpi.scheduledMs) * 100;
      return ` · ${p < 10 ? p.toFixed(1).replace(".", ",") : Math.round(p)} % des horaires de la période`;
    };
    this.off.innerHTML = "";
    if (!kpi.offByReason.length) {
      this.off.appendChild(createEl("div", { className: "empty", text: "Aucun vide justifié sur la période." }));
      return;
    }
    const pinned = kpi.offByReason.filter((r) => store.settings.isPinnedOff(r.label));
    const other = kpi.offByReason.filter((r) => !store.settings.isPinnedOff(r.label));
    const max = Math.max(1, ...kpi.offByReason.map((r) => r.ms));
    const row = ({ label, ms }) => createEl("div", {
      className: "stat-type stat-off",
      html:
        `<span class="stat-off-lab">${escapeHtml(label)}</span>` +
        `<div class="stat-bar-track"><div class="stat-bar off" style="width:${Math.max(2, Math.round((ms / max) * 100))}%"></div></div>` +
        `<span class="stat-type-val">${clock(ms)}</span>` +
        `<span class="stat-type-pct">${pct(ms)} %</span>`,
    });
    for (const r of pinned) this.off.appendChild(row(r));
    if (other.length) {
      const rest = other.reduce((a, r) => a + r.ms, 0);
      this.off.appendChild(createEl("button", {
        className: "stat-off-toggle" + (this.offOpen ? " open" : ""),
        attrs: { "data-act": "toggle-off-other", type: "button" },
        html:
          `<span class="stat-off-lab">Exceptionnels (${other.length})</span>` +
          `<span class="o-chev">${icon("chevron-down", { size: 16 })}</span>` +
          `<span class="stat-type-val">${clock(rest)}</span>` +
          `<span class="stat-type-pct">${pct(rest)} %</span>`,
      }));
      if (this.offOpen) {
        const box = createEl("div", { className: "stat-off-other" });
        for (const r of other) box.appendChild(row(r));
        this.off.appendChild(box);
      }
    }
    this.off.appendChild(createEl("div", {
      className: "stat-off-sum",
      text: `${clock(kpi.offMs)} hors tâche${ofSchedule()}`,
    }));
  }

  /* ----------------- par type ----------------- */
  #renderTypes({ kpi }) {
    const clock = (ms) => this.app.formatter.clock(ms / 60000);
    const max = Math.max(1, ...TASK_TYPES.map((t) => kpi.byType[t]));
    this.types.innerHTML = "";
    for (const t of TASK_TYPES) {
      const ms = kpi.byType[t] ?? 0;
      const share = kpi.total > 0 ? Math.round((ms / kpi.total) * 100) : 0;
      this.types.appendChild(createEl("div", {
        className: "stat-type",
        html:
          `<span class="type-badge type-${t}">${t}</span>` +
          `<div class="stat-bar-track"><div class="stat-bar" style="width:${Math.round((ms / max) * 100)}%;background:var(--dot-${t})"></div></div>` +
          `<span class="stat-type-val">${clock(ms)}</span>` +
          `<span class="stat-type-pct">${share} %</span>`,
      }));
    }
  }

  /* ----------------- par jour de semaine ----------------- */
  #renderWeekdays({ byWeekday }) {
    const clock = (ms) => this.app.formatter.clock(ms / 60000);
    const max = Math.max(1, ...byWeekday);
    this.weekdays.innerHTML = "";
    byWeekday.forEach((ms, i) => {
      const col = createEl("div", {
        className: "wd" + (ms > 0 && ms === max ? " peak" : ""),
        attrs: { title: `${WEEKDAY_LABELS[i]} · ${clock(ms)}` },
      });
      col.appendChild(createEl("div", { className: "wd-val", text: ms > 0 ? clock(ms) : "" }));
      const track = createEl("div", { className: "wd-track" });
      track.appendChild(createEl("div", {
        className: "wd-bar",
        attrs: { style: `height:${ms > 0 ? Math.max(3, (ms / max) * 100) : 0}%` },
      }));
      col.append(track, createEl("div", { className: "wd-lab", text: WEEKDAY_LABELS[i] }));
      this.weekdays.appendChild(col);
    });
  }

  /* ----------------- top tâches ----------------- */
  #renderTasks({ byTask }) {
    const { formatter } = this.app;
    this.tasks.innerHTML = "";
    if (!byTask.length) {
      this.tasks.appendChild(createEl("div", { className: "empty", text: "Aucune tâche tracée sur cette période." }));
      return;
    }
    const max = byTask[0].ms;
    for (const { task, ms, share } of byTask.slice(0, TOP_N)) {
      const mins = ms / 60000;
      const row = createEl("div", {
        className: "tt",
        attrs: task ? { "data-task": task.id, title: "Éditer la tâche" } : {},
      });
      row.appendChild(createEl("span", {
        className: "swatch",
        attrs: { style: `background:${task?.color ?? "var(--text-faint)"}` },
      }));
      row.appendChild(createEl("div", {
        className: "tt-main",
        html:
          `<div class="tt-name"><span class="tt-label">${escapeHtml(task?.displayName ?? "(tâche supprimée)")}</span>` +
          (task ? `<span class="type-badge type-${task.type}">${task.type}</span>` : "") +
          (task?.done ? '<span class="badge-done">terminé</span>' : "") + "</div>" +
          `<div class="stat-bar-track"><div class="stat-bar" style="width:${Math.max(2, (ms / max) * 100)}%;background:${task?.color ?? "var(--text-faint)"}"></div></div>`,
      }));
      row.appendChild(createEl("span", { className: "tt-share", text: Math.round(share * 100) + " %" }));
      row.appendChild(createEl("span", { className: "tt-dur", text: formatter.clock(mins) }));
      const actions = createEl("div", { className: "tt-actions" });
      actions.append(
        createCopyButton(this.app, formatter.decimal(mins), "Déc."),
        createCopyButton(this.app, formatter.jira(mins), "Jira"),
      );
      if (task?.link) {
        actions.appendChild(createEl("a", {
          className: "mini-btn icon-only link-btn",
          html: icon("external-link", { size: 15 }),
          attrs: { href: task.link, target: "_blank", rel: "noopener noreferrer", title: "Ouvrir le lien" },
          on: { click: (e) => e.stopPropagation() },
        }));
      }
      row.appendChild(actions);
      this.tasks.appendChild(row);
    }
    if (byTask.length > TOP_N) {
      const rest = byTask.slice(TOP_N).reduce((a, r) => a + r.ms, 0);
      this.tasks.appendChild(createEl("div", {
        className: "tt-rest",
        text: `+ ${byTask.length - TOP_N} autres tâches · ${formatter.clock(rest / 60000)}`,
      }));
    }
  }
}
