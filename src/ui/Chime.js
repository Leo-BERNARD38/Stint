/**
 * Bip du repos des yeux — synthèse **WebAudio**, aucun fichier audio.
 *
 * C'est le troisième canal du même évènement, après la notification système et
 * le bandeau, et le seul qui fonctionne quand on ne regarde PAS l'écran — ce
 * qui est exactement ce qu'on demande pendant les vingt secondes. Sans lui, la
 * fin du repos ne se sait qu'en comptant dans sa tête.
 *
 * Pourquoi de la synthèse plutôt qu'un `.mp3` : le projet n'a ni build ni
 * dépendance, et un fichier de plus serait un fichier de plus à précacher, à
 * versionner et à faire tenir dans le budget hors-ligne. Deux oscillateurs
 * sinus font le même travail en trente lignes, et le timbre se règle au chiffre
 * près.
 *
 * Deux timbres, et ils doivent se distinguer **sans le secours des yeux** :
 * l'appel monte (660 → 880 Hz), la fin descend (880 → 660 Hz). Une seule note
 * répétée à l'identique obligerait à se souvenir de laquelle on en est.
 *
 * L'`AudioContext` est créé **paresseusement** : les navigateurs refusent de le
 * démarrer sans geste utilisateur. `App` appelle `unlock()` au premier
 * `pointerdown`. Tant que rien n'a été touché, `play()` ne fait rien — en
 * silence, sans jamais lever : le bandeau reste la vérité visuelle, le son n'a
 * jamais le droit de casser le rendu.
 */

/** Plafond du gain maître : « très léger » n'est pas une intention, c'est un chiffre. */
const PEAK = 0.25;
/** Durée d'une note et écart entre les deux, en secondes. */
const NOTE_S = 0.09;
const GAP_S = 0.11;
/** En dessous, la note est inaudible : autant ne pas réveiller le contexte. */
const SILENT = 0.0005;

export class Chime {
  #ctx = null;

  constructor(app) {
    this.app = app;
  }

  /**
   * Crée (ou reprend) le contexte audio. À appeler depuis un geste utilisateur.
   * Idempotent, et silencieux si le navigateur ne sait pas faire.
   */
  unlock() {
    const ctx = this.#ensure();
    if (ctx?.state === "suspended") ctx.resume().catch(() => {});
    return !!ctx;
  }

  #ensure() {
    if (this.#ctx) return this.#ctx;
    const Ctor = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
    if (!Ctor) return null;
    try { this.#ctx = new Ctor(); } catch { this.#ctx = null; }
    return this.#ctx;
  }

  /** Joue le bip si le réglage l'autorise. `kind` : "start" | "end". */
  play(kind) {
    if (!this.app.store.settings.eyeBreak.sound) return;
    this.preview(kind);
  }

  /**
   * Joue le bip **sans regarder le réglage** — c'est le bouton « Écouter » des
   * réglages : on doit pouvoir l'entendre au moment où l'on choisit son volume.
   */
  preview(kind) {
    const level = this.app.store.settings.eyeVolume() ** 2 * PEAK;
    if (level < SILENT) return;              // volume à zéro : rien à jouer
    const ctx = this.#ensure();
    if (!ctx) return;
    if (ctx.state === "suspended") { ctx.resume().catch(() => {}); }
    if (ctx.state !== "running") return;     // aucun geste utilisateur encore : on se tait
    // L'appel MONTE, la fin DESCEND : c'est ce qui les distingue à l'oreille.
    const [a, b] = kind === "end" ? [880, 660] : [660, 880];
    const t0 = ctx.currentTime + 0.02;
    this.#note(ctx, a, t0, level);
    this.#note(ctx, b, t0 + GAP_S, level);
  }

  /**
   * Une note : sinus, attaque de 10 ms puis extinction exponentielle. Les rampes
   * ne descendent jamais à zéro (`exponentialRamp` l'interdit) et l'attaque
   * n'est pas instantanée — sans elles, chaque note claquerait.
   */
  #note(ctx, freq, at, level) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(level, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + NOTE_S);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + NOTE_S + 0.02);
    } catch { /* le son ne casse jamais le reste */ }
  }
}
