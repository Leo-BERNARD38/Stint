import { createEl, escapeHtml } from "../../utils/dom.js";
import { icon } from "../icons.js";

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
  const pop = createEl("div", { className: "fill-pop" });
  parent.append(backdrop, pop);

  let isOpen = false;
  let cbs = {};
  let onDocDown = null;

  function close() {
    if (!isOpen) return;
    isOpen = false;
    pop.classList.remove("show");
    backdrop.classList.remove("show");
    if (onDocDown) { document.removeEventListener("pointerdown", onDocDown, true); onDocDown = null; }
  }

  function open(opts) {
    cbs = opts;
    pop.innerHTML = render(opts);
    isOpen = true;
    pop.classList.add("show");
    backdrop.classList.add("show");
    position(opts);
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

  function render(o) {
    const opt = (act, ic, kicker, dotColor, name) =>
      `<button class="fill-opt" data-act="${act}">` +
        `<span class="o-ic">${icon(ic, { size: 18 })}</span>` +
        `<span class="o-text"><span class="o-k">${kicker}</span>` +
        `<span class="o-name"><span class="o-dot" style="background:${dotColor}"></span>` +
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
    for (const t of o.tasks) {
      html += `<button class="fill-task" data-task="${t.id}">` +
        `<span class="o-dot" style="background:${t.color}"></span>` +
        `<span class="fill-task-name">${escapeHtml(t.name)}</span></button>`;
    }
    html += `</div></div>`;
    return html;
  }

  // Délégation des clics dans le popover.
  pop.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act], [data-task]");
    if (!btn) return;
    if (btn.dataset.task != null) { close(); cbs.onCreate?.(btn.dataset.task); return; }
    const act = btn.dataset.act;
    if (act === "close") { close(); }
    else if (act === "left") { close(); cbs.onExtendLeft?.(); }
    else if (act === "right") { close(); cbs.onExtendRight?.(); }
    else if (act === "create") {
      const box = pop.querySelector(".fill-create");
      const open2 = box.hasAttribute("hidden");
      box.toggleAttribute("hidden", !open2);
      pop.querySelector(".fill-create-btn").classList.toggle("open", open2);
    }
  });
  backdrop.addEventListener("click", close);

  return { open, close, isOpen: () => isOpen };
}
