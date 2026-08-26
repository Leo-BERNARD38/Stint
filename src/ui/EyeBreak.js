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
 * Notification : `registration.showNotification` quand un service worker
 * contrôle la page (seule voie sur Android/PWA), sinon `new Notification`.
 * Sans permission accordée, repli sur le toast interne — jamais de silence.
 */
export class EyeBreak {
  /** Titre et corps de la notification (règle 20-20-20). */
  static TITLE = "Repos des yeux";
  static BODY = "Regardez à 6 mètres pendant 20 secondes.";
  static TAG = "stint-eye-break";

  constructor(app) {
    this.app = app;
    this.deadline = 0;   // horodatage (ms) du prochain rappel ; 0 = désarmé
    this.handle = null;
  }

  get supported() {
    return typeof window !== "undefined" && "Notification" in window;
  }

  /** "granted" | "denied" | "default" | "unsupported". */
  get permission() {
    return this.supported ? Notification.permission : "unsupported";
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
    if (!armed) { this.deadline = 0; return; }
    const period = s.eyeBreakMs();
    // Démarrage du chrono, ou période raccourcie dans les réglages : on (re)part
    // d'une période pleine à partir de maintenant.
    if (!this.deadline || this.deadline - Date.now() > period) this.deadline = Date.now() + period;
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
    if (!this.supported || Notification.permission !== "default") return this.permission;
    try {
      return await Notification.requestPermission();
    } catch {
      return this.permission;
    }
  }

  /** Un pas de la boucle : notifie si l'échéance est atteinte, puis réarme. */
  tick() {
    if (!this.deadline) return;
    const now = Date.now();
    if (now < this.deadline) return;
    const period = this.app.store.settings.eyeBreakMs();
    const late = now - this.deadline;
    this.deadline = now + period;        // on réarme toujours depuis maintenant
    if (late > period) return;           // veille / onglet gelé : rappel manqué, pas de rafale
    this.notify();
  }

  /** Notification système si possible, toast sinon. */
  async notify() {
    const body = EyeBreak.BODY;
    if (this.permission === "granted") {
      const options = {
        body,
        tag: EyeBreak.TAG,       // un seul rappel à l'écran : le suivant remplace le précédent
        renotify: true,
        icon: "./assets/icon-192.png",
        badge: "./assets/icon-192.png",
        silent: false,
      };
      try {
        const reg = await navigator.serviceWorker?.getRegistration();
        if (reg?.showNotification) { await reg.showNotification(EyeBreak.TITLE, options); return; }
        new Notification(EyeBreak.TITLE, options);
        return;
      } catch { /* repli ci-dessous */ }
    }
    this.app.toast.show(EyeBreak.TITLE + " — " + body);
  }
}
