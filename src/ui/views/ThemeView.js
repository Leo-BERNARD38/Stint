import { el } from "../../utils/dom.js";
import { THEMES } from "../../core/constants.js";
import { icon } from "../icons.js";

const ICON_NAMES = { system: "monitor", light: "sun", dark: "moon" };
const LABELS = { system: "Système", light: "Clair", dark: "Sombre" };

/**
 * Gère le thème (clair / sombre / système) : applique data-theme, synchronise
 * le bouton cyclique du header **et** le contrôle segmenté des réglages, et
 * tient à jour la couleur de la barre système (meta theme-color) — utile en PWA.
 */
export class ThemeView {
  #lastIcon = null; // évite de ré-injecter (et ré-animer) l'icône à chaque rendu

  constructor(app) {
    this.app = app;
    this.toggle = el("themeToggle");
    this.seg = el("themeSeg");
    this.segBtns = [...this.seg.querySelectorAll("[data-theme-opt]")];
    this.meta = document.querySelector('meta[name="theme-color"]');
    this.media = window.matchMedia("(prefers-color-scheme: dark)");
  }

  bind() {
    this.toggle.addEventListener("click", () => {
      const i = THEMES.indexOf(this.app.store.settings.theme);
      this.app.setTheme(THEMES[(i + 1) % THEMES.length]);
    });
    this.seg.addEventListener("click", (e) => {
      const b = e.target.closest("[data-theme-opt]");
      if (b) this.app.setTheme(b.dataset.themeOpt);
    });
    this.media.addEventListener("change", () => {
      if (this.app.store.settings.theme === "system") this.#updateMeta("system");
    });
  }

  render() {
    const theme = this.app.store.settings.theme;
    const root = document.documentElement;
    root.dataset.theme = theme;
    // Forçage inline du color-scheme : en PWA installée (standalone), le seul
    // attribut [data-theme] ne suffit pas à faire basculer light-dark().
    root.style.colorScheme = theme === "system" ? "light dark" : theme;
    this.toggle.title = "Thème : " + (LABELS[theme] ?? theme);
    // contrôle segmenté : curseur + état actif
    this.seg.style.setProperty("--seg-i", Math.max(0, THEMES.indexOf(theme)));
    this.segBtns.forEach((b) => b.classList.toggle("active", b.dataset.themeOpt === theme));
    if (theme !== this.#lastIcon) {
      this.toggle.innerHTML = icon(ICON_NAMES[theme] ?? "monitor", { size: 17 });
      this.#lastIcon = theme;
    }
    this.#updateMeta(theme);
  }

  #updateMeta(theme) {
    if (!this.meta) return;
    const dark = theme === "dark" || (theme === "system" && this.media.matches);
    this.meta.content = dark ? "#0c0c0e" : "#ffffff";
  }
}
