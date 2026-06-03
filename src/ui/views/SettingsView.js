import { el, createEl } from "../../utils/dom.js";
import { WEEKDAY_LABELS } from "../../core/constants.js";

/** Réglages : horaires ouvrés, conversion Jira, arrondi. */
export class SettingsView {
  constructor(app) {
    this.app = app;
  }

  bind() {
    const store = this.app.store;
    const simple = {
      setArrival: "arrival", setLunchStart: "lunchStart",
      setLunchEnd: "lunchEnd", setDeparture: "departure",
    };
    for (const [id, key] of Object.entries(simple)) {
      el(id).addEventListener("change", (e) => store.updateSettings((s) => { s[key] = e.target.value; }));
    }
    el("setHpd").addEventListener("change", (e) =>
      store.updateSettings((s) => { s.jira.hoursPerDay = Math.max(0.5, parseFloat(e.target.value) || 8); }));
    el("setDpw").addEventListener("change", (e) =>
      store.updateSettings((s) => { s.jira.daysPerWeek = Math.max(1, Math.min(7, parseInt(e.target.value) || 5)); }));
    el("setRounding").addEventListener("change", (e) =>
      store.updateSettings((s) => { s.rounding = e.target.value; }));
  }

  render() {
    const s = this.app.store.settings;
    el("setArrival").value = s.arrival;
    el("setLunchStart").value = s.lunchStart;
    el("setLunchEnd").value = s.lunchEnd;
    el("setDeparture").value = s.departure;
    el("setHpd").value = s.jira.hoursPerDay;
    el("setDpw").value = s.jira.daysPerWeek;
    el("setRounding").value = s.rounding;

    const wd = el("weekdays");
    wd.innerHTML = "";
    for (let iso = 1; iso <= 7; iso++) {
      wd.appendChild(createEl("button", {
        className: s.isWorkDay(iso) ? "on" : "",
        text: WEEKDAY_LABELS[iso - 1],
        on: { click: () => this.app.store.updateSettings((set) => set.toggleWorkDay(iso)) },
      }));
    }
  }
}
