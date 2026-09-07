import { el, createEl, escapeHtml } from "../../utils/dom.js";
import { TASK_TYPES } from "../../core/constants.js";
import { icon } from "../icons.js";
import { createCopyButton } from "../components/CopyButton.js";

const TASKS_SHOWN = 12; // au-delà, replié derrière « + N autres »

/**
 * Bloc « Détail » : l'outil pratique de la rétrospective, en **quatre onglets
 * dont un seul est rendu**.
 *
 * C'étaient quatre blocs empilés — Répartition, Top tâches, Hors tâche,
 * Semaine par semaine — et le hors tâche, enterré en avant-dernier, ne se
 * trouvait pas. Les commuter ne fait pas que raccourcir la page : quatre
 * découpages du même total, l'un sous l'autre, se lisent comme quatre mesures
 * différentes. On en regarde un à la fois, parce qu'on ne se pose qu'une
 * question à la fois.
 *
 * « Découpage » est la généralisation de l'ancien récap hebdomadaire : l'unité
 * suit le grain (semaine → jours, mois → semaines, trimestre et année → mois)
 * au lieu d'être figée sur la semaine.
 */
export class StatsDetailView {
  constructor(app) {
    this.app = app;
    this.el = el("statsDetail");
    this.anchor = this.el;
    this.tabGroup = el("stDetailTab");
    this.hint = el("stDetailHint");
    this.tab = "tasks";
    this.offOpen = false;   // « Exceptionnels » déplié ?
    this.showAllTasks = false;
    this.expanded = new Set(); // sous-périodes dépliées (survit aux rendus)
  }

  bind() {
    this.tabGroup.addEventListener("click", (e) => {
      const b = e.target.closest("[data-detail]");
      if (!b || b.dataset.detail === this.tab) return;
      this.tab = b.dataset.detail;
      this.app.render();
    });
    this.el.addEventListener("click", (e) => {
      if (e.target.closest(".mini-btn") || e.target.closest("a")) return;
      const toggle = e.target.closest('[data-act="toggle-off-other"]');
      if (toggle) { this.offOpen = !this.offOpen; this.render(); return; }
      const more = e.target.closest('[data-act="more-tasks"]');
      if (more) { this.showAllTasks = !this.showAllTasks; this.render(); return; }
      const settings = e.target.closest('[data-act="off-settings"]');
      if (settings) { this.app.showScreen("settings"); return; }
      const head = e.target.closest(".sp-head[data-sp]");
      if (head) {
        const k = head.dataset.sp;
        this.expanded.has(k) ? this.expanded.delete(k) : this.expanded.add(k);
        this.render();
        return;
      }
      const row = e.target.closest("[data-task]");
      if (row) this.app.openEditTask(row.dataset.task);
    });
  }

  render() {
    const snap = this.app.statsSnapshot();
    for (const c of this.tabGroup.children) {
      c.classList.toggle("active", c.dataset.detail === this.tab);
    }
    this.el.innerHTML = "";
    if (this.tab === "types") this.#renderTypes(snap);
    else if (this.tab === "off") this.#renderOff(snap);
    else if (this.tab === "split") this.#renderSplit(snap);
    else this.#renderTasks(snap);
  }

  #clock(ms) { return this.app.formatter.clock(ms / 60000); }

  /* ----------------- par tâche ----------------- */

  #renderTasks({ byTask, range }) {
    this.hint.textContent = "Déc. / Jira copient la durée · clic = éditer la tâche";
    if (!byTask.length) {
      this.el.appendChild(createEl("div", { className: "empty", text: `Aucune tâche tracée sur ${range.label}.` }));
      return;
    }
    // Le récap de la période entière, prêt à coller dans Jira : c'est le geste
    // du lundi matin, il ne doit pas se reconstituer ligne à ligne.
    const list = createEl("div", { className: "top-tasks" });
    const max = byTask[0].ms;
    const shown = this.showAllTasks ? byTask : byTask.slice(0, TASKS_SHOWN);
    for (const { task, ms, share } of shown) {
      list.appendChild(this.#taskRow(task, ms, share, max));
    }
    if (byTask.length > TASKS_SHOWN) {
      const rest = byTask.slice(TASKS_SHOWN).reduce((a, r) => a + r.ms, 0);
      list.appendChild(createEl("button", {
        className: "tt-rest",
        attrs: { "data-act": "more-tasks", type: "button" },
        text: this.showAllTasks
          ? "Réduire"
          : `+ ${byTask.length - TASKS_SHOWN} autres tâches · ${this.#clock(rest)}`,
      }));
    }
    this.el.append(this.#jiraBar(byTask, `Récap ${range.label}`), list);
  }

  #taskRow(task, ms, share, max) {
    const { formatter } = this.app;
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
    return row;
  }

  /** Récap collable : une ligne « tâche → durée Jira » par tâche. */
  #jiraBar(tasks, label) {
    const lines = tasks
      .map((r) => `${r.task?.displayName ?? "?"}\t${this.app.formatter.jira(r.ms / 60000)}`)
      .join("\n");
    const bar = createEl("div", { className: "detail-bar" });
    bar.append(
      createEl("span", { className: "detail-bar-lab", text: label }),
      createCopyButton(this.app, lines, "Copier pour Jira"),
    );
    return bar;
  }

  /* ----------------- par type ----------------- */

  #renderTypes({ kpi }) {
    this.hint.textContent = "la nature du travail sur la période";
    const max = Math.max(1, ...TASK_TYPES.map((t) => kpi.byType[t]));
    const list = createEl("div", { className: "stats-types" });
    for (const t of TASK_TYPES) {
      const ms = kpi.byType[t] ?? 0;
      const share = kpi.total > 0 ? Math.round((ms / kpi.total) * 100) : 0;
      list.appendChild(createEl("div", {
        className: "stat-type",
        html:
          `<span class="type-badge type-${t}">${t}</span>` +
          `<div class="stat-bar-track"><div class="stat-bar" style="width:${Math.round((ms / max) * 100)}%;background:var(--dot-${t})"></div></div>` +
          `<span class="stat-type-val">${this.#clock(ms)}</span>` +
          `<span class="stat-type-pct">${share} %</span>`,
      }));
    }
    this.el.appendChild(list);
  }

  /* ----------------- hors tâche ----------------- */

  /**
   * Les vides justifiés de la période. Par ligne, la part du HORS TÂCHE (« un
   * tiers de mes vides sont des réunions ») ; en pied, la part des horaires,
   * avec une décimale sous 10 % — sur un trimestre, une heure de réunions vaut
   * 0,3 %, et un « 0 % » arrondi mentirait. Les motifs épinglés d'abord ; les
   * exceptionnels — tapés une fois — repliés sous une ligne unique, pour que le
   * bloc ne grandisse pas avec l'historique. La partition se lit dans les
   * réglages AU RENDU : retirer un épinglé le fait basculer dans les
   * exceptionnels sans rien recalculer.
   */
  #renderOff({ kpi, range }) {
    const { store } = this.app;
    this.hint.textContent = "les vides justifiés · part du hors tâche";
    const box = createEl("div", { className: "stats-off" });
    if (!kpi.offByReason.length) {
      box.appendChild(createEl("div", { className: "empty", text: `Aucun vide justifié sur ${range.label}.` }));
      box.appendChild(this.#offSettingsLink());
      this.el.appendChild(box);
      return;
    }
    const pct = (ms) => (kpi.offMs > 0 ? Math.round((ms / kpi.offMs) * 100) : 0);
    const pinned = kpi.offByReason.filter((r) => store.settings.isPinnedOff(r.label));
    const other = kpi.offByReason.filter((r) => !store.settings.isPinnedOff(r.label));
    const max = Math.max(1, ...kpi.offByReason.map((r) => r.ms));
    const row = ({ label, ms }) => createEl("div", {
      className: "stat-type stat-off",
      html:
        `<span class="stat-off-lab">${escapeHtml(label)}</span>` +
        `<div class="stat-bar-track"><div class="stat-bar off" style="width:${Math.max(2, Math.round((ms / max) * 100))}%"></div></div>` +
        `<span class="stat-type-val">${this.#clock(ms)}</span>` +
        `<span class="stat-type-pct">${pct(ms)} %</span>`,
    });
    for (const r of pinned) box.appendChild(row(r));
    if (other.length) {
      const rest = other.reduce((a, r) => a + r.ms, 0);
      box.appendChild(createEl("button", {
        className: "stat-off-toggle" + (this.offOpen ? " open" : ""),
        attrs: { "data-act": "toggle-off-other", type: "button" },
        html:
          `<span class="stat-off-lab">Exceptionnels (${other.length})</span>` +
          `<span class="o-chev">${icon("chevron-down", { size: 16 })}</span>` +
          `<span class="stat-type-val">${this.#clock(rest)}</span>` +
          `<span class="stat-type-pct">${pct(rest)} %</span>`,
      }));
      if (this.offOpen) {
        const inner = createEl("div", { className: "stat-off-other" });
        for (const r of other) inner.appendChild(row(r));
        box.appendChild(inner);
      }
    }
    let sum = `${this.#clock(kpi.offMs)} hors tâche`;
    if (kpi.scheduledMs > 0) {
      const p = (kpi.offMs / kpi.scheduledMs) * 100;
      sum += ` · ${p < 10 ? p.toFixed(1).replace(".", ",") : Math.round(p)} % des horaires de la période`;
    }
    box.appendChild(createEl("div", { className: "stat-off-sum", text: sum }));
    box.appendChild(this.#offSettingsLink());
    this.el.appendChild(box);
  }

  /** Les motifs épinglés se règlent ailleurs : autant le dire là où on les lit. */
  #offSettingsLink() {
    return createEl("button", {
      className: "link-ghost",
      attrs: { "data-act": "off-settings", type: "button" },
      text: "Régler les motifs épinglés…",
    });
  }

  /* ----------------- découpage ----------------- */

  /**
   * Le découpage de la période, dépliable sur ses tâches, avec le récap Jira à
   * chaque niveau. Les tranches sont **bornées à la période** : leur somme vaut
   * donc exactement le total affiché en tête. C'est aussi pourquoi elles ne
   * portent pas d'écart — une semaine coupée par le début du mois donnerait un
   * « −60 % » qui ne veut rien dire. L'écart, lui, vit en tête de page, où il
   * compare deux périodes entières.
   */
  #renderSplit(snap) {
    const subs = snap.subPeriods();
    const unitLabel = { day: "un jour", week: "une semaine", month: "un mois" }[subs[0]?.unit] ?? "une tranche";
    this.hint.textContent = `${unitLabel} par ligne · clic = détail tâche par tâche`;
    const list = createEl("div", { className: "subs" });
    const max = Math.max(1, ...subs.map((s) => s.ms));
    for (const sp of subs) {
      const open = this.expanded.has(sp.key);
      const types = TASK_TYPES.filter((t) => sp.byType[t] > 0);
      const item = createEl("div", { className: "sp" + (open ? " open" : "") + (sp.ms > 0 ? "" : " is-empty") });
      const head = createEl("div", {
        className: "sp-head",
        attrs: { "data-sp": sp.key, role: "button", tabindex: "0" },
        html:
          `<span class="sp-chev">${icon("chevron-right", { size: 15 })}</span>` +
          `<span class="sp-id"><b>${escapeHtml(sp.label)}</b><em>${escapeHtml(sp.sub)}</em></span>` +
          '<span class="sp-track"><span class="sp-fill" style="width:' + (sp.ms / max) * 100 + '%">' +
            types.map((t) => `<i class="${t}" style="flex:${sp.byType[t]}"></i>`).join("") +
          "</span></span>" +
          `<span class="sp-total">${this.#clock(sp.ms)}</span>` +
          `<span class="sp-meta">${sp.activeDays ? `${sp.activeDays} j · ${this.#clock(sp.avgPerActiveDay)}/j` : "—"}</span>`,
      });
      // Pas de bouton sur une tranche vide : un contrôle désactivé n'a rien à
      // copier, et son texte grisé tombe sous le seuil de contraste.
      if (sp.tasks.length) head.appendChild(this.#jiraButton(sp));
      item.appendChild(head);
      if (open) item.appendChild(this.#subTasks(sp));
      list.appendChild(item);
    }
    this.el.appendChild(list);
  }

  #jiraButton(sp) {
    const lines = sp.tasks
      .map((r) => `${r.task?.displayName ?? "?"}\t${this.app.formatter.jira(r.ms / 60000)}`)
      .join("\n");
    const btn = createCopyButton(this.app, lines, "Jira");
    btn.classList.add("sp-copy");
    return btn;
  }

  #subTasks(sp) {
    const { formatter } = this.app;
    const list = createEl("div", { className: "sp-tasks" });
    if (!sp.tasks.length) {
      list.appendChild(createEl("div", { className: "at-empty", text: "Aucune tâche sur cette tranche." }));
      return list;
    }
    for (const { task, ms } of sp.tasks) {
      const mins = ms / 60000;
      const row = createEl("div", { className: "sp-task" });
      row.appendChild(createEl("span", {
        className: "seg-swatch",
        attrs: { style: `background:${task?.color ?? "var(--text-faint)"}` },
      }));
      row.appendChild(createEl("span", {
        className: "sp-task-name",
        html: escapeHtml(task?.displayName ?? "(tâche supprimée)")
          + (task ? `<span class="type-badge type-${task.type}">${task.type}</span>` : "")
          + (task?.done ? '<span class="badge-done">terminé</span>' : ""),
      }));
      row.appendChild(createEl("span", {
        className: "sp-task-share",
        text: sp.ms > 0 ? Math.round((ms / sp.ms) * 100) + " %" : "",
      }));
      row.appendChild(createEl("span", { className: "sp-task-dur", text: formatter.clock(mins) }));
      const actions = createEl("div", { className: "sp-task-actions" });
      actions.append(
        createCopyButton(this.app, formatter.decimal(mins), "Déc."),
        createCopyButton(this.app, formatter.jira(mins), "Jira"),
      );
      if (task?.link) {
        actions.appendChild(createEl("a", {
          className: "mini-btn icon-only link-btn",
          html: icon("external-link", { size: 14 }),
          attrs: { href: task.link, target: "_blank", rel: "noopener noreferrer", title: "Ouvrir le lien" },
          on: { click: (e) => e.stopPropagation() },
        }));
      }
      row.appendChild(actions);
      list.appendChild(row);
    }
    return list;
  }
}
