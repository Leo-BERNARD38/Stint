import { el } from "../../utils/dom.js";
import { storageInfo, formatBytes } from "../../services/StorageInfo.js";

const WARN = 70;  // %
const CRIT = 85;  // % → alerte en haut

/** Jauge de stockage local (réglages) + alerte en haut quand c'est presque plein. */
export class StorageView {
  constructor(app) {
    this.app = app;
    this.text = el("storageText");
    this.bar = el("storageBar");
    this.alert = el("storageAlert");
    this.alertText = el("storageAlertText");
  }

  bind() {
    el("clearEntries").addEventListener("click", () => this.app.clearEntries());
    el("purgeBtn").addEventListener("click", () => this.app.purgeOld(Number(el("purgeDays").value)));
    el("storageAlertBtn").addEventListener("click", () => this.app.showScreen("settings"));
  }

  render() {
    const { used, budget, percent } = storageInfo();
    const pctStr = percent < 1 ? percent.toFixed(1) : String(Math.round(percent));

    this.text.textContent = `${formatBytes(used)} · ${pctStr}% de ${formatBytes(budget)}`;
    this.bar.style.width = Math.max(2, percent) + "%";
    this.bar.classList.toggle("warn", percent >= WARN && percent < CRIT);
    this.bar.classList.toggle("crit", percent >= CRIT);

    const full = percent >= CRIT;
    this.alert.hidden = !full;
    if (full) {
      this.alertText.textContent =
        `Stockage presque plein (${pctStr}%). Exportez vos données, puis supprimez les anciennes.`;
    }
  }
}
