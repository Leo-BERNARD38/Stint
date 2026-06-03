import { el, qsa } from "../../utils/dom.js";
import { THEMES } from "../../core/constants.js";

const ICONS = { system: "🖥", light: "☀", dark: "🌙" };
const LABELS = { system: "Système", light: "Clair", dark: "Sombre" };

/**
 * Gère le thème (clair / sombre / système). Applique l'attribut data-theme,
 * synchronise le bouton du header et le contrôle segmenté des réglages.
 */
export class ThemeView {
  constructor(app) {
    this.app = app;
    this.toggle = el("themeToggle");
    this.segButtons = qsa("#themeSeg button");
  }

  bind() {
    // bouton header : cycle système → clair → sombre → …
    this.toggle.addEventListener("click", () => {
      const i = THEMES.indexOf(this.app.store.settings.theme);
      this.app.setTheme(THEMES[(i + 1) % THEMES.length]);
    });
    // contrôle segmenté des réglages
    this.segButtons.forEach((b) =>
      b.addEventListener("click", () => this.app.setTheme(b.dataset.themeVal)));
  }

  render() {
    const theme = this.app.store.settings.theme;
    document.documentElement.dataset.theme = theme;
    this.toggle.textContent = ICONS[theme] ?? "🖥";
    this.toggle.title = "Thème : " + (LABELS[theme] ?? theme);
    this.segButtons.forEach((b) => b.classList.toggle("on", b.dataset.themeVal === theme));
  }
}
