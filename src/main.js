/**
 * Point d'entrée de Stint. Charge le contrôleur et démarre l'application
 * une fois le DOM prêt. Tout le reste est en modules ES natifs (aucun build).
 */
import { App } from "./ui/App.js";

window.addEventListener("DOMContentLoaded", () => {
  const app = new App();
  app.start();
  // Exposé pour le débogage en console (facultatif).
  window.stint = app;
});

// Service worker : installable + hors-ligne (ignoré sous file://).
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    // `updateViaCache: "none"` : le cache HTTP n'est consulté NI pour sw.js NI
    // pour ce qu'il importerait. Le défaut ("imports") suffirait aujourd'hui,
    // mais la navigation étant désormais servie depuis le précache, la mise à
    // jour du service worker est la SEULE porte de sortie vers une nouvelle
    // version : elle ne doit dépendre d'aucun cache intermédiaire.
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((reg) => {
      // Un onglet resté ouvert (veille, arrière-plan) toute une nuit ne revérifie
      // pas forcément de lui-même une nouvelle version : il continuerait à tourner
      // avec un ancien schéma de données, et la moindre sauvegarde depuis cet
      // onglet écraserait alors la base avec un état qui ignore les champs ajoutés
      // depuis (perte silencieuse). On force donc la vérification dès que l'onglet
      // redevient visible/actif ; si une nouvelle version est trouvée, le flux
      // `controllerchange` ci-dessous recharge la page avant toute nouvelle saisie.
      const checkForUpdate = () => reg.update().catch(() => { /* sans incidence */ });
      document.addEventListener("visibilitychange", () => { if (!document.hidden) checkForUpdate(); });
      window.addEventListener("focus", checkForUpdate);
      // Stint est une app qu'on laisse ouverte toute la journée, souvent dans sa
      // propre fenêtre : elle peut ne perdre le focus ni ne devenir cachée de
      // toute la journée, et alors aucune des deux vérifications ci-dessus ne
      // tombe jamais. Un battement lent la couvre.
      setInterval(checkForUpdate, 30 * 60_000);
    }).catch(() => { /* sans incidence */ });
  });
  // Une nouvelle version vient de prendre la main (skipWaiting + claim) : on
  // recharge une fois pour servir un ensemble HTML/CSS/JS cohérent — c'était
  // la cause des affichages cassés après déploiement. Pas de rechargement à la
  // toute première installation (la page n'était alors contrôlée par personne).
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) { location.reload(); return; }
    hadController = true; // première prise de contrôle : rien à recharger
  });
}
