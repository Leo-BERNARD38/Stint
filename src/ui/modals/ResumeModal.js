import { Modal } from "./Modal.js";
import { el } from "../../utils/dom.js";
import { taskPickerHtml, bindTaskPicker, pickerTasks } from "../components/TaskPicker.js";

/**
 * « Reprise » : choisir une tâche et la relancer.
 *
 * Le sélecteur commun (`TaskPicker`) : recherche focalisée à l'ouverture,
 * ↑ ↓ puis Entrée, ou un clic. La durée du jour en dernière piste (celle de la
 * tâche qui tourne en minium). Les terminées sont repliées, comme partout :
 * reprendre une tâche terminée la rouvre (`Store.resume`). Le focus est posé
 * après un court délai (patron `NewTaskModal`) pour que le `R` du raccourci
 * qui ouvre la modale ne tombe pas dans le champ.
 */
export class ResumeModal extends Modal {
  constructor(app) {
    super("resumeModal");
    this.app = app;
    this.list = el("resumeList");
  }

  bind() {
    this.bindDismiss();
    bindTaskPicker(this.list, {
      onSelect: (id, { click }) => { if (click) this.#pick(id); },
      onSubmit: (id) => this.#pick(id),
    });
  }

  open() {
    const { store, calc, formatter } = this.app;
    const { byTask } = calc.totalsForDay(this.app.viewDay);
    const ms = (t) => byTask.get(t.id) ?? 0;
    const { open, done } = pickerTasks(store, { extra: (t) => (ms(t) ? formatter.clock(ms(t) / 60000) : "") });
    this.list.innerHTML = taskPickerHtml({
      groups: [{ label: "En cours", tasks: open }],
      more: done,
      // Le curseur part de la première ligne : Entrée reprend la dernière tâche.
      selected: open[0]?.id ?? null,
    });
    super.open();
    setTimeout(() => this.list.querySelector(".tp-search")?.focus(), 50);
  }

  #pick(id) {
    if (!id) return;
    this.app.store.resume(id);
    this.close();
  }
}
