import { el, escapeHtml } from "../../utils/dom.js";
import { createMemoList } from "../components/MemoList.js";

/**
 * Panneau latéral des mémos : « pour demain », général ou rattaché à une
 * tâche. Ouvert depuis l'en-tête (ou `M`), accessible depuis tous les écrans,
 * **non modal** — le reste de l'app reste cliquable. `anchor` = le panneau :
 * `App.render()` le saute tant qu'il est fermé.
 */
export class MemoPanelView {
  constructor(app) {
    this.app = app;
    this.panel = el("memoPanel");
    this.anchor = this.panel;
    this.text = el("memoText");
    this.task = el("memoTask");
    this.list = createMemoList({ app, root: el("memoList"), showTask: true });
  }

  bind() {
    el("memoClose").addEventListener("click", () => this.app.closeMemos());
    // Entrée ajoute et garde le focus : on enchaîne trois mémos sans la souris.
    this.text.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const res = this.app.store.addMemo({ text: this.text.value, taskId: this.task.value || null });
      if (res === "invalid") return;
      this.text.value = "";
      this.text.focus();
    });
  }

  get isOpen() { return !this.panel.hidden; }

  open(taskId = null) {
    // Sous l'en-tête, quelle que soit sa hauteur du moment (mobile, wordmark long).
    this.panel.style.top = (document.querySelector("header")?.offsetHeight ?? 64) + "px";
    this.panel.hidden = false;
    this.render();
    if (taskId && this.app.store.taskById(taskId)) this.task.value = taskId;
    setTimeout(() => this.text.focus(), 50);
  }

  close() { this.panel.hidden = true; }

  render() {
    const { store } = this.app;
    // Le select des tâches ouvertes, jamais réécrit sous le focus.
    if (document.activeElement !== this.task) {
      const cur = this.task.value;
      const tasks = store.openTasks().slice().sort((a, b) => a.displayName.localeCompare(b.displayName, "fr"));
      this.task.innerHTML = `<option value="">— sans tâche —</option>` +
        tasks.map((t) => `<option value="${t.id}">${escapeHtml(t.displayName)}</option>`).join("");
      if (tasks.some((t) => t.id === cur)) this.task.value = cur;
    }
    this.list.render(store.allMemos(), { empty: "Aucun mémo. Note ici ce que tu veux retrouver demain." });
  }
}
