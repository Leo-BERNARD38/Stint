import { el, createEl, escapeHtml } from "../../utils/dom.js";
import { WEEKDAY_LABELS } from "../../core/constants.js";
import { fmtDateInput, parseDateInput } from "../../utils/datetime.js";
import { createScheduleEditor, describeBlocks } from "../components/ScheduleEditor.js";

const WEEKDAY_FULL = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

/** Réglages : horaires (base + exceptions jour/date), conversion Jira, arrondi. */
export class SettingsView {
  constructor(app) {
    this.app = app;
    this.anchor = el("settingsScreen");
    this.wdayEditor = createScheduleEditor();
    this.dateEditor = createScheduleEditor();
  }

  get settings() { return this.app.store.settings; }

  bind() {
    const store = this.app.store;

    // --- base : horaires + Jira + arrondi ---
    const simple = {
      setArrival: "arrival", setLunchStart: "lunchStart",
      setLunchEnd: "lunchEnd", setDeparture: "departure",
    };
    for (const [id, key] of Object.entries(simple)) {
      el(id).addEventListener("change", (e) => store.updateSettings((s) => { s[key] = e.target.value; }));
    }
    el("setJiraAuto").addEventListener("change", (e) =>
      store.updateSettings((s) => { s.jira.auto = e.target.checked; }));
    el("setHpd").addEventListener("change", (e) =>
      store.updateSettings((s) => { s.jira.hoursPerDay = Math.max(0.5, parseFloat(e.target.value) || 8); }));
    el("setDpw").addEventListener("change", (e) =>
      store.updateSettings((s) => { s.jira.daysPerWeek = Math.max(1, Math.min(7, parseInt(e.target.value) || 5)); }));
    el("setRounding").addEventListener("change", (e) =>
      store.updateSettings((s) => { s.rounding = e.target.value; }));
    el("setBgDots").addEventListener("change", (e) =>
      store.updateSettings((s) => { s.bgDots = e.target.checked; }));

    // --- exceptions par jour de semaine ---
    const wdaySelect = el("wdaySelect");
    for (let iso = 1; iso <= 7; iso++) {
      wdaySelect.appendChild(createEl("option", { attrs: { value: String(iso) }, text: WEEKDAY_FULL[iso - 1] }));
    }
    el("wdayEditorMount").appendChild(this.wdayEditor.element);
    wdaySelect.addEventListener("change", () => this.#loadWeekday());
    el("wdaySave").addEventListener("click", () => {
      const dow = Number(wdaySelect.value);
      store.updateSettings((s) => s.setWeekdayHours(dow, this.wdayEditor.getValue()));
      this.app.toast.show("Horaires du " + WEEKDAY_FULL[dow - 1] + " enregistrés");
    });
    el("wdayReset").addEventListener("click", () => {
      const dow = Number(wdaySelect.value);
      store.updateSettings((s) => s.setWeekdayHours(dow, null));
      this.#loadWeekday();
    });
    el("weekdayOvList").addEventListener("click", (e) => {
      const rm = e.target.closest("[data-rm-wday]");
      if (rm) { store.updateSettings((s) => s.setWeekdayHours(Number(rm.dataset.rmWday), null)); return; }
      const row = e.target.closest("[data-wday]");
      if (row) { wdaySelect.value = row.dataset.wday; this.#loadWeekday(); }
    });

    // --- exceptions par date ---
    const dateSelect = el("dateSelect");
    dateSelect.value = fmtDateInput(new Date());
    el("dateEditorMount").appendChild(this.dateEditor.element);
    dateSelect.addEventListener("change", () => this.#loadDate());
    el("dateSave").addEventListener("click", () => {
      const key = dateSelect.value;
      if (!key) return;
      store.updateSettings((s) => s.setDateHours(key, this.dateEditor.getValue()));
      this.app.toast.show("Horaires du " + key + " enregistrés");
    });
    el("dateRemove").addEventListener("click", () => {
      const key = dateSelect.value;
      store.updateSettings((s) => s.setDateHours(key, null));
      this.#loadDate();
    });
    el("dateOvList").addEventListener("click", (e) => {
      const rm = e.target.closest("[data-rm-date]");
      if (rm) { store.updateSettings((s) => s.setDateHours(rm.dataset.rmDate, null)); return; }
      const row = e.target.closest("[data-date]");
      if (row) { dateSelect.value = row.dataset.date; this.#loadDate(); }
    });

    // --- onglets « Horaires » (De base / Par jour / Par date) : évite le gros scroll ---
    el("hoursSeg").addEventListener("click", (e) => {
      const b = e.target.closest("[data-hours]");
      if (b) this.#selectHoursTab(b.dataset.hours);
    });
    this.#selectHoursTab("base");

    // pré-remplissage initial des éditeurs
    this.#loadWeekday();
    this.#loadDate();
  }

  #selectHoursTab(name) {
    const order = ["base", "weekday", "date"];
    const seg = el("hoursSeg");
    [...seg.children].forEach((b) => b.classList.toggle("active", b.dataset.hours === name));
    seg.style.setProperty("--seg-i", Math.max(0, order.indexOf(name)));
    document.querySelectorAll(".hours-panel").forEach((p) => { p.hidden = p.dataset.hoursPanel !== name; });
  }

  #loadWeekday() {
    const dow = Number(el("wdaySelect").value);
    this.wdayEditor.setValue(this.settings.weekdayHours[dow] ?? this.settings.baseBlocks());
  }

  #loadDate() {
    const key = el("dateSelect").value;
    if (!key) return;
    this.dateEditor.setValue(this.settings.dateHours[key] ?? this.settings.blocksFor(parseDateInput(key)));
  }

  render() {
    const s = this.settings;
    const fmt = this.app.formatter;

    // base : n'écrase pas un champ en cours d'édition
    const setIf = (id, val) => { const e = el(id); if (document.activeElement !== e) e.value = val; };
    setIf("setArrival", s.arrival);
    setIf("setLunchStart", s.lunchStart);
    setIf("setLunchEnd", s.lunchEnd);
    setIf("setDeparture", s.departure);
    setIf("setHpd", s.jira.hoursPerDay);
    setIf("setDpw", s.jira.daysPerWeek);
    setIf("setRounding", s.rounding);

    el("setBgDots").checked = s.bgDots;

    el("setJiraAuto").checked = s.jira.auto;
    el("jiraManual").style.display = s.jira.auto ? "none" : "";
    const info = el("jiraAutoInfo");
    info.style.display = s.jira.auto ? "" : "none";
    if (s.jira.auto) {
      const h = parseFloat(fmt.effHoursPerDay().toFixed(2));
      info.textContent = `1d = ${h} h · 1w = ${fmt.effDaysPerWeek()} jours (depuis vos horaires)`;
    }

    // jours travaillés (base)
    const wd = el("weekdays");
    wd.innerHTML = "";
    for (let iso = 1; iso <= 7; iso++) {
      wd.appendChild(createEl("button", {
        className: s.isWorkDay(iso) ? "on" : "",
        text: WEEKDAY_LABELS[iso - 1],
        on: { click: () => this.app.store.updateSettings((set) => set.toggleWorkDay(iso)) },
      }));
    }

    this.#renderOverrideLists();
  }

  #renderOverrideLists() {
    const s = this.settings;

    const wList = el("weekdayOvList");
    const wEntries = Object.keys(s.weekdayHours).map(Number).sort((a, b) => a - b);
    wList.innerHTML = wEntries.length
      ? wEntries.map((dow) => this.#ovRow("wday", dow, WEEKDAY_FULL[dow - 1], s.weekdayHours[dow])).join("")
      : '<div class="ov-empty">Aucune exception — tous les jours travaillés suivent la base.</div>';

    const dList = el("dateOvList");
    const dEntries = Object.keys(s.dateHours).sort();
    dList.innerHTML = dEntries.length
      ? dEntries.map((key) => this.#ovRow("date", key, this.#fmtDate(key), s.dateHours[key])).join("")
      : '<div class="ov-empty">Aucune date spécifique.</div>';
  }

  #ovRow(kind, id, label, blocks) {
    const off = !blocks || blocks.length === 0;
    return (
      `<div class="ov-item" data-${kind}="${escapeHtml(String(id))}">` +
        `<span class="ov-name">${escapeHtml(label)}</span>` +
        `<span class="ov-sum${off ? " off" : ""}">${escapeHtml(describeBlocks(blocks))}</span>` +
        `<button class="ov-rm" data-rm-${kind}="${escapeHtml(String(id))}" title="Retirer" aria-label="Retirer">×</button>` +
      `</div>`
    );
  }

  #fmtDate(key) {
    return parseDateInput(key).toLocaleDateString("fr-FR", {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
    });
  }
}
