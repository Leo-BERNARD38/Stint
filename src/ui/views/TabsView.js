import { qsa, el } from "../../utils/dom.js";

/**
 * Navigation : onglets principaux (Journée / Segments) + accès Réglages depuis
 * le header (engrenage). Bascule l'affichage des panneaux (état d'UI pur).
 */
export class TabsView {
  constructor(app) {
    this.app = app;
    this.tabs = qsa(".tab");
    this.panels = qsa(".tab-panel");
    this.settingsBtn = el("settingsBtn");
    this.active = "journee";
  }

  bind() {
    this.tabs.forEach((tab) =>
      tab.addEventListener("click", () => this.select(tab.dataset.tab)));
    // l'engrenage du header ouvre/referme les réglages
    this.settingsBtn.addEventListener("click", () =>
      this.select(this.active === "reglages" ? "journee" : "reglages"));
  }

  select(name) {
    this.active = name;
    this.tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    this.panels.forEach((p) => { p.hidden = p.dataset.panel !== name; });
    this.settingsBtn.classList.toggle("active", name === "reglages");
  }

  render() { /* déclaratif : rien à re-rendre sur changement de données */ }
}
