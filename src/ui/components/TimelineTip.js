import { createEl, escapeHtml } from "../../utils/dom.js";

/**
 * Infobulle maison des timelines (`.tl-tip`) : suit le curseur au-dessus des
 * blocs `.tl-seg` et affiche nom / plage / durée lus dans leurs `data-*`.
 * (L'attribut `title` natif est lent et peu esthétique.)
 *
 * Câblée une seule fois sur `host` (délégation : les blocs sont reconstruits à
 * chaque rendu). `parent` est le conteneur de positionnement qui reçoit le tip ;
 * `top` (optionnel) fixe l'ordonnée, sinon le tip s'aligne sur le bloc survolé.
 *
 * @returns {{ mount: () => void }} `mount()` ré-insère le tip — à rappeler
 *   après un rendu qui vide `parent` (le tip est détruit avec son contenu).
 */
export function attachTimelineTip(host, { parent = host, top = null } = {}) {
  const tip = createEl("div", { className: "tl-tip" });
  let current = null;

  const hide = () => {
    current = null;
    tip.classList.remove("show");
  };

  const move = (e) => {
    const seg = e.target.closest(".tl-seg");
    if (!seg) { hide(); return; }
    if (seg !== current) {
      current = seg;
      tip.innerHTML =
        `<div class="nm"><span class="dot" style="background:${seg.dataset.color}"></span>` +
        `${escapeHtml(seg.dataset.name)}</div>` +
        `<div class="mt">${escapeHtml(seg.dataset.range)} · ${escapeHtml(seg.dataset.dur)}</div>`;
    }
    tip.classList.add("show");
    const rect = parent.getBoundingClientRect();
    const w = tip.offsetWidth;
    tip.style.left = Math.max(w / 2 + 4, Math.min(rect.width - w / 2 - 4, e.clientX - rect.left)) + "px";
    tip.style.top = (top ? top() : seg.getBoundingClientRect().top - rect.top) + "px";
  };

  host.addEventListener("mousemove", move);
  host.addEventListener("mouseleave", hide);

  const mount = () => { current = null; parent.appendChild(tip); };
  mount();
  return { mount };
}
