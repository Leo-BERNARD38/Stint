import { Modal } from "./Modal.js";
import { el, createEl, escapeHtml } from "../../utils/dom.js";

/**
 * « Reprise » : liste des tâches en cours, reprend la sélection.
 *
 * Dès une quinzaine de tâches, une liste qu'on parcourt à la souris coûte plus
 * que le changement de tâche lui-même : un champ de filtre reçoit le focus à
 * l'ouverture, ↑ ↓ déplacent un curseur parmi les lignes visibles, Entrée
 * reprend. Le focus est posé après un court délai (patron `NewTaskModal`) pour
 * que le `R` du raccourci qui ouvre la modale ne tombe pas dans le champ.
 */
export class ResumeModal extends Modal {
  constructor(app) {
    super("resumeModal");
    this.app = app;
    this.list = el("resumeList");
    this.search = el("resumeSearch");
    this.items = [];   // [{ id, name (minuscules), btn }]
    this.cursor = -1;  // index dans `items` de la ligne sous curseur
  }

  bind() {
    this.bindDismiss();
    this.search.addEventListener("input", () => this.#filter());
    this.search.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); this.#move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); this.#move(-1); }
      else if (e.key === "Enter") {
        e.preventDefault();
        const it = this.items[this.cursor];
        if (it && !it.btn.hidden) this.#pick(it.id);
      }
    });
  }

  open() {
    const { store, calc } = this.app;
    this.list.innerHTML = "";
    this.items = [];

    // Uniquement les tâches réellement en cours (ni terminées ni archivées).
    const { byTask } = calc.totalsForDay(this.app.viewDay);
    const visible = store.openTasks().map((t) => t.id);
    visible.sort((a, b) => (byTask.get(b) ?? 0) - (byTask.get(a) ?? 0));

    if (visible.length === 0) {
      this.list.innerHTML = '<div class="empty">Aucune tâche en cours. Créez-en une ou rouvrez-en une terminée.</div>';
    }

    const activeSeg = store.activeSegment();
    for (const id of visible) {
      const t = store.taskById(id);
      const minutes = (byTask.get(id) ?? 0) / 60000;
      const btn = createEl("button", {
        className: "resume-item",
        html:
          `<span class="swatch" style="background:${t.color}"></span>` +
          `<span class="nm">${escapeHtml(t.displayName)}</span>` +
          `<span class="du">${this.app.formatter.clock(minutes)}</span>`,
        on: { click: () => this.#pick(id) },
      });
      // La tâche déjà en cours : même règle que partout — c'est son NOMBRE qui
      // passe en minium, pas une bordure autour du bouton.
      if (activeSeg?.taskId === id) btn.classList.add("is-running");
      this.list.appendChild(btn);
      this.items.push({ id, name: t.displayName.toLowerCase(), btn });
    }
    this.search.value = "";
    this.#filter();
    super.open();
    setTimeout(() => this.search.focus(), 50);
  }

  #pick(id) {
    this.app.store.resume(id);
    this.close();
  }

  /** Filtre par inclusion sur le nom, puis remet le curseur sur la première ligne visible. */
  #filter() {
    const q = this.search.value.trim().toLowerCase();
    let any = false;
    for (const it of this.items) {
      it.btn.hidden = q !== "" && !it.name.includes(q);
      any = any || !it.btn.hidden;
    }
    let empty = this.list.querySelector(".resume-empty");
    if (!any && this.items.length) {
      if (!empty) this.list.appendChild(createEl("div", { className: "empty resume-empty", text: "Aucune tâche ne correspond." }));
    } else empty?.remove();
    this.cursor = -1;
    this.#move(1);
  }

  /** Déplace le curseur de `dir` parmi les lignes visibles (borné, pas de boucle). */
  #move(dir) {
    const idx = this.items.map((it, i) => (it.btn.hidden ? -1 : i)).filter((i) => i >= 0);
    if (!idx.length) { this.#setCursor(-1); return; }
    const pos = idx.indexOf(this.cursor);
    const next = pos < 0 ? (dir > 0 ? 0 : idx.length - 1) : Math.max(0, Math.min(idx.length - 1, pos + dir));
    this.#setCursor(idx[next]);
  }

  #setCursor(i) {
    this.items.forEach((it, k) => it.btn.classList.toggle("is-cursor", k === i));
    this.cursor = i;
    if (i >= 0) this.items[i].btn.scrollIntoView({ block: "nearest" });
  }
}
