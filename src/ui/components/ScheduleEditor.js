import { createEl } from "../../utils/dom.js";
import { blocksFromDay, dayFromBlocks } from "../../models/Settings.js";

/**
 * Éditeur de planning d'une journée, dans la seule grammaire de l'application :
 * **arrivée, départ, et une pause déjeuner ou non**. C'est la même que celle des
 * horaires de base — « matin / après-midi » mentait dès qu'on ne travaillait que
 * l'après-midi, puisqu'il fallait saisir 14:00–17:00 dans la ligne « Matin ».
 *
 * Produit/consomme une liste de créneaux `[["HH:MM","HH:MM"], …]` (`[]` = non
 * travaillé), via `blocksFromDay` / `dayFromBlocks` : la traduction vit dans le
 * modèle, pas ici. Réutilisé pour les exceptions par jour de semaine et par date.
 */
export function createScheduleEditor() {
  const root = createEl("div", { className: "sched" });
  root.innerHTML = `
    <label class="switch-row"><input type="checkbox" class="se-on"><span>Jour travaillé</span></label>
    <div class="se-body">
      <div class="se-line">
        <span class="se-lab">Arrivée</span>
        <input type="time" class="se-arr"><span class="se-dash">–</span>
        <span class="se-lab se-lab2">Départ</span>
        <input type="time" class="se-dep">
      </div>
      <label class="switch-row"><input type="checkbox" class="se-lunch"><span>Pause déjeuner</span></label>
      <div class="se-line se-lline">
        <span class="se-lab">Pause</span>
        <input type="time" class="se-l1"><span class="se-dash">–</span><input type="time" class="se-l2">
      </div>
      <p class="se-warn" hidden></p>
    </div>`;

  const q = (s) => root.querySelector(s);
  const on = q(".se-on"), body = q(".se-body"), lunch = q(".se-lunch"), lline = q(".se-lline");
  const arr = q(".se-arr"), dep = q(".se-dep"), l1 = q(".se-l1"), l2 = q(".se-l2");
  const warn = q(".se-warn");

  function sync() {
    body.hidden = !on.checked;
    lline.hidden = !lunch.checked;
  }
  on.addEventListener("change", sync);
  lunch.addEventListener("change", sync);

  /** Remplit l'éditeur depuis un planning. `fallback` = les heures à proposer
   *  quand le planning ne les porte pas (jour non travaillé, journée continue). */
  function setValue(blocks, fallback) {
    const day = dayFromBlocks(blocks, fallback);
    on.checked = day.worked;
    arr.value = day.arrival;
    dep.value = day.departure;
    lunch.checked = day.lunch;
    l1.value = day.lunchStart;
    l2.value = day.lunchEnd;
    // Un planning importé peut avoir trois créneaux ou plus. On le dit, plutôt
    // que de les perdre au premier enregistrement sans prévenir.
    warn.hidden = !day.extra;
    if (day.extra) {
      warn.textContent =
        `Ce jour compte ${(blocks || []).length} créneaux ; l'éditeur n'en montre que deux. ` +
        `L'enregistrer les remplacera.`;
    }
    sync();
  }

  /** La saisie brute — c'est elle que `validateDay` juge, pour nommer la faute. */
  function readValue() {
    return {
      worked: on.checked,
      arrival: arr.value, departure: dep.value,
      lunch: lunch.checked, lunchStart: l1.value, lunchEnd: l2.value,
    };
  }

  function getValue() {
    return blocksFromDay(readValue());
  }

  return { element: root, setValue, getValue, readValue };
}

/** Résumé lisible d'un planning, pour les listes. */
export function describeBlocks(blocks) {
  if (!blocks || blocks.length === 0) return "Non travaillé";
  return blocks.map(([a, b]) => `${a}–${b}`).join(" · ");
}
