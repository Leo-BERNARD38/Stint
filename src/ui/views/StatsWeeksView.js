import { el, createEl, escapeHtml } from "../../utils/dom.js";
import { TASK_TYPES } from "../../core/constants.js";
import { icon } from "../icons.js";
import { createCopyButton } from "../components/CopyButton.js";

const COLLAPSED = 12; // semaines visibles avant dépliage

/**
 * Le récap hebdomadaire : une ligne par semaine, la plus récente en haut.
 * C'est le bloc « rétrospective » proprement dit — on y lit d'un coup l'allure
 * d'une semaine (total, mélange dev/support, jours actifs) et son **écart** avec
 * la précédente.
 *
 * Une semaine se **déplie** sur le détail « tâche → durée » : c'est la vue du
 * débrief du lundi matin, où l'on raconte la semaine écoulée ligne par ligne.
 * Le bouton « Jira » copie ce même détail d'un coup, comme l'en-tête de groupe
 * de l'onglet Tâches.
 */
export class StatsWeeksView {
  constructor(app) {
    this.app = app;
    this.el = el("statsWeeks");
    this.anchor = this.el;
    this.expanded = new Set(); // clés de semaine dépliées (survit aux rendus)
    this.showAll = false;
  }

  bind() {
    this.el.addEventListener("click", (e) => {
      if (e.target.closest("[data-more]")) { this.showAll = !this.showAll; this.render(); return; }
      // Les boutons de copie agissent sans déclencher le plier/déplier.
      if (e.target.closest(".mini-btn, a")) return;
      const head = e.target.closest("[data-week]");
      if (head) this.#toggle(head.dataset.week);
    });
    this.el.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      if (e.target.closest(".mini-btn, a")) return;
      const head = e.target.closest("[data-week]");
      if (head) { e.preventDefault(); this.#toggle(head.dataset.week); }
    });
  }

  /**
   * Plie/déplie en agissant sur le DOM vivant (pas de re-rendu complet) pour
   * que la transition de hauteur puisse jouer — même patron que l'onglet Tâches.
   */
  #toggle(key) {
    const open = !this.expanded.has(key);
    open ? this.expanded.add(key) : this.expanded.delete(key);
    const head = this.el.querySelector(`[data-week="${CSS.escape(key)}"]`);
    const item = head?.closest(".wk-item");
    if (!item) { this.render(); return; }
    item.classList.toggle("open", open);
    head.setAttribute("aria-expanded", String(open));
  }

  render() {
    const { weeks } = this.app.stats.snapshot(this.app.statsPeriod);
    const withTime = weeks.filter((w) => w.total > 0);

    this.el.innerHTML = "";
    if (!withTime.length) {
      this.el.appendChild(createEl("div", { className: "empty", text: "Aucune semaine tracée sur cette période." }));
      return;
    }

    // On n'affiche que les semaines tracées : une suite de zéros n'apprend rien
    // ici (le bloc « Rythme » montre déjà les creux).
    const shown = this.showAll ? withTime : withTime.slice(0, COLLAPSED);
    const peak = Math.max(...withTime.map((w) => w.total));
    for (const w of shown) this.el.appendChild(this.#item(w, peak));

    if (withTime.length > COLLAPSED) {
      this.el.appendChild(createEl("button", {
        className: "mini-btn wk-more",
        attrs: { "data-more": "1" },
        text: this.showAll
          ? "Réduire"
          : `Afficher les ${withTime.length - COLLAPSED} semaines précédentes`,
      }));
    }
  }

  #item(w, peak) {
    const open = this.expanded.has(w.key);
    const item = createEl("div", { className: "wk-item" + (open ? " open" : "") });
    item.appendChild(this.#head(w, peak, open));
    // Le détail reste dans le DOM (replié en hauteur 0 par CSS) : c'est ce qui
    // permet d'animer l'ouverture sans reconstruire la ligne.
    const wrap = createEl("div", { className: "wk-body" });
    wrap.appendChild(this.#tasks(w));
    item.appendChild(wrap);
    return item;
  }

  #head(w, peak, open) {
    const { formatter } = this.app;
    const clock = (ms) => formatter.clock(ms / 60000);
    const head = createEl("div", {
      className: "wk",
      attrs: {
        "data-week": w.key, role: "button", tabindex: "0", "aria-expanded": String(open),
        title: `Voir le détail « tâche → durée » de la semaine ${w.label}`,
      },
    });

    head.appendChild(createEl("span", { className: "wk-chev", html: icon("chevron-right", { size: 15 }) }));
    head.appendChild(createEl("div", {
      className: "wk-id",
      html: `<span class="wk-num">${w.label}</span><span class="wk-sub">${escapeHtml(w.sub)}</span>`,
    }));

    // Barre empilée : la longueur totale dit le volume relatif à la meilleure
    // semaine, les bandes disent le mélange.
    const track = createEl("div", { className: "wk-track" });
    const fill = createEl("div", {
      className: "wk-fill",
      attrs: { style: `width:${Math.max(2, (w.total / peak) * 100)}%` },
    });
    for (const t of TASK_TYPES) {
      if (!w.byType[t]) continue;
      fill.appendChild(createEl("span", {
        attrs: { style: `flex:${w.byType[t]};background:var(--dot-${t})`, title: `${t} · ${clock(w.byType[t])}` },
      }));
    }
    track.appendChild(fill);
    head.appendChild(track);

    head.appendChild(createEl("div", { className: "wk-total", text: clock(w.total) }));
    head.appendChild(createEl("div", {
      className: "wk-meta",
      text: `${w.activeDays} j · ${clock(w.avgPerActiveDay)}/j`,
    }));
    head.appendChild(createEl("div", { className: "wk-delta", text: this.#delta(w) }));

    head.appendChild(createEl("button", {
      className: "mini-btn wk-copy",
      html: icon("copy", { size: 13 }) + " Jira",
      attrs: { title: `Copier le récap Jira de la semaine ${w.label} (tâche → durée)` },
      on: { click: (e) => this.app.copy(this.#lines(w), e.currentTarget) },
    }));
    return head;
  }

  /** Détail « tâche → durée » de la semaine, prêt à énoncer en réunion. */
  #tasks(w) {
    const { formatter } = this.app;
    const list = createEl("div", { className: "wk-tasks" });
    if (!w.tasks.length) {
      list.appendChild(createEl("div", { className: "at-empty", text: "Aucune tâche cette semaine." }));
      return list;
    }
    for (const { task, ms } of w.tasks) {
      const mins = ms / 60000;
      const row = createEl("div", { className: "wk-task" });
      row.appendChild(createEl("span", {
        className: "seg-swatch",
        attrs: { style: `background:${task?.color ?? "var(--text-faint)"}` },
      }));
      row.appendChild(createEl("span", {
        className: "wk-task-name",
        html: `${escapeHtml(task?.displayName ?? "(tâche supprimée)")}`
          + (task ? `<span class="type-badge type-${task.type}">${task.type}</span>` : "")
          + (task?.done ? '<span class="badge-done">terminé</span>' : ""),
      }));
      row.appendChild(createEl("span", {
        className: "wk-task-share",
        text: w.total > 0 ? Math.round((ms / w.total) * 100) + " %" : "",
      }));
      row.appendChild(createEl("span", { className: "wk-task-dur", text: formatter.clock(mins) }));
      const actions = createEl("div", { className: "wk-task-actions" });
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

  /** Récap collable : une ligne « tâche → durée Jira » par tâche. */
  #lines(w) {
    return w.tasks
      .map((r) => `${r.task?.displayName ?? "?"}\t${this.app.formatter.jira(r.ms / 60000)}`)
      .join("\n");
  }

  /** Écart avec la semaine précédente — neutre, sans code couleur moralisateur. */
  #delta(w) {
    if (w.deltaMs == null) return "";
    if (Math.abs(w.deltaMs) < 60000) return "=";
    const arrow = w.deltaMs > 0 ? "▲" : "▼";
    return `${arrow} ${this.app.formatter.clock(Math.abs(w.deltaMs) / 60000)}`;
  }
}
