import { createEl } from "../../utils/dom.js";

/**
 * Éditeur de planning d'une journée : « travaillé » (oui/non), créneau du
 * matin, et après-midi optionnel. Produit/consomme une liste de créneaux
 * `[["HH:MM","HH:MM"], …]` (`[]` = non travaillé). Réutilisable pour les
 * exceptions par jour de semaine et par date.
 */
export function createScheduleEditor() {
  const root = createEl("div", { className: "sched" });
  root.innerHTML = `
    <label class="switch-row"><input type="checkbox" class="se-on"><span>Travaillé ce jour</span></label>
    <div class="se-body">
      <div class="se-line">
        <span class="se-lab">Matin</span>
        <input type="time" class="se-m1"><span class="se-dash">–</span><input type="time" class="se-m2">
      </div>
      <label class="switch-row"><input type="checkbox" class="se-aft"><span>Après-midi</span></label>
      <div class="se-line se-aline">
        <span class="se-lab">Après-midi</span>
        <input type="time" class="se-a1"><span class="se-dash">–</span><input type="time" class="se-a2">
      </div>
    </div>`;

  const q = (s) => root.querySelector(s);
  const on = q(".se-on"), body = q(".se-body"), aft = q(".se-aft"), aline = q(".se-aline");
  const m1 = q(".se-m1"), m2 = q(".se-m2"), a1 = q(".se-a1"), a2 = q(".se-a2");

  function sync() {
    body.style.display = on.checked ? "" : "none";
    aline.style.display = aft.checked ? "" : "none";
  }
  on.addEventListener("change", sync);
  aft.addEventListener("change", sync);

  function setValue(blocks) {
    blocks = Array.isArray(blocks) ? blocks : [];
    on.checked = blocks.length > 0;
    const m = blocks[0] || ["08:30", "12:30"];
    m1.value = m[0]; m2.value = m[1];
    const a = blocks[1];
    aft.checked = !!a;
    a1.value = a ? a[0] : "13:30";
    a2.value = a ? a[1] : "17:00";
    sync();
  }

  function getValue() {
    if (!on.checked) return [];
    const blocks = [[m1.value, m2.value]];
    if (aft.checked) blocks.push([a1.value, a2.value]);
    return blocks;
  }

  return { element: root, setValue, getValue };
}

/** Résumé lisible d'un planning, pour les listes. */
export function describeBlocks(blocks) {
  if (!blocks || blocks.length === 0) return "Non travaillé";
  return blocks.map(([a, b]) => `${a}–${b}`).join(" · ");
}
