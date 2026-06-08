import { dayGlyphName, dayGlyphFrames } from "./icons.js";

/**
 * Anime le glyphe « moment de la journée » (Total journée) **image par image** :
 * fait défiler les frames du glyphe à bas FPS en réécrivant ses points. Vraie
 * animation pixel (pas de CSS) ; calme et sobre.
 *
 * - Recalcule le glyphe quand on change de tranche horaire (matin/jour/soir/nuit).
 * - Se met en veille quand l'onglet est caché ou le widget masqué (CPU minimal).
 * - Respecte `prefers-reduced-motion` : laisse la 1ʳᵉ frame, sans défilé.
 */
export class DayGlyphAnimator {
  constructor({ interval = 1000, selector = ".day-glyph" } = {}) {
    this.interval = interval;
    this.selector = selector;
    this.name = null;
    this.frames = [];
    this.i = 0;
    this.handle = null;
  }

  #sync() {
    const name = dayGlyphName();
    if (name !== this.name) {
      this.name = name;
      this.frames = dayGlyphFrames(name).frames;
      this.i = 0;
    }
  }

  #tick() {
    if (document.hidden) return;
    const node = document.querySelector(this.selector);
    if (!node || node.offsetParent === null) return; // absent ou masqué (autre écran)
    this.#sync();
    if (!this.frames.length) return;
    node.innerHTML = this.frames[this.i];
    this.i = (this.i + 1) % this.frames.length;
  }

  start() {
    this.stop();
    this.#sync();
    // Mouvement neutralisé si l'utilisateur le demande (accessibilité).
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    this.handle = setInterval(() => this.#tick(), this.interval);
  }

  stop() {
    if (this.handle) clearInterval(this.handle);
    this.handle = null;
  }
}
