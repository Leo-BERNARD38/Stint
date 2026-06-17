/**
 * Fond dot-matrix « spotlight » (easter-egg, désactivé par défaut).
 *
 * Une couche fixe plein écran (`#bgDots`) porte une grille de points en CSS,
 * révélée uniquement autour du curseur par un masque radial positionné via deux
 * variables CSS (`--mx`/`--my`). Le seul travail JS est d'écrire ces deux
 * variables **une fois par frame** (`requestAnimationFrame`, coalescé) : le
 * masque est composité par le GPU, aucun dessin JS, coût quasi nul.
 *
 * Coupé d'office si l'utilisateur réduit le mouvement (`prefers-reduced-motion`)
 * ou sur écran sans survol (`hover: none`, tactile) : dans ce cas, aucun
 * écouteur n'est même attaché. Sinon piloté par le réglage `settings.bgDots`.
 */
export class BgDots {
  constructor(elem) {
    this.el = elem || null;
    this.enabled = false;
    this.started = false;
    this.x = 0;
    this.y = 0;
    this.queued = false;
    // Capacité de l'environnement : un pointeur qui survole et pas de mouvement réduit.
    this.allowed = !!elem
      && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      && !window.matchMedia?.("(hover: none)").matches;
  }

  /** Active/désactive selon le réglage (combiné à la capacité). Idempotent. */
  setEnabled(on) {
    const next = !!on && this.allowed;
    if (next === this.enabled) return;
    this.enabled = next;
    if (!this.el) return;
    this.el.classList.toggle("on", next);
    if (!next) this.el.classList.remove("lit");
  }

  /** Câble les écouteurs une seule fois ; inactif tant que `enabled` est faux. */
  start() {
    if (this.started || !this.allowed) return;
    this.started = true;

    const onMove = (e) => {
      if (!this.enabled || e.pointerType === "touch") return;
      this.x = e.clientX;
      this.y = e.clientY;
      this.el.classList.add("lit");
      if (!this.queued) {
        this.queued = true;
        requestAnimationFrame(() => this.#apply());
      }
    };
    const dim = () => this.el.classList.remove("lit");

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", dim);
    window.addEventListener("blur", dim);
    document.addEventListener("visibilitychange", () => { if (document.hidden) dim(); });
  }

  #apply() {
    this.queued = false;
    if (!this.enabled || document.hidden) return;
    this.el.style.setProperty("--mx", this.x + "px");
    this.el.style.setProperty("--my", this.y + "px");
  }
}
