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
    navigator.serviceWorker.register("sw.js").catch(() => { /* sans incidence */ });
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
