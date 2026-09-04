/**
 * Rappel « repos des yeux » (règle 20-20-20).
 *
 * Toutes les N minutes **tant qu'un chrono tourne**, une notification système
 * invite à regarder au loin. Le compte à rebours part du lancement du chrono et
 * boucle ; une pause (ou un arrêt) le désarme, la reprise repart de zéro. Passer
 * d'une tâche à l'autre ne le remet **pas** à zéro : c'est du temps d'écran
 * continu.
 *
 * Deux précautions :
 *   - l'échéance est comparée à l'**horloge murale** (pas un compte de ticks) :
 *     un onglet en arrière-plan voit ses timers bridés (≈ 1/min), le rappel
 *     tombe quand même à l'heure, à la minute près ;
 *   - si l'échéance est dépassée de plus d'une période (machine en veille,
 *     onglet gelé), on ne notifie pas : personne n'était devant l'écran. On
 *     réarme simplement à partir de maintenant.
 *
 * Notification : déléguée à `services/Notifier.js` (service worker si la page
 * en a un, `new Notification` sinon, toast en dernier recours — jamais de
 * silence).
 *
 * Le repos a DEUX bords, et les deux se signalent. La fin en particulier :
 * pendant les vingt secondes on regarde à six mètres, donc ni le bandeau ni la
 * notification de début ne disent quand c'est terminé — il fallait compter dans
 * sa tête. D'où `#checkRestEnd()`, et d'où le bip (`ui/Chime.js`), qui est le
 * seul canal utilisable les yeux ailleurs.
 *
 * Le module tient aussi l'ÉTAT que l'interface affiche (bandeau du héros, cf.
 * `HeroView`) : temps restant avant le prochain repos, durée d'écran continu, et
 * le repos lui-même, décompté dans la page. Les deux durées (période et repos)
 * portent le nom de la règle — 20 min, 20 s — mais sont RÉGLABLES : une règle
 * qu'on ne peut pas adapter à sa fatigue est une règle qu'on finit par couper. Une notification
 * système se rate (fenêtre au premier plan, « ne pas déranger », permission
 * refusée) ; le bandeau, lui, est toujours là. Ce sont deux canaux du même
 * évènement, pas deux fonctionnalités.
 */
export class EyeBreak {
  /** Titre et corps de la notification (règle 20-20-20). */
  static TITLE = "Repos des yeux";
  static TITLE_END = "Repos terminé";
  /** Un seul tag : la notification de fin REMPLACE celle de début, elle ne s'empile pas. */
  static TAG = "stint-eye-break";
  /** Deux segments séparés de moins de cela sont le MÊME temps d'écran : les
   *  horodatages sont à la seconde, et un changement de tâche ferme l'un et
   *  ouvre l'autre au même instant. */
  static TOUCH_MS = 2_000;

  constructor(app) {
    this.app = app;
    this.deadline = 0;    // horodatage (ms) du prochain rappel ; 0 = désarmé
    this.restUntil = 0;   // horodatage (ms) de fin du repos en cours ; 0 = pas de repos
    this.screenSince = 0; // début de l'écran CONTINU (survit au changement de tâche)
    this.handle = null;
  }

  /* ------------------------------------------------------------------
     Lecture — ce dont l'interface a besoin. Toujours dérivé de l'horloge
     murale, jamais d'un compteur : une machine en veille ne fausse rien.
     ------------------------------------------------------------------ */

  /** Le rappel est-il armé (réglage actif ET chrono qui tourne) ? */
  get armed() { return this.deadline > 0; }

  /** Durée du repos, en ms — réglable (20 s par défaut, la règle). */
  restMs() { return this.app.store.settings.eyeRestMs(); }

  /** Sommes-nous dans le repos ? */
  get resting() { return this.restUntil > Date.now(); }

  /** Millisecondes avant le prochain repos (0 pendant le repos). */
  remainingMs() {
    if (!this.deadline) return 0;
    return Math.max(0, this.deadline - Date.now());
  }

  /** Millisecondes restantes du repos en cours (0 hors repos). */
  restRemainingMs() {
    return Math.max(0, this.restUntil - Date.now());
  }

  /** Écran continu depuis le lancement du chrono, en ms (0 si désarmé). */
  screenMs() {
    return this.screenSince ? Math.max(0, Date.now() - this.screenSince) : 0;
  }

  /**
   * Part de temps RESTANTE, entre 0 et 1 — pendant le repos comme avant lui.
   * La barre du bandeau se vide toujours : elle dit la même chose que le nombre
   * posé à côté d'elle, et deux sens de lecture pour une seule information,
   * c'est déjà une de trop.
   */
  fraction() {
    // Bornée : la durée du repos peut être raccourcie dans les réglages PENDANT
    // un repos, et le rapport dépasserait alors 1.
    const total = this.resting ? this.restMs() : this.app.store.settings.eyeBreakMs();
    const left = this.resting ? this.restRemainingMs() : this.remainingMs();
    return total > 0 ? Math.min(1, Math.max(0, left / total)) : 0;
  }

  /**
   * Le bouton du bandeau : on PREND le repos maintenant, ou on l'achève s'il
   * court déjà.
   *
   * Il repoussait le prochain rappel, et c'était une erreur de lecture : cliquer
   * sur « repos des yeux » veut dire « je le prends », pas « plus tard ». On ne
   * perd rien au change — démarrer le repos recale la cadence après lui, donc le
   * geste repousse quand même le rappel suivant d'une période pleine, mais en
   * ayant fait la pause.
   */
  toggleRest() {
    if (this.resting) { this.restUntil = 0; return; }
    this.startRest();
  }

  /**
   * Démarre le repos tout de suite et recale la cadence sur sa FIN : les
   * secondes passées à regarder au loin ne sont pas du temps d'écran. Sans
   * notification par défaut — quand c'est un clic, on est déjà devant l'écran.
   */
  startRest({ notify = false } = {}) {
    if (!this.deadline) return;   // désarmé : aucun chrono, rien à interrompre
    const now = Date.now();
    const rest = this.restMs();
    this.restUntil = now + rest;
    this.deadline = now + rest + this.app.store.settings.eyeBreakMs();
    if (notify) this.notify();
    // Le bip sonne aussi au clic : il confirme le geste, et surtout il apprend
    // à l'oreille le timbre « ça commence » avant qu'on en ait besoin.
    this.app.chime?.play("start");
    // Le bandeau bascule tout de suite : sa propre horloge est celle du héros
    // (1 s), et attendre son prochain battement ferait démarrer le décompte à 19.
    this.app.hero?.tick?.();
  }

  get supported() {
    return this.app.notifier.supported;
  }

  /** "granted" | "denied" | "default" | "unsupported". */
  get permission() {
    return this.app.notifier.permission;
  }

  /** Démarre la boucle de surveillance (une seule fois, au démarrage de l'app). */
  start() {
    if (this.handle) return;
    this.sync();
    // 1 s : le pas est fin quand l'onglet est visible, bridé à ≈ 1 min en
    // arrière-plan — sans conséquence, l'échéance est calculée en horloge murale.
    this.handle = setInterval(() => this.tick(), 1000);
  }

  /**
   * Aligne l'armement sur l'état courant (réglage + chrono). Appelé à chaque
   * rendu, comme `BgDots.setEnabled` : aucune décision d'UI n'est dupliquée ici.
   */
  sync() {
    const s = this.app.store.settings;
    const armed = s.eyeBreak.enabled && !!this.app.store.activeSegment();
    if (!armed) { this.deadline = 0; this.restUntil = 0; this.screenSince = 0; return; }
    const period = s.eyeBreakMs();
    if (!this.screenSince) {
      // Premier armement de cette course. L'écran continu ne repart PAS d'une
      // tâche à l'autre — c'est du temps passé devant l'écran, pas du temps passé
      // sur un sujet — et il se DÉDUIT des segments, jamais de l'instant où la
      // page a été chargée : sinon un simple rechargement à 14 h afficherait
      // « 0:00 d'écran continu » après deux heures de travail.
      this.screenSince = this.#runStartMs();
      // La cadence suit l'écran continu : on vise le prochain multiple de la
      // période depuis ce départ. Un rechargement ne décale donc plus le repos,
      // et activer le rappel en cours de route le place au bon endroit du rythme.
      const elapsed = Math.max(0, Date.now() - this.screenSince);
      this.deadline = this.screenSince + (Math.floor(elapsed / period) + 1) * period;
    } else if (this.deadline - Date.now() > period + this.restMs()) {
      // Période raccourcie dans les réglages : l'échéance en cours dépasse la
      // nouvelle période, on repart d'une période pleine.
      this.deadline = Date.now() + period;
    }
  }

  /**
   * Début de la course d'écran EN COURS : on remonte, depuis le segment actif,
   * la chaîne des segments qui se touchent. Un changement de tâche ne coupe
   * rien ; une pause, si — elle laisse un trou, et le trou arrête la remontée.
   */
  #runStartMs() {
    const store = this.app.store;
    const active = store.activeSegment();
    if (!active) return Date.now();
    // Un vide justifié (pause café, réunion) n'est pas du temps d'écran : il
    // fait un trou dans la course comme une pause le ferait.
    const done = store.segments
      .filter((seg) => !seg.isRunning && !seg.isOff)
      .sort((a, b) => a.startMs() - b.startMs());
    let start = active.startMs();
    for (let i = done.length - 1; i >= 0; i--) {
      const seg = done[i];
      if (seg.endMs() < start - EyeBreak.TOUCH_MS) break; // trou : la course s'arrête ici
      if (seg.startMs() < start) start = seg.startMs();
    }
    return start;
  }

  /** Envoie un rappel tout de suite (bouton « Tester » des réglages). */
  test() {
    this.notify();
  }

  /**
   * Demande la permission si elle n'a jamais été tranchée. Renvoie l'état final.
   * (Le navigateur exige un geste utilisateur : appelé depuis l'interrupteur.)
   */
  async ensurePermission() {
    return this.app.notifier.ensurePermission();
  }

  /** Un pas de la boucle : achève le repos échu, puis déclenche le suivant. */
  tick() {
    this.#checkRestEnd();   // AVANT le retour anticipé : la fin du repos se dit toujours
    if (!this.deadline) return;
    const now = Date.now();
    if (now < this.deadline) return;
    const period = this.app.store.settings.eyeBreakMs();
    // Veille / onglet gelé : personne n'était devant l'écran, on réarme sans
    // repos ni notification plutôt que de tirer une rafale de rappels manqués.
    if (now - this.deadline > period) {
      this.deadline = now + this.restMs() + period;
      return;
    }
    this.startRest({ notify: true });
  }

  /**
   * La fin du repos, transformée en ÉVÈNEMENT. Elle n'en était pas un : `resting`
   * est un simple `restUntil > now` qui devenait faux tout seul, donc personne
   * n'était prévenu — or c'est précisément l'instant où l'on ne regarde pas
   * l'écran. Un rappel qui ne dit pas quand il s'arrête oblige à compter dans sa
   * tête, ce qui est l'inverse d'un rappel.
   *
   * Les deux cas où l'on NE sonne PAS tombent tout seuls, sans code en plus :
   * `toggleRest()` (fin au clic) et `sync()` (chrono arrêté) remettent
   * `restUntil` à 0 avant qu'on passe ici. Dans les deux cas on est devant
   * l'écran, ou il n'y a plus de repos à terminer.
   */
  #checkRestEnd() {
    if (!this.restUntil) return;
    const now = Date.now();
    if (now < this.restUntil) return;
    const late = now - this.restUntil;
    this.restUntil = 0;
    // Veille / onglet gelé : le repos s'est « terminé » il y a un quart d'heure,
    // personne ne l'a vécu. On solde sans sonner dans le vide.
    if (late > 60_000) return;
    this.notifyEnd();
    this.app.chime?.play("end");
    // Le bandeau rebascule tout de suite : attendre le prochain battement du
    // héros laisserait « 0 » affiché une seconde de plus.
    this.app.hero?.tick?.();
  }

  /** Le corps de la notification, qui dit la durée réellement réglée. */
  body() {
    return `Regardez à 6 mètres pendant ${Math.round(this.restMs() / 1000)} secondes.`;
  }

  /** « C'est l'heure » — notification système si possible, toast sinon. */
  notify() {
    return this.app.notifier.send(EyeBreak.TITLE, this.body(), EyeBreak.TAG);
  }

  /** « C'est fini » — même tag : elle remplace celle de début à l'écran. */
  notifyEnd() {
    return this.app.notifier.send(EyeBreak.TITLE_END, "Vous pouvez reprendre.", EyeBreak.TAG);
  }
}
