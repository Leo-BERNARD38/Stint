import { el, qsa } from "../../utils/dom.js";
import { THEMES } from "../../core/constants.js";
import { icon } from "../icons.js";

const ICON_NAMES = { system: "monitor", light: "sun", dark: "moon" };
const LABELS = { system: "Système", light: "Clair", dark: "Sombre" };

/**
 * Gère le thème (clair / sombre / système) : applique data-theme, synchronise
 * le bouton du header et le contrôle segmenté, et tient à jour la couleur de
 * la barre système (meta theme-color) — utile en PWA installée.
 */
export class ThemeView {
  constructor(app) {
    this.app = app;
    this.toggle = el("themeToggle");
    this.segButtons = qsa("#themeSeg button");
    this.meta = document.querySelector('meta[name="theme-color"]');
    this.media = window.matchMedia("(prefers-color-scheme: dark)");
    this._lastIcon = null;
  }

  bind() {
    this.toggle.addEventListener("click", () => {
      const i = THEMES.indexOf(this.app.store.settings.theme);
      this.app.setTheme(THEMES[(i + 1) % THEMES.length]);
    });
    this.segButtons.forEach((b) =>
      b.addEventListener("click", () => this.app.setTheme(b.dataset.themeVal)));
    // en mode "système", suivre les changements d'OS pour la barre système
    this.media.addEventListener("change", () => {
      if (this.app.store.settings.theme === "system") this.#updateMeta("system");
    });
  }

  render() {
    const theme = this.app.store.settings.theme;
    document.documentElement.dataset.theme = theme;
    this.toggle.title = "Thème : " + (LABELS[theme] ?? theme);
    this.segButtons.forEach((b) => b.classList.toggle("on", b.dataset.themeVal === theme));
    if (theme !== this._lastIcon) {
      this.toggle.innerHTML = icon(ICON_NAMES[theme] ?? "monitor", { size: 17 });
      this._lastIcon = theme;
    }
    this.#updateMeta(theme);
  }

  #updateMeta(theme) {
    if (!this.meta) return;
    const dark = theme === "dark" || (theme === "system" && this.media.matches);
    this.meta.content = dark ? "#0c0c0e" : "#ffffff";
  }
}
