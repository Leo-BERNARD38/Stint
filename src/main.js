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
}
