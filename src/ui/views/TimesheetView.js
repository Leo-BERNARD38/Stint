import { el, escapeHtml, createEl } from "../../utils/dom.js";
import { icon } from "../icons.js";
import { toggleLine, setAllDone, addToLine, setLine, releaseLine } from "../../models/TimesheetLines.js";
import { linkButtonHtml, editButtonHtml } from "../components/TaskActions.js";
import { taskPickerHtml, bindTaskPicker, pickedTask, pickerTask, pickerTasks } from "../components/TaskPicker.js";

const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const DAY_LONG = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const MAX_MIN = 720; // une case ne déclare jamais plus de 12 h

/**
 * Onglet **Saisie** (§17) : ce qu'on DÉCLARE dans Jira, semaine par semaine.
 *
 * Un sélecteur de semaine (la grammaire du sélecteur de jour), une tête (le
 * déclaré, la barre saisi · à saisir · à compléter), puis une FEUILLE : une ligne
 * par tâche, une colonne par jour, et la réserve de la tâche en dernière
 * colonne. Des cartes par jour avaient été essayées d'abord : à cinq de front,
 * le nom de la tâche — qui porte la clé Jira, c'est-à-dire LA donnée à
 * recopier — tombait en « MOD-… ». Et la ligne répond à la question qu'on se
 * pose dans Jira, ticket ouvert : « qu'est-ce que je loggue sur celui-ci, et
 * quel jour ? ».
 *
 * Tout se lit dans `app.timesheetWeek()` ; la vue ne calcule rien. Un geste
 * transforme les cases FIXÉES du jour par une fonction pure de `TimesheetLines`
 * (qui lit les lignes affichées pour la durée d'une case proposée) et les
 * confie au Store. Seule la case touchée se fixe : le reste du jour continue de
 * suivre le pointage. Une case fixée à la main porte une punaise.
 *
 * Un POPOVER ancré à ce qu'on a cliqué — même carte que celle qui comble un trou
 * de la timeline — a deux emplois : COMPLÉTER un jour (clic sur un manque :
 * choisir une tâche et une durée) et MODIFIER une case (clic sur sa durée :
 * combien de cette tâche on déclare ce jour-là — c'est ainsi qu'entre deux
 * tâches qui débordent, on en privilégie une). Durées par blocs du type,
 * toujours. Il était d'abord un formulaire posé SOUS la feuille : on cliquait
 * une case en haut, on répondait en bas, et sur une semaine chargée il
 * s'ouvrait hors de l'écran. Monté une fois hors du tableau, il survit aux
 * re-rendus (le chrono re-rend toutes les 15 s) sans voler la saisie en cours.
 */
export class TimesheetView {
  constructor(app) {
    this.app = app;
    this.lead = el("tsLead");
    this.table = el("tsTable");
    this.foot = el("tsFoot");
    this.anchor = this.table;
    this.adding = null; // { key, taskId, mode: "add"|"edit" } : le popover ouvert, s'il y en a un
    const sheet = el("tsSheet");
    this.backdrop = createEl("div", { className: "fill-backdrop" });
    this.pop = createEl("div", { className: "fill-pop ts-pop" });
    this.pop.setAttribute("role", "dialog");
    sheet.append(this.backdrop, this.pop);
    this.onDocDown = null;
  }

  bind() {
    el("tsPrev").addEventListener("click", () => { this.#closePop(); this.app.shiftTimesheetWeek(-1); });
    el("tsNext").addEventListener("click", () => { this.#closePop(); this.app.shiftTimesheetWeek(1); });
    el("tsNow").addEventListener("click", () => { this.#closePop(); this.app.timesheetToday(); });

    this.table.addEventListener("change", (e) => {
      const box = e.target.closest("[data-ts-check]");
      if (!box) return;
      // Le rendu reconstruit la feuille : on rend le focus à la même case.
      // (Échappé : un identifiant importé peut contenir n'importe quoi, et un
      // sélecteur invalide ferait lever `querySelector` au milieu du rendu.)
      this.refocus = `[data-ts-check="${CSS.escape(box.dataset.tsCheck)}"][data-day="${CSS.escape(box.dataset.day)}"]`;
      this.#edit(box.dataset.day, (p, shown) => toggleLine(p, shown, box.dataset.tsCheck));
    });
    this.table.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      const key = b.dataset.day;
      switch (b.dataset.act) {
        case "all": {
          const day = this.#day(key);
          const all = day.lines.length > 0 && day.lines.every((l) => l.done);
          this.#edit(key, (p, shown) => setAllDone(p, shown, !all));
          break;
        }
        case "task": this.app.openEditTask(b.dataset.task); break;
        case "copy": {
          // Le retour de `app.copy` (« ✓ Copié ») élargirait le bouton, donc la
          // colonne, et toute la feuille bougerait sous le curseur. Ici le
          // bouton garde son texte et passe à l'aplat un instant ; le toast dit
          // ce qui a été copié.
          this.app.copy(b.dataset.value);
          b.classList.add("copied");
          setTimeout(() => b.classList.remove("copied"), 1100);
          break;
        }
        case "recalc": this.app.recalcTimesheetDay(key); break;
        case "open": this.#openPop(b, key); break;
        case "edit": this.#openPop(b, key, b.dataset.task, "edit"); break;
        case "res": this.#placeReserve(b, b.dataset.task); break;
      }
    });

    bindTaskPicker(this.pop, {
      onSelect: (id) => { if (this.adding) { this.adding.taskId = id; this.#suggest(); } },
    });
    this.pop.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      switch (b.dataset.act) {
        case "close": this.#closePop(true); break;
        case "copy": this.app.copy(b.dataset.value, b); break;
        case "dec": this.#bump(-1); break;
        case "inc": this.#bump(1); break;
        case "remove": this.#submit(0); break;
        case "release": this.#release(); break;
        case "submit": this.#submit(); break;
      }
    });
    this.pop.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.stopPropagation(); this.#closePop(true); return; }
      if (e.key === "Enter" && e.target.matches("input, select")) { e.preventDefault(); this.#submit(); return; }
      if (e.target.matches("[data-ts-min]") && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        this.#bump(e.key === "ArrowUp" ? 1 : -1);
      }
    });
    // − et + ne prennent pas le focus : il reste dans le champ, et Entrée
    // valide juste après un clic sur l'un d'eux.
    this.pop.addEventListener("pointerdown", (e) => {
      if (e.target.closest('[data-act="dec"], [data-act="inc"]')) e.preventDefault();
    });
    // La durée tapée à la main se relit au blur, dans la grammaire commune
    // (`Formatter.parse` : « 1:30 », « 1h30 », « 1.5 » = heures).
    this.pop.addEventListener("focusout", (e) => {
      if (!this.adding || !e.target.matches("[data-ts-min]")) return;
      const min = this.app.formatter.parse(e.target.value);
      if (min != null) this.#setMin(min);
    });
  }

  render() {
    const week = this.app.timesheetWeek();
    this.week = week;
    // Un popover ouvert sur un jour qui n'est plus dans la semaine affichée
    // (flèches du clavier) n'a plus de sens.
    if (this.adding && !this.#day(this.adding.key)) this.#closePop();
    el("tsLabel").textContent = `${week.label} · ${week.sub}`;
    // Sur la semaine en cours, « Aujourd'hui » recule (cf. `#dayToday`), et
    // « suivante » s'éteint : une semaine à venir ne propose rien (§17).
    el("tsNow").classList.toggle("is-today", week.current);
    el("tsNext").disabled = week.current;
    el("tsRule").textContent = this.#rule(week);
    this.#renderLead(week);
    this.#renderTable(week);
    this.#renderFoot(week);
    if (this.refocus) { this.table.querySelector(this.refocus)?.focus(); this.refocus = null; }
  }

  /* ------------------------------ tête ------------------------------ */
  /** Le contrat de la semaine, à droite du sélecteur — comme les horaires du jour. */
  #rule(week) {
    const st = this.app.store.settings.timesheet.steps;
    const c = (m) => this.app.formatter.clock(m);
    return `cible ${week.workedDays} j × ${c(this.app.timesheet.dayTarget())} · blocs : dev ${st.dev} min, support ${st.support}, autre ${st.autre}`;
  }

  #renderLead(week) {
    const c = (m) => this.app.formatter.clock(m);
    const t = week.totals;
    const pending = t.declared - t.done;
    // Les jours à venir ne sont pas un manque : la fin de piste reste vide et
    // se dit « à venir », au lieu de grossir les hachures de ce qu'on ne peut
    // pas encore compléter.
    const legend = [
      `${c(t.done)} saisies`,
      pending > 0 ? `${c(pending)} à saisir` : "",
      t.gap > 0 ? `${c(t.gap)} à compléter` : "",
      t.upcoming > 0 ? `${c(t.upcoming)} à venir` : "",
    ].filter(Boolean).join(" · ");
    this.lead.innerHTML =
      '<div class="ts-lead">' +
        '<div class="ts-lead-l">' +
          '<span class="k">Déclaré cette semaine</span>' +
          `<span class="v">${c(t.declared)}<small>/ ${c(t.target)}</small></span>` +
        "</div>" +
        // Les deux autres grandeurs de la semaine, au format des totaux : un
        // libellé en capitales, un chiffre. Le pointé dit d'où vient le déclaré,
        // la réserve ce qui attend encore un jour.
        '<dl class="ts-kpis">' +
          `<div><dt>Pointé arrondi</dt><dd>${c(t.real)}</dd></div>` +
          `<div><dt>En réserve</dt><dd>${c(t.reserve)}</dd></div>` +
        "</dl>" +
      "</div>" +
      // La barre sous le chiffre, pleine largeur : la couverture des Stats.
      '<div class="coverage ts-cover">' +
        this.#bar(t.target, t.declared, t.done, t.gap, "ts-track", legend) +
        `<div class="cov-lab"><span>${escapeHtml(legend)}</span><span>cible ${c(t.target)}</span></div>` +
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
    const cls = "ts-dcol" + (d.today ? " is-today" : "") + (off ? " is-off" : "");
    const actions = off || (d.future && !d.lines.length) ? "" :
      '<span class="ts-dact">' +
        (d.touched ? `<button class="mini-btn icon-only" data-act="recalc" data-day="${key}" title="Tout recalculer : oublier les cases fixées de ce jour" aria-label="Tout recalculer le ${long}">${icon("rotate-ccw", { size: 15 })}</button>` : "") +
        (d.lines.length ? `<button class="mini-btn icon-only ts-all${all ? " on" : ""}" data-act="all" data-day="${key}" aria-pressed="${all}" title="${all ? "Tout décocher" : "Tout cocher : le jour est saisi"}" aria-label="${all ? "Tout décocher" : "Tout cocher"} le ${long}">${icon("check", { size: 15 })}</button>` : "") +
      "</span>";
    // « Aujourd'hui » est le repère « maintenant » de la feuille : le tampon,
    // comme le filet de la timeline (§7, N1).
    const sub = d.today ? '<span class="ts-now">aujourd’hui</span>' : state;
    // Un jour à venir n'a encore rien de déclaré ni de pointé : une barre vide
    // et deux zéros ne disent rien de plus que sa cible.
    const idle = d.future && !d.lines.length;
    return `<th class="${cls}" scope="col">` +
      `<span class="ts-dh"><span class="ts-dn">${DAY_NAMES[d.dow - 1]} ${d.date.getDate()}</span>${actions}</span>` +
      `<span class="ts-dsub">${sub || " "}</span>` +
      (off ? "" : idle
        ? `<span class="ts-dt ts-dt-idle">cible ${c(d.target)}</span>`
        : `<span class="ts-dt"><b>${c(d.declared)}</b>/ ${c(d.target)}</span>` +
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
      const open = this.adding?.mode === "edit" && this.adding.key === d.key && this.adding.taskId === taskId;
      // Fixée à la main (et pas encore saisie) : la punaise dit qu'elle ne suit
      // plus le pointage. Une case cochée le dit déjà par sa coche.
      const pinned = l.pinned && !l.done;
      const state = l.done ? "saisie" : pinned ? "fixée" : "proposée";
      // Une case : la copie Jira (révélée au survol), la coche, la durée. La
      // saisie du soir se fait en DEUX clics — copier ici, puis ouvrir le lien
      // au bout de la ligne. Le reste (décimal, durée, retirer) est dans le
      // popover que la durée ouvre.
      const jira = escapeHtml(formatter.jira(l.min));
      return `<td class="ts-cell${l.done ? " done" : ""}${pinned ? " is-pinned" : ""}${open ? " is-open" : ""}"><span class="ts-c">` +
        `<button class="mini-btn ts-copy" data-act="copy" data-value="${jira}" title="Copier « ${jira} »" aria-label="Copier ${jira} (${name}, ${DAY_LONG[d.dow - 1]})">${icon("copy", { size: 14 })} Jira</button>` +
        `<input type="checkbox" data-ts-check="${id}" data-day="${key}"${l.done ? " checked" : ""} aria-label="${name}, ${DAY_LONG[d.dow - 1]} : saisi dans Jira">` +
        `<button class="ts-dur" data-act="edit" data-day="${key}" data-task="${id}" title="${pinned ? "Fixée à la main — " : l.done ? "" : "Proposée : suit le pointage — "}copier, modifier ou retirer" aria-label="${name}, ${DAY_LONG[d.dow - 1]} : ${formatter.clock(l.min)}, ${state} — copier, modifier">` +
          (pinned ? `<span class="ts-pin" aria-hidden="true">${icon("pin", { size: 11 })}</span>` : "") +
          `${formatter.clock(l.min)}</button>` +
        "</span></td>";
    }).join("");
    // La réserve de la tâche, en blocs entiers de son type (cf. `Timesheet.week`).
    const resOpen = this.adding?.from === "res" && this.adding.taskId === taskId ? " is-open" : "";
    const resCell = reserveMin > 0
      ? `<button class="ts-res${resOpen}" data-act="res" data-task="${id}" title="Pointé qui dépasse la cible des jours : cliquez pour le poser sur un jour à compléter">${formatter.clock(reserveMin)}</button>`
      : "";
    // Les actions de la TÂCHE (lien, édition) : celles des lignes de Journée,
    // mêmes boutons, révélées au survol de la ligne — à leur place, rien ne bouge.
    return `<tr><th class="ts-tk" scope="row"><span class="ts-tkw">` +
        `<span class="ts-name" title="${name}"><i class="o-dot" style="background:${escapeHtml(t.color)}"></i><span class="ts-nt">${name}</span></span>` +
        '<span class="ts-tacts">' +
          (t.link ? linkButtonHtml(t.link) : "") +
          editButtonHtml(t, `data-act="task" data-task="${id}"`) +
        "</span>" +
      "</span></th>" + cells + `<td class="ts-rcell">${resCell}</td></tr>`;
  }

  #gapCell(d) {
    if (d.future || (!d.worked && !d.lines.length)) return "";
    const key = escapeHtml(d.key);
    const long = DAY_LONG[d.dow - 1];
    const open = this.adding?.from === "gap" && this.adding.key === d.key ? " is-open" : "";
    if (d.gap > 0) {
      // Aujourd'hui, le manque n'est pas une faute : la journée continue, et
      // ce qu'on pointe d'ici ce soir viendra le remplir de lui-même.
      const title = d.today ? `Il manque ${this.app.formatter.clock(d.gap)} pour l’instant : ce que vous pointez d’ici ce soir le remplira. Cliquez pour compléter à la main.` : `Compléter le ${long}`;
      return `<button class="ts-gap${open}" data-act="open" data-day="${key}" title="${title}">` +
        `${this.app.formatter.clock(d.gap)}</button>`;
    }
    return `<button class="mini-btn icon-only ts-more${open}" data-act="open" data-day="${key}" title="Ajouter une ligne au ${long}" aria-label="Ajouter une ligne au ${long}">${icon("plus", { size: 15 })}</button>`;
  }

  /* ------------------ popover : compléter / modifier ------------------ */
  /**
   * Ouvre le popover sous `anchor` : compléter le jour `key` (mode « add »), ou
   * modifier la case de `taskId` ce jour-là (mode « edit »). `from` retient ce
   * qui l'a ouvert, pour le marquer (lavis + anneau) tant qu'il est ouvert.
   */
  #openPop(anchor, key, taskId = null, mode = "add", from = mode === "edit" ? "cell" : "gap") {
    const { store } = this.app;
    const first = this.week.reserve[0]?.taskId ?? store.openTasks()[0]?.id ?? store.tasks[0]?.id;
    if (!taskId && !first) { this.app.toast.show("Aucune tâche à déclarer", { kind: "info" }); return; }
    this.#closePop();
    this.adding = { key, taskId: taskId ?? first, mode, from };
    // Le focus revient à l'ouvreur à la fermeture — retrouvé après re-rendu.
    this.opener = anchor.dataset.act === "res"
      ? `[data-act="res"][data-task="${CSS.escape(anchor.dataset.task)}"]`
      : `[data-act="${anchor.dataset.act}"][data-day="${CSS.escape(key)}"]` +
        (anchor.dataset.task ? `[data-task="${CSS.escape(anchor.dataset.task)}"]` : "");
    this.#renderPop();
    this.pop.classList.add("show");
    this.backdrop.classList.add("show");
    this.#position(anchor);
    this.render(); // marque l'ouvreur
    const input = this.pop.querySelector("[data-ts-min]");
    input?.focus();
    input?.select();
    // Clic hors du popover → fermeture (posé au tick suivant pour ne pas capter
    // le clic d'ouverture lui-même). Même règle que le popover de la timeline.
    this.onDocDown = (e) => { if (!this.pop.contains(e.target)) this.#closePop(); };
    setTimeout(() => { if (this.onDocDown) document.addEventListener("pointerdown", this.onDocDown, true); }, 0);
  }

  /** Ferme le popover ; `refocus` rend le focus à ce qui l'avait ouvert (clavier). */
  #closePop(refocus = false) {
    if (this.onDocDown) { document.removeEventListener("pointerdown", this.onDocDown, true); this.onDocDown = null; }
    const was = this.adding;
    this.adding = null;
    this.pop.classList.remove("show");
    this.backdrop.classList.remove("show");
    this.pop.innerHTML = "";
    if (!was) return;
    // Pas de re-rendu ici : fermé par un `pointerdown` hors de la carte, un
    // tableau reconstruit sous le pointeur avalerait le clic qui suit — celui
    // qui ouvre justement une autre case. On retire les marques à la main.
    this.table.querySelectorAll(".is-open").forEach((n) => n.classList.remove("is-open"));
    if (refocus && this.opener) this.table.querySelector(this.opener)?.focus();
  }

  /**
   * Cale la carte sous ce qu'on a cliqué, centrée dessus et bornée aux bords de
   * la feuille ; au-dessus s'il n'y a pas la place en dessous. Sur téléphone, la
   * feuille de style en fait une feuille basse (même règle que `.fill-pop`).
   */
  #position(anchor) {
    const pop = this.pop;
    if (window.matchMedia("(max-width: 760px)").matches) { pop.style.left = ""; pop.style.top = ""; return; }
    const host = pop.offsetParent ?? pop.parentElement;
    const h = host.getBoundingClientRect();
    const a = anchor.getBoundingClientRect();
    const MARGIN = 8;
    const half = pop.offsetWidth / 2; // le CSS centre la carte via translateX(-50%)
    const center = a.left + a.width / 2 - h.left;
    pop.style.left = Math.max(half + MARGIN, Math.min(host.clientWidth - half - MARGIN, center)) + "px";
    const below = a.bottom - h.top + 6;
    const above = a.top - h.top - pop.offsetHeight - 6;
    const fits = a.bottom + 6 + pop.offsetHeight <= window.innerHeight;
    pop.style.top = (fits || above < 0 ? below : above) + "px";
  }

  #renderPop() {
    const d = this.#day(this.adding?.key);
    if (!d) return;
    const { store, formatter } = this.app;
    const editing = this.adding.mode === "edit";
    const day = `${DAY_LONG[d.dow - 1]} ${d.date.getDate()}`;
    let picker;
    if (editing) {
      // Modifier une case : la tâche est donnée, seule la durée change.
      // La case ouverte : sa tâche (et son lien, pour aller logguer), puis la
      // copie de la durée DÉCLARÉE, en décimal ou au format Jira — les deux
      // boutons de Journée, avec la valeur qu'ils copient sous les yeux.
      const t = store.taskById(this.adding.taskId);
      const line = d.lines.find((l) => l.taskId === this.adding.taskId);
      const cur = line?.min ?? 0;
      const copy = (label, value) =>
        `<button class="mini-btn" data-act="copy" data-value="${escapeHtml(value)}" title="Copier « ${escapeHtml(value)} »">` +
          `${icon("copy", { size: 14 })} ${label} <b>${escapeHtml(value)}</b></button>`;
      picker = '<div class="ts-pop-head">' +
          `<span class="ts-pop-task"><i class="o-dot" style="background:${escapeHtml(t?.color ?? "")}"></i>` +
          `<span>${escapeHtml(t?.displayName ?? "")}</span></span>` +
          (t?.link ? linkButtonHtml(t.link) : "") +
        "</div>" +
        '<div class="ts-pop-copy">' + copy("Déc.", formatter.decimal(cur)) + copy("Jira", formatter.jira(cur)) + "</div>" +
        // D'où vient la durée : proposée (elle suit le pointage) ou fixée.
        `<p class="ts-pop-note">${line?.done ? "Cochée « saisie » : sa durée ne bouge plus."
          : line?.pinned ? "Fixée à la main : elle ne suit plus le pointage."
          : "Proposée : elle suit le pointage tant que vous ne la changez pas."}</p>`;
    } else {
      // Le sélecteur commun (cf. `TaskPicker`, celui de la timeline) : la
      // réserve d'abord — c'est elle qu'on vient poser —, puis les tâches en
      // cours, les terminées repliées ; une recherche porte sur toutes.
      const res = new Map(this.week.reserve.map((r) => [r.taskId, r.min]));
      const inRes = this.week.reserve.map((r) => store.taskById(r.taskId)).filter(Boolean);
      const rest = pickerTasks(store, { exclude: new Set(res.keys()) });
      picker = taskPickerHtml({
        groups: [
          { label: "En réserve", tasks: inRes.map((t) => pickerTask(t, formatter.clock(res.get(t.id)))) },
          { label: "En cours", tasks: rest.open },
        ],
        more: rest.done,
        selected: this.adding.taskId,
      });
    }
    this.pop.setAttribute("aria-label", `${editing ? "Modifier" : "Compléter"} le ${day}`);
    this.pop.innerHTML =
      '<div class="fill-head"><span class="fill-dot"></span>' +
        `<span class="fill-kicker">${editing ? "La case" : "Compléter le jour"}</span>` +
        `<button class="fill-x" data-act="close" aria-label="Fermer">${icon("x", { size: 14 })}</button></div>` +
      `<div class="fill-range">${escapeHtml(day.charAt(0).toUpperCase() + day.slice(1))}` +
        (d.gap > 0 ? ` <span class="fill-dur">· il manque ${formatter.clock(d.gap)}</span>` : "") + "</div>" +
      '<div class="ts-pop-body">' +
        picker +
        // La durée en H:mm, comme partout dans l'app, et par blocs : − et +
        // avancent d'un bloc du type de la tâche (les flèches du clavier aussi).
        '<div class="ts-step-row">' +
          `<span class="ts-stepper"><button class="mini-btn icon-only" data-act="dec" aria-label="Un bloc de moins">${icon("minus", { size: 15 })}</button>` +
          '<input class="tinput" data-ts-min inputmode="numeric" autocomplete="off" spellcheck="false" aria-label="Durée déclarée (H:mm)">' +
          `<button class="mini-btn icon-only" data-act="inc" aria-label="Un bloc de plus">${icon("plus", { size: 15 })}</button></span>` +
          '<span class="prec-sep" data-ts-step></span>' +
        "</div>" +
        '<div class="ts-pop-acts">' +
          (editing ? '<button class="btn" data-act="remove" title="Ne pas déclarer cette tâche ce jour-là : son temps attend en réserve">Retirer</button>' : "") +
          (editing && this.#pinnedLine(d, this.adding.taskId) ? '<button class="btn" data-act="release" title="Oublier la durée fixée : la case suit de nouveau le pointage">Recalculer</button>' : "") +
          `<button class="btn primary" data-act="submit">${editing ? "Enregistrer" : "Ajouter"}</button>` +
        "</div>" +
      "</div>";
    this.#suggest();
  }

  /**
   * Durée proposée. En modification : la durée actuelle de la case. Pour
   * compléter : ce qui manque au jour, sans dépasser la réserve de la tâche,
   * en blocs de son type ; une tâche hors réserve — la réunion qu'on pose pour
   * boucler la journée — prend le manque, arrondi au bloc.
   */
  #suggest() {
    const day = this.#day(this.adding?.key);
    if (!day) return;
    const id = this.adding.taskId;
    const step = this.app.timesheet.stepFor(id);
    this.pop.querySelector("[data-ts-step]").textContent = `blocs de ${step} min`;
    if (this.adding.mode === "edit") {
      this.#setMin(day.lines.find((l) => l.taskId === id)?.min ?? 0);
      return;
    }
    const inRes = this.week.reserve.find((r) => r.taskId === id)?.min ?? 0;
    let min = day.gap > 0 ? day.gap : step;
    if (inRes > 0) min = Math.min(min, inRes);
    this.#setMin(this.#snap(min, step));
  }

  /** La durée du popover, en minutes (tenue à jour à côté du champ affiché). */
  #setMin(min) {
    const input = this.pop.querySelector("[data-ts-min]");
    if (!input || !this.adding) return;
    this.adding.min = Math.max(0, Math.min(MAX_MIN, Math.round(min)));
    input.value = this.app.formatter.clock(this.adding.min);
  }

  /** ± un bloc, depuis la durée ramenée au bloc (jamais sous 0, ni sous un bloc pour compléter). */
  #bump(dir) {
    if (!this.adding) return;
    const input = this.pop.querySelector("[data-ts-min]");
    const typed = this.app.formatter.parse(input?.value ?? "");
    const step = this.app.timesheet.stepFor(this.adding.taskId);
    const cur = Math.round((typed ?? this.adding.min ?? 0) / step) * step;
    const floor = this.adding.mode === "edit" ? 0 : step;
    this.#setMin(Math.max(floor, cur + dir * step));
  }

  /** Une durée ramenée au bloc de sa tâche (au plus proche, un bloc au minimum). */
  #snap(min, step) {
    return Math.max(step, Math.round(min / step) * step);
  }

  /** Valide le popover ; `forced` = une durée imposée (0 : « Retirer »). */
  #submit(forced = null) {
    if (!this.adding) return;
    const editing = this.adding.mode === "edit";
    const taskId = editing ? this.adding.taskId : pickedTask(this.pop) ?? this.adding.taskId;
    const typed = this.app.formatter.parse(this.pop.querySelector("[data-ts-min]")?.value ?? "");
    const raw = forced ?? typed;
    if (!taskId || raw == null || (!editing && raw === 0)) {
      this.app.toast.show("Choisissez une tâche et une durée (ex. 1:30)", { kind: "error" });
      return;
    }
    // Par blocs, toujours : une saisie hors bloc est ramenée au plus proche
    // (en modification, 0 reste 0 — il retire la ligne).
    const step = this.app.timesheet.stepFor(taskId);
    const min = editing && raw === 0 ? 0 : this.#snap(Math.min(MAX_MIN, raw), step);
    if (min !== raw) this.app.toast.show(`Ramené à ${this.app.formatter.clock(min)} (blocs de ${step} min)`, { kind: "info" });
    const key = this.adding.key;
    this.refocus = min === 0 ? null : this.opener;
    this.#closePop();
    const apply = () => this.#edit(key, (p, shown) => (editing ? setLine(p, taskId, min) : addToLine(p, shown, taskId, min)));
    // Retirer une case est une suppression : annulable, comme partout (`App.undoable`).
    if (editing && min === 0) this.app.undoable("Case retirée — sa durée retourne en réserve", apply);
    else apply();
  }

  /** Rend la case ouverte à la proposition (popover « Recalculer »). */
  #release() {
    if (!this.adding) return;
    const { key, taskId } = this.adding;
    this.refocus = this.opener;
    this.#closePop();
    this.#edit(key, (p) => releaseLine(p, taskId));
  }

  /** La case d'une tâche ce jour-là est-elle fixée (stockée, et non cochée) ? */
  #pinnedLine(day, taskId) {
    const l = day.lines.find((x) => x.taskId === taskId);
    return !!l?.pinned && !l.done;
  }

  /** Une réserve cliquée : sur le premier jour à compléter (ou aujourd'hui). */
  #placeReserve(anchor, taskId) {
    const days = this.week.days.filter((d) => d.visible && !d.future && d.worked);
    const target = days.find((d) => d.gap > 0) ?? days.find((d) => d.today) ?? days.at(-1);
    if (!target) { this.app.toast.show("Aucun jour à compléter cette semaine", { kind: "info" }); return; }
    this.#openPop(anchor, target.key, taskId, "add", "res");
  }

  /* ------------------------------ pied ------------------------------ */
  #renderFoot(week) {
    const c = (m) => this.app.formatter.clock(m);
    const t = week.totals;
    const ended = !week.current && week.days.every((d) => !d.future);
    let text;
    if (!t.reserve) text = "Réserve vide : aucun bloc en attente.";
    else if (ended) text = `${c(t.reserve)} pointées mais jamais déclarées cette semaine — la réserve repart de zéro chaque lundi.`;
    else text = `Réserve : ${c(t.reserve)} pointées au-delà de la cible des jours, ou retirées d’un jour. Les jours suivants les reprennent d’eux-mêmes ; cliquez un temps de la colonne Réserve pour le poser sur le premier jour à compléter.`;
    this.foot.textContent = text;
  }

  /* ------------------------------ outils ------------------------------ */
  #day(key) {
    return this.week?.days.find((d) => d.key === key) ?? null;
  }

  /**
   * Un geste sur un jour : `fn(cases fixées, lignes affichées)` rend les
   * nouvelles cases fixées. Seule la case touchée se fixe, le reste du jour
   * suit toujours le pointage.
   */
  #edit(key, fn) {
    const day = this.#day(key);
    if (!day) return;
    this.app.store.setTimesheetDay(key, fn(day.pins.map((p) => ({ ...p })), day.lines.map((l) => ({ ...l }))));
  }
}
