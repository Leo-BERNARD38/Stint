import { el, createEl, escapeHtml } from "../../utils/dom.js";
import { WEEKDAY_LABELS } from "../../core/constants.js";
import { fmtDateInput, parseDateInput, isoDow, toMin, cap, pad2 } from "../../utils/datetime.js";
import { clampEyeMinutes, clampEyeRest } from "../../models/Settings.js";
import { createScheduleEditor, describeBlocks } from "../components/ScheduleEditor.js";

const WEEKDAY_FULL = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

/* Fenêtre par défaut du ruban de précédence : 6 h → 20 h. Assez large pour une
   journée de bureau, assez serrée pour que les créneaux restent lisibles — mais
   elle s'élargit si le planning déborde, sinon un horaire atypique (nuit,
   astreinte) sortirait du cadre sans qu'on le voie. */
const STRIP_START = 6 * 60, STRIP_END = 20 * 60;

/**
 * Réglages : horaires (base + exceptions jour/date), conversion Jira, arrondi,
 * rappel « repos des yeux » et apparence.
 */
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

    // --- rappel « repos des yeux » ---
    // La permission ne peut être demandée que sur un geste utilisateur : on la
    // sollicite au moment où l'on active l'interrupteur.
    el("setEyeBreak").addEventListener("change", async (e) => {
      const on = e.target.checked;
      if (on) await this.app.eyeBreak.ensurePermission();
      store.updateSettings((s) => { s.eyeBreak.enabled = on; });
    });
    el("setEyeMinutes").addEventListener("change", (e) =>
      store.updateSettings((s) => { s.eyeBreak.minutes = clampEyeMinutes(e.target.value); }));
    el("setEyeSeconds").addEventListener("change", (e) =>
      store.updateSettings((s) => { s.eyeBreak.restSeconds = clampEyeRest(e.target.value); }));
    el("eyeBreakAsk").addEventListener("click", async () => {
      await this.app.eyeBreak.ensurePermission();
      this.render();
    });
    el("eyeBreakTest").addEventListener("click", () => this.app.eyeBreak.test());

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

    // --- pile de précédence : quel niveau l'emporte, pour une date donnée ---
    const precDate = el("precDate");
    precDate.value = fmtDateInput(new Date());
    precDate.addEventListener("change", () => this.#renderPrecedence());

    // --- onglets « Horaires » (De base / Par jour / Par date) : évite le gros scroll ---
    el("hoursSeg").addEventListener("click", (e) => {
      const b = e.target.closest("[data-hours]");
      if (b) this.#selectHoursTab(b.dataset.hours);
    });
    this.#selectHoursTab("base");

    this.#bindNavSpy();

    // pré-remplissage initial des éditeurs
    this.#loadWeekday();
    this.#loadDate();
  }

  /**
   * Sous-navigation collante : la section visible s'allume. Sans ce repère, une
   * nav collante ne fait qu'occuper la colonne — elle n'indique pas où l'on est.
   */
  #bindNavSpy() {
    const links = [...el("setNav").querySelectorAll("a")];
    const byId = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
    const seen = new Set();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id);
      // La première section visible dans l'ordre du document fait foi.
      const active = [...byId.keys()].find((id) => seen.has(id));
      links.forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + active));
    }, { rootMargin: "-90px 0px -55% 0px" });
    for (const id of byId.keys()) { const n = document.getElementById(id); if (n) io.observe(n); }
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
    this.#renderEyeBreak();

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
    this.#renderPrecedence();
  }

  /** Rappel « repos des yeux » : état de l'interrupteur, période et permission. */
  #renderEyeBreak() {
    const s = this.settings;
    const eye = this.app.eyeBreak;
    el("setEyeBreak").checked = s.eyeBreak.enabled;
    const minutes = el("setEyeMinutes");
    if (document.activeElement !== minutes) minutes.value = s.eyeBreak.minutes;
    const seconds = el("setEyeSeconds");
    if (document.activeElement !== seconds) seconds.value = s.eyeBreak.restSeconds;
    el("eyeBreakOpts").style.display = s.eyeBreak.enabled ? "" : "none";

    const perm = eye.permission;
    el("eyeBreakAsk").style.display = perm === "default" ? "" : "none";
    el("eyeBreakInfo").textContent = {
      granted: `Notifications autorisées — un rappel toutes les ${s.eyeBreak.minutes} min pendant qu'un chrono tourne, puis ${s.eyeBreak.restSeconds} s de repos.`,
      default: "Notifications pas encore autorisées : sans elles, le rappel ne s'affiche qu'en bandeau, dans l'onglet Stint.",
      denied: "Notifications refusées pour ce site : le rappel s'affichera en bandeau dans l'app. Réautorisez-les depuis le cadenas de la barre d'adresse.",
      unsupported: "Ce navigateur ne gère pas les notifications système : le rappel s'affichera en bandeau dans l'app.",
    }[perm];
  }

  /**
   * Pile de précédence + ruban du jour.
   *
   * Les horaires se résolvent sur trois niveaux (base < jour de semaine < date)
   * et rien, jusqu'ici, ne disait lequel gagnait : on réglait une exception sans
   * savoir si elle servait à quelque chose. On affiche donc les trois candidats
   * pour une date de référence, on cercle celui que `Settings.blocksFor()`
   * retient, et on dessine le résultat à l'échelle. Lecture pure du domaine —
   * aucune règle n'est réimplémentée ici.
   */
  #renderPrecedence() {
    const s = this.settings;
    const key = el("precDate").value;
    if (!key) return;
    const date = parseDateInput(key);
    const dow = isoDow(date);

    const baseBlocks = s.isWorkDay(dow) ? s.baseBlocks() : [];
    const rows = [
      { k: "Base", blocks: baseBlocks, set: true },
      { k: cap(WEEKDAY_FULL[dow - 1]), blocks: s.weekdayHours[dow], set: !!s.weekdayHours[dow] },
      { k: this.#fmtDate(key), blocks: s.dateHours[key], set: !!s.dateHours[key] },
    ];
    // Le plus spécifique DÉFINI l'emporte : c'est exactement l'ordre de blocksFor().
    let winner = 0;
    for (let i = rows.length - 1; i >= 0; i--) { if (rows[i].set) { winner = i; break; } }

    el("precStack").innerHTML = rows.map((r, i) => {
      const off = !r.set;
      const val = off ? "suit le niveau au-dessus" : describeBlocks(r.blocks);
      return (
        `<div class="prec-row${i === winner ? " wins" : ""}">` +
          `<span class="prec-step">${i + 1}</span>` +
          `<span class="prec-k">${escapeHtml(r.k)}</span>` +
          `<span class="prec-v${off ? " off" : ""}">${escapeHtml(val)}</span>` +
          `<span class="prec-tag">${i === winner ? "retenu" : "ignoré"}</span>` +
        `</div>`
      );
    }).join("");

    this.#renderStrip(s.blocksFor(date));
  }

  /** Ruban : les créneaux retenus, dessinés à l'échelle. */
  #renderStrip(blocks) {
    const strip = el("precStrip");
    const axis = el("precStripAxis");
    const mins = (blocks ?? []).flat().map(toMin);
    // La fenêtre s'ouvre à l'heure pleine pour englober tout le planning.
    const from = Math.min(STRIP_START, ...mins.map((m) => Math.floor(m / 60) * 60));
    const to = Math.max(STRIP_END, ...mins.map((m) => Math.ceil(m / 60) * 60));
    const span = Math.max(60, to - from);
    const pct = (min) => ((min - from) / span) * 100;

    strip.innerHTML = blocks && blocks.length
      ? blocks.map(([a, b]) => {
          const l = pct(toMin(a));
          return `<i style="left:${l}%;width:${Math.max(0.5, pct(toMin(b)) - l)}%"></i>`;
        }).join("")
      : '<span class="strip-off">jour non travaillé</span>';

    // Un repère toutes les 2 h, mais jamais plus de 8 : au-delà ils se marchent
    // dessus dès que la fenêtre s'élargit.
    const step = Math.max(120, Math.ceil(span / 8 / 60) * 60);
    axis.innerHTML = "";
    for (let m = from; m <= to; m += step) {
      axis.appendChild(createEl("span", {
        text: pad2(Math.floor(m / 60)) + ":" + pad2(m % 60),
        attrs: { style: `left:${pct(m)}%` },
      }));
    }
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
