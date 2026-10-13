import { escapeHtml } from "../../utils/dom.js";
import { icon } from "../icons.js";
import { taskPickerHtml, bindTaskPicker, pickerTasks } from "./TaskPicker.js";

/**
 * Champ « Tâche » d'un formulaire (modale de segment, panneau des mémos) : un
 * déclencheur qui dit la tâche choisie et déplie EN PLACE le sélecteur commun
 * (`TaskPicker` : recherche, en cours, terminées repliées). Il remplace des
 * `<select>` natifs — sans recherche, chacun avec sa liste et son ordre — pour
 * qu'une tâche se choisisse partout de la même façon.
 *
 * Factory comme `FillPopover` : `createTaskField({ app, root })` monte le
 * balisage dans `root` (conteneur stable) et câble UNE fois.
 *
 * @param {object} o
 * @param {object} o.app
 * @param {HTMLElement} o.root
 * @param {string} [o.none]  libellé du choix « sans tâche » (valeur `null`) ;
 *        sans lui, une tâche est obligatoire
 * @param {string} [o.label]  nom accessible du champ
 * @param {(id: string|null) => void} [o.onChange]
 */
export function createTaskField({ app, root, none = null, label = "Tâche", onChange }) {
  let value = null;

  root.classList.add("tf");
  root.innerHTML =
    `<button type="button" class="tf-trigger" aria-expanded="false" aria-label="${escapeHtml(label)}">` +
      '<span class="o-dot off"></span><span class="tf-name"></span>' +
      `<span class="o-chev">${icon("chevron-down", { size: 16 })}</span></button>` +
    '<div class="tf-pick" hidden></div>';
  const trigger = root.querySelector(".tf-trigger");
  const pick = root.querySelector(".tf-pick");

  function paint() {
    const t = value ? app.store.taskById(value) : null;
    const dot = trigger.querySelector(".o-dot");
    dot.className = t ? "o-dot" : "o-dot off";
    dot.style.background = t ? t.color : "";
    const name = trigger.querySelector(".tf-name");
    name.textContent = t ? t.displayName : (none ?? "Choisir une tâche…");
    name.classList.toggle("is-empty", !t);
  }

  const isOpen = () => !pick.hidden;

  function open() {
    const { open: cur, done } = pickerTasks(app.store);
    pick.innerHTML = taskPickerHtml({
      groups: [{ label: "En cours", tasks: cur }],
      more: done,
      none,
      selected: value ?? (none != null ? "" : null),
    });
    pick.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    pick.querySelector(".tp-search")?.focus();
  }

  function close(refocus = false) {
    if (!isOpen()) return;
    pick.hidden = true;
    pick.innerHTML = "";
    trigger.setAttribute("aria-expanded", "false");
    if (refocus) trigger.focus();
  }

  function choose(id) {
    value = id || null;
    paint();
    close(true);
    onChange?.(value);
  }

  trigger.addEventListener("click", () => (isOpen() ? close() : open()));
  bindTaskPicker(pick, {
    onSelect: (id, { click }) => { if (click) choose(id); },
    onSubmit: choose,
  });
  // Échap replie le sélecteur sans fermer la modale qui le porte.
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) { e.stopPropagation(); e.preventDefault(); close(true); }
  });

  paint();
  return {
    get value() { return value; },
    /** Pose la valeur sans déclencher `onChange` (ouverture d'un formulaire). */
    set value(id) { value = id && app.store.taskById(id) ? id : null; paint(); close(); },
    /** Repeint le déclencheur (une tâche renommée, recolorée). */
    refresh: paint,
    close,
    get isOpen() { return isOpen(); },
    focus: () => trigger.focus(),
  };
}
