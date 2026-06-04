import { el } from "../../utils/dom.js";
import { storageSnapshot, refreshStorage, formatBytes } from "../../services/StorageInfo.js";

/** Jauge d'espace de stockage (réglages) + actions de maintenance. */
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
    this.#paint(storageSnapshot());
    refreshStorage().then((s) => this.#paint(s));
  }

  #paint(s) {
    if (!s) { this.text.textContent = "…"; this.bar.style.width = "2%"; return; }
    const pct = s.percent < 1 ? s.percent.toFixed(1) : String(Math.round(s.percent));
    this.text.textContent = `${formatBytes(s.used)} · ${pct}% de ${formatBytes(s.quota)}`;
    this.bar.style.width = Math.max(2, s.percent) + "%";
    this.bar.classList.toggle("warn", s.percent >= 70 && s.percent < 90);
    this.bar.classList.toggle("crit", s.percent >= 90);
  }
}
