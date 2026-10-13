import { el } from "../../utils/dom.js";
import { createMemoList } from "../components/MemoList.js";
import { createTaskField } from "../components/TaskField.js";

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
    // Le champ de tâche commun, avec un choix « sans tâche » (mémo général).
    this.task = createTaskField({ app, root: el("memoTask"), none: "Sans tâche (mémo général)", label: "Tâche du mémo",
      onChange: () => this.text.focus() });
    this.list = createMemoList({ app, root: el("memoList"), showTask: true });
  }

  bind() {
    el("memoClose").addEventListener("click", () => this.app.closeMemos());
    // Entrée ajoute et garde le focus : on enchaîne trois mémos sans la souris.
    this.text.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const res = this.app.store.addMemo({ text: this.text.value, taskId: this.task.value });
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
    else this.task.close();
    setTimeout(() => this.text.focus(), 50);
  }

  close() { this.panel.hidden = true; }

  render() {
    const { store } = this.app;
    // Le déclencheur seulement : la liste dépliée n'est jamais réécrite sous
    // les doigts. Une tâche supprimée entre-temps retombe sur « sans tâche ».
    if (this.task.value && !store.taskById(this.task.value)) this.task.value = null;
    else this.task.refresh();
    this.list.render(store.allMemos(), { empty: "Aucun mémo. Note ici ce que tu veux retrouver demain." });
  }
}
