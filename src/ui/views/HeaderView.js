import { el } from "../../utils/dom.js";
import { DAY_MS } from "../../core/constants.js";

/** En-tête : wordmark éditable (= nom de l'app) + pastille de statut. */
export class HeaderView {
  constructor(app) {
    this.app = app;
    this.wordmark = el("wordmark");
    this.pill = el("backupPill");
    this.pillText = el("backupText");
  }

  bind() {
    this.wordmark.addEventListener("input", (e) => {
      const name = e.target.value.trim();
      this.app.store.setAppName(name);
      document.title = name || "Stint";
    });
    this.wordmark.addEventListener("blur", () => {
      if (!this.wordmark.value.trim()) this.app.store.setAppName("Stint");
      this.app.render();
    });
    this.pill.addEventListener("click", () => this.app.exportJSON());
  }

  render() {
    const { settings, segments, meta } = this.app.store;
    const name = settings.appName || "Stint";
    document.title = name;
    if (document.activeElement !== this.wordmark) this.wordmark.value = name;

    this.pill.classList.remove("warn", "crit");

    // Rappel de sauvegarde.
    const last = meta.lastExport ? new Date(meta.lastExport) : null;
    if (!last) {
      this.pillText.textContent = segments.length
        ? "Jamais exporté — pensez à sauvegarder"
        : "Aucune donnée";
      if (segments.length) this.pill.classList.add("warn");
      return;
    }
    const days = Math.floor((Date.now() - last.getTime()) / DAY_MS);
    this.pillText.textContent =
      days === 0 ? "Sauvegardé aujourd'hui"
      : days === 1 ? "Sauvegardé hier"
      : "Dernière sauvegarde il y a " + days + " j";
    if (days >= 3) this.pill.classList.add("warn");
  }
}
