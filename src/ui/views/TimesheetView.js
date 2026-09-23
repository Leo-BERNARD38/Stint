import { el, escapeHtml } from "../../utils/dom.js";
import { icon } from "../icons.js";
import { toggleLine, setAllDone, removeLine, addToLine, setLine } from "../../models/TimesheetLines.js";

const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const DAY_LONG = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

/**
 * Onglet **Saisie** (§17) : ce qu'on DÉCLARE dans Jira, semaine par semaine.
 *
 * Une tête (la semaine, déclaré / cible, la barre saisi · à saisir · à
 * compléter), puis une FEUILLE : une ligne par tâche, une colonne par jour, et
 * la réserve de la tâche en dernière colonne. Des cartes par jour avaient été
 * essayées d'abord : à cinq de front, le nom de la tâche — qui porte la clé
 * Jira, c'est-à-dire LA donnée à recopier — tombait en « MOD-… ». Et la ligne
 * répond à la question qu'on se pose dans Jira, ticket ouvert : « qu'est-ce que
 * je loggue sur celui-ci, et quel jour ? ».
 *
 * Tout se lit dans `app.timesheetWeek()` ; la vue ne calcule rien. Une retouche
 * part des lignes AFFICHÉES du jour (la proposition s'il n'est pas figé), les
 * transforme par une fonction pure de `TimesheetLines` et les confie au Store —
 * c'est ce qui fige le jour.
 *
 * Le formulaire sous la feuille a deux emplois : COMPLÉTER un jour (choisir une
 * tâche et une durée) et MODIFIER une case (clic sur sa durée : combien de cette
 * tâche on déclare ce jour-là — c'est ainsi qu'entre deux tâches qui débordent,
 * on en privilégie une). Durées par blocs du type, toujours.
 *
 * Ce formulaire vit sous la feuille. Il n'est pas reconstruit tant
 * que le focus y est (même garde que la table Segments) : le chrono re-rend
 * toutes les 15 s, on ne vole pas la saisie en cours.
 */
export class TimesheetView {
  constructor(app) {
    this.app = app;
    this.lead = el("tsLead");
    this.table = el("tsTable");
    this.add = el("tsAdd");
    this.foot = el("tsFoot");
    this.anchor = this.table;
    this.adding = null; // { key, taskId, mode: "add"|"edit" } : le formulaire ouvert, s'il y en a un
  }

  bind() {
    el("tsPrev").addEventListener("click", () => { this.adding = null; this.app.shiftTimesheetWeek(-1); });
    el("tsNext").addEventListener("click", () => { this.adding = null; this.app.shiftTimesheetWeek(1); });
    el("tsNow").addEventListener("click", () => { this.adding = null; this.app.timesheetToday(); });

    this.table.addEventListener("change", (e) => {
      const box = e.target.closest("[data-ts-check]");
      if (!box) return;
      // Le rendu reconstruit la feuille : on rend le focus à la même case.
      // (Échappé : un identifiant importé peut contenir n'importe quoi, et un
      // sélecteur invalide ferait lever `querySelector` au milieu du rendu.)
      this.refocus = `[data-ts-check="${CSS.escape(box.dataset.tsCheck)}"][data-day="${CSS.escape(box.dataset.day)}"]`;
      this.#edit(box.dataset.day, (l) => toggleLine(l, box.dataset.tsCheck));
    });
    this.table.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      const key = b.dataset.day;
      switch (b.dataset.act) {
        case "all": {
          const day = this.#day(key);
          const all = day.lines.length > 0 && day.lines.every((l) => l.done);
          this.#edit(key, (l) => setAllDone(l, !all));
          break;
        }
        case "rm": this.#edit(key, (l) => removeLine(l, b.dataset.task)); break;
        case "copy": this.app.copy(b.dataset.value, b); break;
        case "recalc": this.app.recalcTimesheetDay(key); break;
        case "open": this.#openAdd(key); break;
        case "edit": this.#openAdd(key, b.dataset.task, "edit"); break;
        case "res": this.#placeReserve(b.dataset.task); break;
      }
    });

    this.add.addEventListener("change", (e) => {
      const sel = e.target.closest("[data-ts-task]");
      if (sel) { this.adding.taskId = sel.value; this.#suggest(); }
    });
    this.add.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      if (b.dataset.act === "cancel") this.#closeAdd();
      else if (b.dataset.act === "add") this.#submit();
    });
    this.add.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.matches("input, select")) { e.preventDefault(); this.#submit(); }
      if (e.key === "Escape") { e.stopPropagation(); this.#closeAdd(); }
    });
  }

  render() {
    const week = this.app.timesheetWeek();
    this.week = week;
    // Un formulaire ouvert sur un jour qui n'est plus dans la semaine affichée
    // (flèches du clavier) n'a plus de sens.
    if (this.adding && !this.#day(this.adding.key)) this.adding = null;
    el("tsNow").disabled = week.current;
    el("tsRule").textContent = this.#rule();
    this.#renderLead(week);
    this.#renderTable(week);
    if (!this.add.contains(document.activeElement)) this.#renderAdd();
    this.#renderFoot(week);
    if (this.refocus) { this.table.querySelector(this.refocus)?.focus(); this.refocus = null; }
  }

  /* ------------------------------ tête ------------------------------ */
  #rule() {
    const st = this.app.store.settings.timesheet.steps;
    return `${this.app.formatter.clock(this.app.timesheet.dayTarget())} par jour (1d Jira) · blocs dev ${st.dev} min · support ${st.support} min · autre ${st.autre} min`;
  }

  #renderLead(week) {
    const c = (m) => this.app.formatter.clock(m);
    const t = week.totals;
    const pending = t.declared - t.done;
    const legend = [
      `${c(t.done)} saisies`,
      pending > 0 ? `${c(pending)} à saisir` : "",
      t.gap > 0 ? `${c(t.gap)} à compléter` : "",
    ].filter(Boolean).join(" · ");
    this.lead.innerHTML =
      '<div class="ts-lead-l">' +
        `<span class="k">${escapeHtml(week.label)}<em>${escapeHtml(week.sub)}</em></span>` +
        `<span class="v">${c(t.declared)}<small>/ ${c(t.target)}</small></span>` +
        // La cible ne vient PAS des horaires : jours travaillés × cible du jour.
        `<span class="ts-calc">${week.workedDays} j × ${c(this.app.timesheet.dayTarget())}</span>` +
      "</div>" +
      '<div class="ts-lead-r">' +
        this.#bar(t.target, t.declared, t.done, t.gap, "ts-track", legend) +
        `<div class="cov-lab"><span>${escapeHtml(legend)}</span></div>` +
        `<div class="cov-lab"><span>pointé arrondi ${c(t.real)}</span><span>réserve ${c(t.reserve)}</span></div>` +
      "</div>";
  }

  /**
   * La barre de part d'une cible : saisi (accent), à saisir (lavis), à
   * compléter (hachures), collés dans l'ordre du travail. La piste est la cible,
   * ou le déclaré s'il la dépasse.
   */
  #bar(target, declared, done, gap, cls, label = "") {
    const base = Math.max(target, declared) || 1;
    const w = (m) => (m / base) * 100;
    const pending = declared - done;
    return `<span class="cov-track ${cls}"${label ? ` role="img" aria-label="${escapeHtml(label)}"` : ' aria-hidden="true"'}>` +
      (done > 0 ? `<i style="width:${w(done)}%"></i>` : "") +
      (pending > 0 ? `<i class="ts-pending" style="width:${w(pending)}%"></i>` : "") +
      (gap > 0 ? `<i class="cov-gap" style="width:${w(gap)}%"></i>` : "") +
      "</span>";
  }

  /* ------------------------------ feuille ------------------------------ */
  /** Les tâches de la semaine : par première apparition, puis la réserve seule. */
  #rows(week) {
    const ids = [];
    const seen = new Set();
    const push = (id) => { if (!seen.has(id) && this.app.store.taskById(id)) { seen.add(id); ids.push(id); } };
    for (const d of week.days) for (const l of d.lines) push(l.taskId);
    for (const r of week.reserve) push(r.taskId);
    return ids;
  }

  #renderTable(week) {
    const days = week.days.filter((d) => d.visible);
    const rows = this.#rows(week);
    const res = new Map(week.reserve.map((r) => [r.taskId, r.min]));

    const head = '<thead><tr><th class="ts-tk" scope="col">Tâche</th>' +
      days.map((d) => this.#dayHead(d)).join("") +
      '<th class="ts-rcol" scope="col" title="Le pointé qui n’a pas encore de jour">Réserve</th></tr></thead>';

    const body = rows.length
      ? rows.map((id) => this.#row(id, days, res.get(id) ?? 0)).join("")
      : `<tr><td class="ts-empty" colspan="${days.length + 2}">Rien de pointé cette semaine.</td></tr>`;

    const gaps = '<tr class="ts-gaps"><th class="ts-tk" scope="row">À compléter</th>' +
      days.map((d) => `<td>${this.#gapCell(d)}</td>`).join("") + "<td></td></tr>";

    this.table.innerHTML = head + "<tbody>" + body + "</tbody><tfoot>" + gaps + "</tfoot>";
  }

  #dayHead(d) {
    const c = (m) => this.app.formatter.clock(m);
    const key = escapeHtml(d.key);
    const long = DAY_LONG[d.dow - 1];
    const off = !d.worked && d.lines.length === 0;
    const state = d.leave ? "congé" : off ? "non travaillé" : d.future ? "à venir" : d.today ? "aujourd’hui" : "";
    const all = d.lines.length > 0 && d.lines.every((l) => l.done);
    const cls = "ts-dcol" + (d.today ? " is-today" : "") + (off ? " is-off" : "") + (d.frozen ? " is-frozen" : "");
    const actions = off || (d.future && !d.lines.length) ? "" :
      '<span class="ts-dact">' +
        (d.frozen ? `<button class="mini-btn icon-only" data-act="recalc" data-day="${key}" title="Recalculer ce jour (il est figé)" aria-label="Recalculer le ${long}">${icon("rotate-ccw", { size: 13 })}</button>` : "") +
        (d.lines.length ? `<button class="mini-btn icon-only ts-all${all ? " on" : ""}" data-act="all" data-day="${key}" aria-pressed="${all}" title="${all ? "Tout décocher" : "Tout cocher : le jour est saisi"}" aria-label="${all ? "Tout décocher" : "Tout cocher"} le ${long}">${icon("check", { size: 13 })}</button>` : "") +
      "</span>";
    const sub = [state, d.frozen ? "figé" : ""].filter(Boolean).join(" · ");
    return `<th class="${cls}" scope="col">` +
      `<span class="ts-dh"><span class="ts-dn">${DAY_NAMES[d.dow - 1]} ${d.date.getDate()}</span>${actions}</span>` +
      `<span class="ts-dsub">${sub || " "}</span>` +
      (off ? "" :
        `<span class="ts-dt"><b>${c(d.declared)}</b>/ ${c(d.target)}</span>` +
        this.#bar(d.target, d.declared, d.done, d.future ? 0 : d.gap, "ts-track-day") +
        `<span class="ts-dreal">${d.future ? " " : "pointé " + c(d.real)}</span>`) +
      "</th>";
  }

  #row(taskId, days, reserveMin) {
    const { store, formatter } = this.app;
    const t = store.taskById(taskId);
    const id = escapeHtml(taskId);
    const name = escapeHtml(t.displayName);
    const cells = days.map((d) => {
      const l = d.lines.find((x) => x.taskId === taskId);
      if (!l) return '<td class="ts-cell is-empty"></td>';
      const key = escapeHtml(d.key);
      const jira = escapeHtml(formatter.jira(l.min));
      return `<td class="ts-cell${l.done ? " done" : ""}"><span class="ts-c">` +
        '<span class="ts-acts">' +
          `<button class="mini-btn icon-only ts-rm" data-act="rm" data-day="${key}" data-task="${id}" title="Retirer (retourne en réserve)" aria-label="Retirer">${icon("x", { size: 13 })}</button>` +
          `<button class="mini-btn icon-only" data-act="copy" data-value="${jira}" title="Copier « ${jira} »" aria-label="Copier ${jira}">${icon("copy", { size: 13 })}</button>` +
        "</span>" +
        `<input type="checkbox" data-ts-check="${id}" data-day="${key}"${l.done ? " checked" : ""} aria-label="${name}, ${DAY_LONG[d.dow - 1]} : saisi dans Jira">` +
        `<button class="ts-dur" data-act="edit" data-day="${key}" data-task="${id}" title="Modifier la durée déclarée" aria-label="${name}, ${DAY_LONG[d.dow - 1]} : ${formatter.clock(l.min)}, modifier">${formatter.clock(l.min)}</button>` +
        "</span></td>";
    }).join("");
    // La réserve de la tâche, en blocs entiers de son type (cf. `Timesheet.week`).
    const resCell = reserveMin > 0
      ? `<button class="ts-res" data-act="res" data-task="${id}" title="Poser sur un jour à compléter">${formatter.clock(reserveMin)}</button>`
      : "";
    return `<tr><th class="ts-tk" scope="row"><span class="ts-name" title="${name}">` +
        `<i class="o-dot" style="background:${escapeHtml(t.color)}"></i><span class="ts-nt">${name}</span>` +
        (t.link ? `<a class="ts-link" href="${escapeHtml(t.link)}" target="_blank" rel="noopener noreferrer" title="Ouvrir le lien" aria-label="Ouvrir le lien">${icon("external-link", { size: 13 })}</a>` : "") +
      "</span></th>" + cells + `<td class="ts-rcell">${resCell}</td></tr>`;
  }

  #gapCell(d) {
    if (d.future || (!d.worked && !d.lines.length)) return "";
    const key = escapeHtml(d.key);
    const long = DAY_LONG[d.dow - 1];
    const open = this.adding?.key === d.key ? " is-open" : "";
    if (d.gap > 0) {
      return `<button class="ts-gap${open}" data-act="open" data-day="${key}" title="Compléter le ${long}">` +
        `${this.app.formatter.clock(d.gap)}</button>`;
    }
    return `<button class="mini-btn icon-only ts-more${open}" data-act="open" data-day="${key}" title="Ajouter une ligne au ${long}" aria-label="Ajouter une ligne au ${long}">${icon("plus", { size: 13 })}</button>`;
  }

  /* ----------------------- compléter un jour ----------------------- */
  #renderAdd() {
    const d = this.adding && this.#day(this.adding.key);
    if (!d) { this.add.innerHTML = ""; return; }
    const { store, formatter } = this.app;
    const editing = this.adding.mode === "edit";
    const day = `${DAY_LONG[d.dow - 1]} ${d.date.getDate()}`;
    const step = this.app.timesheet.stepFor(this.adding.taskId);
    let title, picker;
    if (editing) {
      // Modifier une case : la tâche est donnée, seule la durée change.
      const t = store.taskById(this.adding.taskId);
      title = `Modifier · ${day}` + (d.gap > 0 ? ` · il manque ${formatter.clock(d.gap)}` : "");
      picker = `<span class="ts-add-task"><i class="o-dot" style="background:${escapeHtml(t?.color ?? "")}"></i>${escapeHtml(t?.displayName ?? "")}</span>`;
    } else {
      const res = new Map(this.week.reserve.map((r) => [r.taskId, r.min]));
      const opt = (t, extra = "") =>
        `<option value="${escapeHtml(t.id)}"${t.id === this.adding.taskId ? " selected" : ""}>${escapeHtml(t.displayName)}${extra}</option>`;
      const inRes = this.week.reserve.map((r) => store.taskById(r.taskId)).filter(Boolean);
      const others = store.tasks.filter((t) => !res.has(t.id) && !t.archived);
      title = `Compléter le ${day}` + (d.gap > 0 ? ` · il manque ${formatter.clock(d.gap)}` : "");
      picker = '<span class="select-wrap"><select data-ts-task aria-label="Tâche">' +
        (inRes.length ? '<optgroup label="En réserve">' +
          inRes.map((t) => opt(t, ` · ${formatter.clock(res.get(t.id))}`)).join("") + "</optgroup>" : "") +
        (others.length ? '<optgroup label="Autres tâches">' + others.map((t) => opt(t)).join("") + "</optgroup>" : "") +
        `</select><span class="select-chev">${icon("chevron-down", { size: 16 })}</span></span>`;
    }
    this.add.innerHTML = '<div class="ts-add">' +
      `<span class="ts-add-t">${escapeHtml(title)}</span>` +
      picker +
      '<span class="ts-add-row">' +
        `<input type="number" class="tinput" data-ts-min min="${editing ? 0 : step}" max="720" step="${step}" aria-label="Durée en minutes">` +
        `<span class="prec-sep">min · blocs de ${step}</span>` +
      "</span>" +
      '<span class="ts-add-row">' +
        '<button class="btn" data-act="cancel">Annuler</button>' +
        `<button class="btn primary" data-act="add">${editing ? "Enregistrer" : "Ajouter"}</button>` +
      "</span>" +
      "</div>";
    this.#suggest();
  }

  #openAdd(key, taskId = null, mode = "add") {
    const { store } = this.app;
    const first = this.week.reserve[0]?.taskId ?? store.openTasks()[0]?.id ?? store.tasks[0]?.id;
    if (!taskId && !first) { this.app.toast.show("Aucune tâche à déclarer"); return; }
    this.adding = { key, taskId: taskId ?? first, mode };
    this.add.innerHTML = ""; // on quitte un éventuel formulaire ouvert : il doit être reconstruit
    this.render();
    this.add.querySelector(mode === "edit" ? "[data-ts-min]" : "select")?.focus();
    if (mode === "edit") this.add.querySelector("[data-ts-min]")?.select();
  }

  #closeAdd() {
    this.adding = null;
    this.add.innerHTML = "";
    this.render();
  }

  /**
   * Durée proposée. En modification : la durée actuelle de la case. Pour
   * compléter : ce qui manque au jour, sans dépasser la réserve de la tâche,
   * en blocs de son type ; une tâche hors réserve — la réunion qu'on pose pour
   * boucler la journée — prend le manque, arrondi au bloc.
   */
  #suggest() {
    const input = this.add.querySelector("[data-ts-min]");
    const day = this.#day(this.adding?.key);
    if (!input || !day) return;
    const id = this.adding.taskId;
    const step = this.app.timesheet.stepFor(id);
    input.step = step;
    if (this.adding.mode === "edit") {
      input.value = day.lines.find((l) => l.taskId === id)?.min ?? 0;
      return;
    }
    input.min = step;
    const inRes = this.week.reserve.find((r) => r.taskId === id)?.min ?? 0;
    let min = day.gap > 0 ? day.gap : step;
    if (inRes > 0) min = Math.min(min, inRes);
    input.value = this.#snap(min, step);
    this.add.querySelector(".prec-sep").textContent = `min · blocs de ${step}`;
  }

  /** Une durée ramenée au bloc de sa tâche (au plus proche, un bloc au minimum). */
  #snap(min, step) {
    return Math.max(step, Math.round(min / step) * step);
  }

  #submit() {
    if (!this.adding) return;
    const editing = this.adding.mode === "edit";
    const taskId = editing ? this.adding.taskId : this.add.querySelector("[data-ts-task]")?.value;
    const raw = Math.round(Number(this.add.querySelector("[data-ts-min]")?.value));
    if (!taskId || !Number.isFinite(raw) || raw < 0 || (!editing && raw === 0)) {
      this.app.toast.show("Choisissez une tâche et une durée");
      return;
    }
    // Par blocs, toujours : une saisie hors bloc est ramenée au plus proche
    // (en modification, 0 reste 0 — il retire la ligne).
    const step = this.app.timesheet.stepFor(taskId);
    const min = editing && raw === 0 ? 0 : this.#snap(raw, step);
    if (min !== raw) this.app.toast.show(`Ramené à ${this.app.formatter.clock(min)} (blocs de ${step} min)`);
    const key = this.adding.key;
    this.adding = null;
    this.add.innerHTML = ""; // rend le focus : la garde ne retient plus le rendu
    this.#edit(key, (l) => (editing ? setLine(l, taskId, min) : addToLine(l, taskId, min)));
  }

  /** Une réserve cliquée : sur le premier jour à compléter (ou aujourd'hui). */
  #placeReserve(taskId) {
    const days = this.week.days.filter((d) => d.visible && !d.future && d.worked);
    const target = days.find((d) => d.gap > 0) ?? days.find((d) => d.today) ?? days.at(-1);
    if (!target) { this.app.toast.show("Aucun jour à compléter cette semaine"); return; }
    this.#openAdd(target.key, taskId);
  }

  /* ------------------------------ pied ------------------------------ */
  #renderFoot(week) {
    const c = (m) => this.app.formatter.clock(m);
    const t = week.totals;
    const ended = !week.current && week.days.every((d) => !d.future);
    let text;
    if (!t.reserve) text = "Réserve vide : aucun bloc en attente.";
    else if (ended) text = `${c(t.reserve)} pointées mais jamais déclarées cette semaine — la réserve repart de zéro chaque lundi.`;
    else text = `Réserve : ${c(t.reserve)} pointées qui n’ont pas encore de jour. Cliquez un temps de la colonne Réserve pour le poser, ou un manque hachuré pour compléter un jour.`;
    this.foot.textContent = text;
  }

  /* ------------------------------ outils ------------------------------ */
  #day(key) {
    return this.week?.days.find((d) => d.key === key) ?? null;
  }

  /** Retouche un jour : part de ses lignes affichées, et le fige. */
  #edit(key, fn) {
    const day = this.#day(key);
    if (!day) return;
    this.app.store.setTimesheetDay(key, fn(day.lines.map((l) => ({ ...l }))));
  }
}
