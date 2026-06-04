import { el } from "../../utils/dom.js";
import { storageInfo, formatBytes, WARN, CRIT } from "../../services/StorageInfo.js";

/** Jauge de stockage local (réglages) + actions de maintenance. */
export class StorageView {
  constructor(app) {
    this.app = app;
    this.text = el("storageText");
    this.bar = el("storageBar");
  }

  bind() {
    el("clearEntries").addEventListener("click", () => this.app.clearEntries());
    el("purgeBtn").addEventListener("click", () => this.app.purgeOld(Number(el("purgeDays").value)));
  }

  render() {
    const { used, budget, percent } = storageInfo();
    const pctStr = percent < 1 ? percent.toFixed(1) : String(Math.round(percent));
    this.text.textContent = `${formatBytes(used)} · ${pctStr}% de ${formatBytes(budget)}`;
    this.bar.style.width = Math.max(2, percent) + "%";
    this.bar.classList.toggle("warn", percent >= WARN && percent < CRIT);
    this.bar.classList.toggle("crit", percent >= CRIT);
  }
}
