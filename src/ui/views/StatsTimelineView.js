import { el, createEl } from "../../utils/dom.js";
import { DAY_MS } from "../../core/constants.js";
import { startOfDay, isoDow, sameDay, fmtClock, fmtDateInput, cap, toMin } from "../../utils/datetime.js";
import { workedParts } from "../../utils/intervals.js";
import { attachTimelineTip } from "../components/TimelineTip.js";

/**
 * Timeline d'historique réutilisant le langage visuel de l'onglet Journée
 * (blocs `.tl-seg` colorés + infobulle maison), à deux échelles :
 *   - Mois : une ligne par jour, axe horaire **partagé** → on voit la journée
 *     type et les tâches « avancer » d'un jour à l'autre ;
 *   - Année : une ligne par mois, l'activité étalée sur les jours du mois.
 * Un bloc cliqué ouvre son jour dans l'onglet Segments.
 */
export class StatsTimelineView {
  constructor(app) {
    this.app = app;
    this.el = el("statsTimeline");
    this.anchor = this.el;
    this.label = el("stLabel");
    this.scale = "month";
    this.refDate = startOfDay(new Date()); // mois / année affiché
    // Infobulle partagée, montée dans le conteneur re-rendu : chaque rendu la
    // détruit avec son contenu et doit la remonter (`this.tip.mount()`).
    this.tip = attachTimelineTip(this.el);
  }

  bind() {
    const scaleGroup = el("stScale");
    scaleGroup.addEventListener("click", (e) => {
      const b = e.target.closest("[data-scale]");
      if (!b) return;
      this.scale = b.dataset.scale;
      [...scaleGroup.children].forEach((c) => c.classList.toggle("active", c === b));
      this.render();
    });
    el("stPrev").addEventListener("click", () => this.#shift(-1));
    el("stNext").addEventListener("click", () => this.#shift(1));
    el("stNow").addEventListener("click", () => { this.refDate = startOfDay(new Date()); this.render(); });
    this.el.addEventListener("click", (e) => {
      const seg = e.target.closest(".tl-seg[data-day]");
      if (seg) this.app.goToDaySegments(seg.dataset.day);
    });
  }

  #shift(n) {
    const d = new Date(this.refDate);
    if (this.scale === "year") d.setFullYear(d.getFullYear() + n);
    else d.setMonth(d.getMonth() + n);
    this.refDate = startOfDay(d);
    this.render();
  }

  render() {
    this.scale === "year" ? this.#renderYear() : this.#renderMonth();
  }

  /* ----------------- vue Mois (1 ligne / jour, axe horaire partagé) ----------------- */
  #renderMonth() {
    const { store, calc, formatter } = this.app;
    const settings = store.settings;
    const y = this.refDate.getFullYear(), m = this.refDate.getMonth();
    this.label.textContent = cap(this.refDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }));
    const days = new Date(y, m + 1, 0).getDate();

    // Segments du mois en un seul balayage, puis répartis par jour. daySegs[d]
    // est strictement égal à store.segmentsForDay(jour d) (même critère, même
    // DAY_MS fixe) → on évite de rebalayer tout l'historique 2× par jour.
    const monthStart = new Date(y, m, 1).getTime();
    const monthEnd = new Date(y, m + 1, 1).getTime();
    const monthSegs = store.segments.filter((s) => s.startMs() < monthEnd && s.endMs() > monthStart);
    const dayStartMs = [];
    const daySegs = [];
    for (let d = 1; d <= days; d++) {
      const ds = new Date(y, m, d).getTime(); // minuit local (== startOfDay)
      const de = ds + DAY_MS;
      dayStartMs[d] = ds;
      daySegs[d] = monthSegs.filter((s) => s.startMs() < de && s.endMs() > ds);
    }

    // Fenêtre horaire commune (minutes) : horaires de base, élargie par les
    // plannings du mois et par tout segment qui déborde.
    let winS = toMin(settings.arrival), winE = toMin(settings.departure);
    for (let d = 1; d <= days; d++) {
      const day = new Date(y, m, d);
      for (const [a, b] of settings.blocksFor(day)) { winS = Math.min(winS, toMin(a)); winE = Math.max(winE, toMin(b)); }
      const ds = dayStartMs[d];
      for (const seg of daySegs[d]) {
        winS = Math.min(winS, Math.floor((Math.max(seg.startMs(), ds) - ds) / 60000));
        winE = Math.max(winE, Math.ceil((Math.min(seg.endMs(), ds + DAY_MS) - ds) / 60000));
      }
    }
    winS = Math.max(0, Math.min(winS, 1440));
    winE = Math.min(1440, Math.max(winE, winS + 60));

    this.el.classList.remove("year");
    this.el.innerHTML = "";
    this.el.appendChild(this.#axis(winS, winE));

    const today = new Date();
    for (let d = 1; d <= days; d++) {
      const day = new Date(y, m, d);
      const ds = dayStartMs[d];
      const winStart = ds + winS * 60000, winEnd = ds + winE * 60000;
      const isToday = sameDay(day, today);
      const row = createEl("div", { className: "st-row" + (isoDow(day) >= 6 ? " weekend" : "") + (isToday ? " today" : "") });
      row.appendChild(createEl("span", {
        className: "st-row-label",
        text: `${d} ${day.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "")}`,
      }));
      const win = winEnd - winStart;
      const pct = (t) => (t - winStart) / win * 100;
      const ranges = calc.workRangesForDay(day);
      const track = createEl("div", { className: "st-track" });
      // fonds non travaillés (pause midi, avant/après horaires) — moins visibles
      for (const [from, to, counted] of workedParts(winStart, winEnd, ranges)) {
        if (!counted) track.appendChild(createEl("div", { className: "tl-lunch", attrs: { style: `left:${pct(from)}%;width:${pct(to) - pct(from)}%` } }));
      }
      const key = fmtDateInput(day);
      for (const seg of daySegs[d]) {
        const s = Math.max(seg.startMs(), winStart), e = Math.min(seg.endMs(), winEnd);
        if (e <= s) continue;
        const task = store.taskById(seg.taskId);
        const color = task ? task.color : "var(--text-faint)";
        const data = {
          name: task ? task.displayName : "?",
          range: `${fmtClock(new Date(s))}–${fmtClock(new Date(e))}`,
          dur: formatter.clock(calc.segmentMs(seg, winStart, winEnd) / 60000),
          color, key,
        };
        const parts = seg.raw ? [[s, e, true]] : workedParts(s, e, ranges);
        parts.forEach(([from, to, counted], i) => {
          const edge = parts.length === 1 ? "" : i === 0 ? "seg-l" : i === parts.length - 1 ? "seg-r" : "seg-mid";
          track.appendChild(this.#part(pct(from), pct(to), counted, data, edge));
        });
      }
      const now = Date.now();
      if (isToday && now >= winStart && now <= winEnd) {
        const nl = createEl("div", { className: "tl-now" });
        nl.style.left = pct(now) + "%";
        track.appendChild(nl);
      }
      row.appendChild(track);
      this.el.appendChild(row);
    }
    this.tip.mount();
  }

  #axis(winS, winE) {
    const axis = createEl("div", { className: "st-axis" });
    const span = winE - winS;
    const step = span > 600 ? 2 : 1; // toutes les 2 h si large fenêtre
    for (let h = Math.ceil(winS / 60); h * 60 <= winE; h += step) {
      const tick = createEl("span", { className: "st-tick", text: h + "h" });
      tick.style.left = ((h * 60 - winS) / span * 100) + "%";
      axis.appendChild(tick);
    }
    return axis;
  }

  /* ----------------- vue Année (1 ligne / mois) ----------------- */
  #renderYear() {
    const { store } = this.app;
    const y = this.refDate.getFullYear();
    this.label.textContent = String(y);
    this.el.classList.add("year");
    this.el.innerHTML = "";

    // Pré-filtre les segments de l'année (un balayage) : les 12 lignes de mois
    // n'itèrent plus que ce sous-ensemble au lieu de tout l'historique × 12.
    const yearStart = new Date(y, 0, 1).getTime();
    const yearEnd = new Date(y + 1, 0, 1).getTime();
    const yearSegs = store.segments.filter((s) => s.startMs() < yearEnd && s.endMs() > yearStart);

    const today = new Date();
    const shortDate = (d) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    for (let m = 0; m < 12; m++) {
      const monthStart = new Date(y, m, 1).getTime();
      const monthEnd = new Date(y, m + 1, 1).getTime();
      const isCur = today.getFullYear() === y && today.getMonth() === m;
      const row = createEl("div", { className: "st-row" + (isCur ? " today" : "") });
      row.appendChild(createEl("span", {
        className: "st-row-label",
        text: cap(new Date(y, m, 1).toLocaleDateString("fr-FR", { month: "long" })),
      }));
      const track = createEl("div", { className: "st-track" });
      for (const seg of yearSegs) {
        if (seg.startMs() >= monthEnd || seg.endMs() <= monthStart) continue;
        const dayKey = fmtDateInput(new Date(Math.max(seg.startMs(), monthStart)));
        const blk = this.#block(seg, monthStart, monthEnd, dayKey,
          (s, e) => `${shortDate(new Date(s))} ${fmtClock(new Date(s))} – ${shortDate(new Date(e))} ${fmtClock(new Date(e))}`);
        if (blk) track.appendChild(blk);
      }
      row.appendChild(track);
      this.el.appendChild(row);
    }
    this.tip.mount();
  }

  /** Morceau de segment (vue Mois) : `counted=false` ⇒ estompé (hors horaires). */
  #part(left, right, counted, data, edge) {
    return createEl("div", {
      className: "tl-seg" + (counted ? "" : " uncounted") + (edge ? " " + edge : ""),
      attrs: {
        style: `left:${left}%;width:${Math.max(0.6, right - left)}%;background:${data.color}`,
        "data-name": data.name, "data-range": data.range, "data-dur": data.dur,
        "data-color": data.color, "data-day": data.key,
      },
    });
  }

  /** Bloc positionné (couleur de tâche) borné à [winStart, winEnd]. */
  #block(seg, winStart, winEnd, dayKey, rangeText) {
    const { store, calc, formatter } = this.app;
    const s = Math.max(seg.startMs(), winStart), e = Math.min(seg.endMs(), winEnd);
    if (e <= s) return null;
    const span = winEnd - winStart;
    const task = store.taskById(seg.taskId);
    const color = task ? task.color : "var(--text-faint)";
    return createEl("div", {
      className: "tl-seg",
      attrs: {
        style: `left:${(s - winStart) / span * 100}%;width:${Math.max(0.6, (e - s) / span * 100)}%;background:${color}`,
        "data-name": task ? task.displayName : "?",
        "data-range": rangeText(s, e),
        "data-dur": formatter.clock(calc.segmentMs(seg, winStart, winEnd) / 60000),
        "data-color": color,
        "data-day": dayKey,
      },
    });
  }

}
