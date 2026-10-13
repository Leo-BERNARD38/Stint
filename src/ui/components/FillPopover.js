import { createEl, escapeHtml } from "../../utils/dom.js";
import { icon } from "../icons.js";
import { taskPickerHtml, bindTaskPicker } from "./TaskPicker.js";

/**
 * Popover de remplissage d'un trou (temps non tracé). Carte flottante ancrée au
 * trou sur la timeline, proposant : prolonger le segment de gauche, prolonger
 * celui de droite, ou créer un segment (choix de la tâche). Variante feuille
 * basse + fond assombri sur mobile. Fermeture au clic extérieur.
 *
 * Factory montée **une seule fois** dans `.timeline-wrap` (survit aux re-rendus
 * de la timeline). API : `open(opts)`, `close()`, `isOpen()`.
 */
export function createFillPopover({ parent }) {
  const backdrop = createEl("div", { className: "fill-backdrop" });
  // Même contrat que le popover de la Saisie : un dialogue, focalisé à
  // l'ouverture, qui rend le focus à son déclencheur et se ferme à Échap.
  const pop = createEl("div", { className: "fill-pop", attrs: { role: "dialog", "aria-label": "Temps non tracé", tabindex: "-1" } });
  parent.append(backdrop, pop);

  let isOpen = false;
  let cbs = {};
  let onDocDown = null;
  let opener = null;

  function close() {
    if (!isOpen) return;
    isOpen = false;
    pop.classList.remove("show");
    backdrop.classList.remove("show");
    if (onDocDown) { document.removeEventListener("pointerdown", onDocDown, true); onDocDown = null; }
    // Le focus revient d'où il venait, s'il était resté dans la carte.
    if (pop.contains(document.activeElement)) opener?.focus?.({ preventScroll: true });
    opener = null;
  }

  function open(opts) {
    cbs = opts;
    opener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    pop.innerHTML = render(opts);
    isOpen = true;
    pop.classList.add("show");
    backdrop.classList.add("show");
    position(opts);
    pop.focus({ preventScroll: true });
    // Clic hors du popover → fermeture (posé au tick suivant pour ne pas
    // capter le clic d'ouverture lui-même).
    onDocDown = (e) => { if (!pop.contains(e.target)) close(); };
    setTimeout(() => document.addEventListener("pointerdown", onDocDown, true), 0);
  }

  // Place la carte flottante en empêchant tout débordement : le centre est calé
  // sur le trou, puis borné pour garder une marge minimale avec les deux bords
  // du conteneur (un trou en tout début ou toute fin de journée ne sort donc
  // plus de l'écran). Variante feuille basse (mobile) : on laisse la feuille de
  // style gérer le positionnement plein écran (cf. media query).
  function position(opts) {
    if (window.matchMedia("(max-width: 760px)").matches) {
      pop.style.left = "";
      pop.style.top = "";
      return;
    }
    pop.style.top = opts.topPx + "px";
    const MARGIN = 8;
    const parentW = parent.clientWidth;
    const half = pop.offsetWidth / 2; // le CSS centre la carte via translateX(-50%)
    let center = (Math.max(0, Math.min(100, opts.leftPct)) / 100) * parentW;
    center = Math.max(half + MARGIN, Math.min(parentW - half - MARGIN, center));
    pop.style.left = center + "px";
  }

  // Pastille d'un voisin ou d'une tâche : sans couleur (`null`) = un vide
  // justifié, carré vide à anneau — jamais une teinte.
  const dot = (color) => (color ? `<span class="o-dot" style="background:${color}"></span>` : `<span class="o-dot off"></span>`);

  function render(o) {
    const opt = (act, ic, kicker, dotColor, name) =>
      `<button class="fill-opt" data-act="${act}">` +
        `<span class="o-ic">${icon(ic, { size: 18 })}</span>` +
        `<span class="o-text"><span class="o-k">${kicker}</span>` +
        `<span class="o-name">${dot(dotColor)}` +
        `${escapeHtml(name)}</span></span></button>`;
    let html =
      `<div class="fill-head"><span class="fill-dot"></span>` +
      `<span class="fill-kicker">Temps non tracé</span>` +
      `<button class="fill-x" data-act="close" aria-label="Fermer">${icon("x", { size: 14 })}</button></div>` +
      `<div class="fill-range">${escapeHtml(o.range)} <span class="fill-dur">· ${escapeHtml(o.dur)}</span></div>` +
      `<div class="fill-opts">`;
    if (o.left) html += opt("left", "arrow-right", "Prolonger à droite", o.left.color, o.left.name);
    if (o.right) html += opt("right", "arrow-left", "Prolonger à gauche", o.right.color, o.right.name);
    html +=
      `<button class="fill-opt fill-create-btn" data-act="create">` +
        `<span class="o-ic o-ic-new">${icon("plus", { size: 18 })}</span>` +
        `<span class="o-create">Créer un segment</span>` +
        `<span class="o-chev">${icon("chevron-down", { size: 16 })}</span></button>` +
      `<div class="fill-create" hidden><span class="fill-create-lab">Sur quelle tâche ?</span>`;
    // Le sélecteur commun (cf. `TaskPicker`) : recherche, tâches en cours, les
    // terminées repliées. Un clic crée le segment ; Entrée dans la recherche
    // crée celui de la ligne sélectionnée.
    html += taskPickerHtml({
      groups: [{ label: "En cours", tasks: o.tasks.open }],
      more: o.tasks.done,
    });
    html += `</div>`;
    // Hors tâche : le vide est justifié, pas travaillé. Les motifs ÉPINGLÉS en
    // pilules (un clic), et un champ pour l'exceptionnel — qui ne rejoint la
    // liste que si on le demande, sinon elle grossirait sans fin.
    html +=
      `<button class="fill-opt fill-off-btn" data-act="off">` +
        `<span class="o-ic"><span class="o-dot off"></span></span>` +
        `<span class="o-create">Justifier le vide <span class="o-k-inline">hors tâche</span></span>` +
        `<span class="o-chev">${icon("chevron-down", { size: 16 })}</span></button>` +
      `<div class="fill-off" hidden>`;
    if (o.reasons?.length) {
      html += `<div class="fill-reasons">`;
      for (const r of o.reasons) html += `<button class="fill-reason" data-off-label="${escapeHtml(r)}">${escapeHtml(r)}</button>`;
      html += `</div>`;
    }
    html +=
      `<input class="fill-off-input" type="text" maxlength="40" placeholder="Autre motif… (Entrée)" aria-label="Autre motif" autocomplete="off" spellcheck="false">` +
      (o.canPin ? `<label class="fill-off-pin"><input type="checkbox" class="fill-off-pin-box"> Garder dans la liste</label>` : "") +
      `</div></div>`;
    return html;
  }

  /** Crée le vide justifié saisi dans le champ (Entrée), s'il n'est pas vide. */
  function submitOff() {
    const input = pop.querySelector(".fill-off-input");
    const label = (input?.value ?? "").trim();
    if (!label) { input?.focus(); return; }
    const pin = !!pop.querySelector(".fill-off-pin-box")?.checked;
    close();
    cbs.onCreateOff?.(label, pin);
  }
  pop.addEventListener("keydown", (e) => {
    // Échap ferme la carte, et seulement elle (pas l'écran, pas les mémos).
    if (e.key === "Escape") { e.stopPropagation(); close(); return; }
    if (e.key === "Enter" && e.target.classList.contains("fill-off-input")) { e.preventDefault(); submitOff(); }
  });
  bindTaskPicker(pop, {
    onSelect: (id, { click }) => { if (click) { close(); cbs.onCreate?.(id); } },
    onSubmit: (id) => { close(); cbs.onCreate?.(id); },
  });

  // Délégation des clics dans le popover.
  pop.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act], [data-off-label]");
    if (!btn) return;
    if (btn.dataset.offLabel != null) { close(); cbs.onCreateOff?.(btn.dataset.offLabel, false); return; }
    const act = btn.dataset.act;
    if (act === "close") { close(); }
    else if (act === "off") {
      const box = pop.querySelector(".fill-off");
      const open2 = box.hasAttribute("hidden");
      box.toggleAttribute("hidden", !open2);
      pop.querySelector(".fill-off-btn").classList.toggle("open", open2);
    }
    else if (act === "left") { close(); cbs.onExtendLeft?.(); }
    else if (act === "right") { close(); cbs.onExtendRight?.(); }
    else if (act === "create") {
      const box = pop.querySelector(".fill-create");
      const open2 = box.hasAttribute("hidden");
      box.toggleAttribute("hidden", !open2);
      pop.querySelector(".fill-create-btn").classList.toggle("open", open2);
      if (open2) pop.querySelector(".tp-search")?.focus();
    }
  });
  backdrop.addEventListener("click", close);

  return { open, close, isOpen: () => isOpen };
}
