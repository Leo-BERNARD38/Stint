/**
 * Notifications système — le canal qui sort de l'onglet.
 *
 * La logique vivait dans `EyeBreak`. Les pauses planifiées en ont besoin à
 * l'identique : plutôt que de la copier, on l'extrait ici. Un seul endroit
 * connaît donc la permission, les deux voies d'émission et le repli.
 *
 * Deux voies, dans cet ordre :
 *   1. `registration.showNotification` quand un service worker contrôle la page
 *      — seule voie sur Android et en PWA installée ;
 *   2. `new Notification` sinon.
 * Sans permission accordée (ou si les deux échouent), repli sur le toast
 * interne : **jamais de silence**. Une notification se rate (fenêtre au premier
 * plan, « ne pas déranger », permission refusée) ; c'est justement pourquoi
 * elle n'est jamais le seul canal d'un évènement.
 *
 * Le clic sur une notification est traité par `sw.js` (`notificationclick`) :
 * il ramène l'onglet Stint au premier plan, quel que soit le `tag`.
 */
export class Notifier {
  constructor(toast) {
    this.toast = toast;
  }

  get supported() {
    return typeof window !== "undefined" && "Notification" in window;
  }

  /** "granted" | "denied" | "default" | "unsupported". */
  get permission() {
    return this.supported ? Notification.permission : "unsupported";
  }

  /**
   * Demande la permission si elle n'a jamais été tranchée. Renvoie l'état final.
   * (Le navigateur exige un geste utilisateur : à appeler depuis un clic.)
   */
  async ensurePermission() {
    if (!this.supported || Notification.permission !== "default") return this.permission;
    try {
      return await Notification.requestPermission();
    } catch {
      return this.permission;
    }
  }

  /**
   * Émet la notification, ou le toast à défaut. Le `tag` regroupe : deux envois
   * de même tag ne s'empilent pas, le second remplace le premier.
   */
  async send(title, body, tag) {
    if (this.permission === "granted") {
      const options = {
        body,
        tag,
        renotify: true,
        icon: "./assets/icon-192.png",
        badge: "./assets/icon-192.png",
        silent: false,
      };
      try {
        const reg = await navigator.serviceWorker?.getRegistration();
        if (reg?.showNotification) { await reg.showNotification(title, options); return; }
        new Notification(title, options);
        return;
      } catch { /* repli ci-dessous */ }
    }
    this.toast?.show(body ? title + " — " + body : title);
  }
}
