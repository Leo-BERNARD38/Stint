import { qsa, el } from "../../utils/dom.js";

/** Onglets de l'écran application (Journée / Segments). État d'UI pur. */
export class TabsView {
  constructor(app) {
    this.app = app;
    this.tabs = qsa(".tab");
    this.panels = qsa(".tab-panel");
    this.active = "journee";
  }

  bind() {
    this.tabs.forEach((tab) =>
      tab.addEventListener("click", () => this.select(tab.dataset.tab)));
  }

  select(name) {
    this.active = name;
    this.tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    this.panels.forEach((p) => { p.hidden = p.dataset.panel !== name; });
    // « Tâches » et « Stats » sont des vues tout-temps : pas de sélecteur de jour.
    el("dayHead").hidden = name === "taches" || name === "stats";
  }

  render() { /* déclaratif : rien à re-rendre sur changement de données */ }
}
