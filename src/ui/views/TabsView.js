import { qsa } from "../../utils/dom.js";

/** Navigation par onglets : bascule l'affichage des panneaux (état d'UI pur). */
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
  }

  render() { /* purement déclaratif : rien à re-rendre sur changement de données */ }
}
