import { el, createEl, escapeHtml } from "../../utils/dom.js";
import { CONTINUITY_MAX_DAYS } from "../../services/StatsAggregator.js";
import { TASK_TYPES } from "../../core/constants.js";
import { fmtClock, isoDow, sameDay, toMin } from "../../utils/datetime.js";
import { workedParts } from "../../utils/intervals.js";
import { attachTimelineTip } from "../components/TimelineTip.js";

const HISTORY = 12; // périodes de contexte

/**
 * Bloc « Évolution » : le même sujet vu de loin ou de près, **jamais les deux
 * à la fois**.
 *
 *   - **Volume** — les 12 dernières périodes de même grain, empilées par type,
 *     la période affichée distinguée. C'est ce qui remplace l'ancien sélecteur
 *     de granularité du graphique : le contexte suit la période au lieu d'être
 *     choisi à part, si bien qu'il ne reste **qu'une seule navigation
 *     temporelle** dans tout l'onglet. Avant, on pouvait être en « 4 semaines »
 *     avec une timeline sur un mois de l'an dernier : deux périodes
 *     différentes sur la même page.
 *   - **Continuité** — une ligne par jour, les segments à leur position
 *     horaire. C'est la seule chose que le volume ne dit pas : comment la
 *     journée se tient, et comment une tâche avance d'un jour à l'autre.
 *
 * Commuter au lieu d'empiler n'est pas une économie de place : deux dessins du
 * même temps, l'un sous l'autre, se lisent comme deux mesures différentes.
 */
export class StatsChartView {
  constructor(app) {
    this.app = app;
    this.el = el("statsChart");
    this.anchor = this.el;
    this.modeGroup = el("stChartMode");
    this.hint = el("stChartHint");
    this.mode = "volume";
    // Infobulle partagée, montée dans le conteneur re-rendu : chaque rendu la
    // détruit avec son contenu et doit la remonter (`this.tip.mount()`).
    this.tip = attachTimelineTip(this.el, { selector: ".tl-seg, .vol-col" });
  }

  bind() {
    this.modeGroup.addEventListener("click", (e) => {
      const b = e.target.closest("[data-mode]");
      if (!b || b.disabled || b.dataset.mode === this.mode) return;
      this.mode = b.dataset.mode;
      this.app.render();
    });
    this.el.addEventListener("click", (e) => {
      // Une colonne du graphique EST un raccourci de navigation : c'est la
      // période qu'elle représente, et on n'a pas à la retrouver aux flèches.
      const col = e.target.closest(".vol-col[data-ref]");
      if (col) { this.app.goToStatsPeriod(Number(col.dataset.ref)); return; }
      const seg = e.target.closest(".tl-seg[data-day]");
      if (seg) this.app.goToDaySegments(seg.dataset.day);
    });
  }

  render() {
    const snap = this.app.statsSnapshot();
    const dayCount = snap.days.length;
    // La continuité au-delà de six semaines ferait une ligne par jour sur un
    // mètre — exactement la page à dérouler qu'on vient de supprimer.
    const flowOk = dayCount <= CONTINUITY_MAX_DAYS;
    const mode = flowOk ? this.mode : "volume";
    for (const c of this.modeGroup.children) {
      const isFlow = c.dataset.mode === "flow";
      c.disabled = isFlow && !flowOk;
      c.title = isFlow && !flowOk ? "Disponible sur une semaine ou un mois" : "";
      c.classList.toggle("active", c.dataset.mode === mode);
    }

    this.el.innerHTML = "";
    if (mode === "volume") this.#renderVolume(snap);
    else this.#renderFlow(snap);
    this.tip.mount();
  }

  /* ----------------- Volume : 12 périodes de contexte ----------------- */

  #renderVolume(snap) {
    const { formatter } = this.app;
    const clock = (ms) => formatter.clock(ms / 60000);
    const buckets = snap.history(HISTORY);
    const max = buckets.reduce((m, b) => Math.max(m, b.ms), 0);
    const filled = buckets.filter((b) => b.ms > 0);
    const avg = filled.length ? filled.reduce((a, b) => a + b.ms, 0) / filled.length : 0;

    this.hint.textContent = `${HISTORY} dernières périodes · clic = y aller`;

    if (max <= 0) {
      this.el.appendChild(createEl("div", { className: "empty", text: "Aucun temps tracé sur cette période ni sur les précédentes." }));
      return;
    }

    const wrap = createEl("div", { className: "vol" });
    const plot = createEl("div", { className: "vol-plot" });
    // Deux repères, pas une grille : le plafond et la moyenne. Le plafond donne
    // l'échelle, la moyenne répond à « est-ce que cette période sort du lot ? »
    // — la seule question qu'on se pose devant douze barres.
    plot.appendChild(createEl("div", { className: "vol-rule top", html: `<b>${clock(max)}</b>` }));
    if (avg > 0) {
      plot.appendChild(createEl("div", {
        className: "vol-rule avg",
        attrs: { style: `bottom:${(avg / max) * 100}%` },
        html: `<b>moy. ${clock(avg)}</b>`,
      }));
    }

    const cols = createEl("div", { className: "vol-cols" });
    const labs = createEl("div", { className: "vol-labs" });
    for (const b of buckets) {
      const types = TASK_TYPES.filter((t) => b.byType[t] > 0);
      const fill = types
        .map((t) => `<i class="${t}" style="flex:${b.byType[t]}"></i>`)
        .join("");
      const legend = types.length
        ? types.map((t) => `${t} ${clock(b.byType[t])}`).join(" · ")
        : "rien de tracé";
      cols.appendChild(createEl("div", {
        className: "vol-col" + (b.current ? " is-current" : "") + (b.ms > 0 ? "" : " is-empty"),
        attrs: {
          "data-ref": String(b.refMs),
          "data-name": b.sub,
          "data-range": legend,
          "data-dur": b.ms > 0 ? clock(b.ms) : "",
          "data-color": "",
          title: b.current ? "Période affichée" : "Voir cette période",
        },
        html: `<span class="vol-fill" style="height:${(b.ms / max) * 100}%">${fill}</span>`,
      }));
      labs.appendChild(createEl("span", {
        className: "vol-lab" + (b.current ? " is-current" : ""),
        text: b.label,
      }));
    }
    plot.appendChild(cols);
    wrap.append(plot, labs);
    this.el.appendChild(wrap);
  }

  /* ----------------- Continuité : une ligne par jour ----------------- */

  /**
   * Reprise de l'ancienne timeline mensuelle, **sans sa navigation propre** :
   * elle est désormais bornée par la période de l'onglet, ce qui supprime la
   * seule page de l'app où deux périodes s'affichaient côte à côte.
   */
  #renderFlow(snap) {
    const { store, calc, formatter } = this.app;
    const settings = store.settings;
    const days = snap.days;
    this.hint.textContent = "les tâches dans le temps · clic = ouvrir le jour";

    // Un seul balayage des segments pour toute la période, puis répartition par
    // jour — l'index de l'agrégateur ne les expose pas, et refiltrer
    // `store.segments` jour par jour coûterait un balayage complet par ligne.
    const periodSegs = store.segments.filter(
      (s) => s.startMs() < snap.range.end && s.endMs() > snap.range.start);
    const segsOf = days.map((d) => periodSegs.filter((s) => s.startMs() < d.end && s.endMs() > d.start));

    // Fenêtre horaire COMMUNE à la période : horaires de base, élargie par les
    // plannings et par tout segment qui déborde. Commune, sinon les lignes ne
    // se comparent plus — et c'est tout l'intérêt de les empiler.
    let winS = toMin(settings.arrival), winE = toMin(settings.departure);
    days.forEach((d, i) => {
      for (const [rs, re] of d.ranges) {
        winS = Math.min(winS, Math.floor((rs - d.start) / 60000));
        winE = Math.max(winE, Math.ceil((re - d.start) / 60000));
      }
      for (const seg of segsOf[i]) {
        winS = Math.min(winS, Math.floor((Math.max(seg.startMs(), d.start) - d.start) / 60000));
        winE = Math.max(winE, Math.ceil((Math.min(seg.endMs(), d.end) - d.start) / 60000));
      }
    });
    winS = Math.max(0, Math.min(winS, 1440));
    winE = Math.min(1440, Math.max(winE, winS + 60));

    const wrap = createEl("div", { className: "flow" });
    wrap.appendChild(this.#axis(winS, winE));

    const today = new Date();
    days.forEach((d, i) => {
      const winStart = d.start + winS * 60000, winEnd = d.start + winE * 60000;
      const isToday = sameDay(d.date, today);
      const row = createEl("div", {
        className: "st-row" + (isoDow(d.date) >= 6 ? " weekend" : "") + (isToday ? " today" : ""),
      });
      row.appendChild(createEl("span", {
        className: "st-row-label",
        text: `${d.date.getDate()} ${d.date.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "")}`,
      }));
      const win = winEnd - winStart;
      const pct = (t) => (t - winStart) / win * 100;
      const track = createEl("div", { className: "st-track" });
      // Fonds non travaillés (pause de midi, avant/après horaires).
      for (const [from, to, counted] of workedParts(winStart, winEnd, d.ranges)) {
        if (!counted) {
          track.appendChild(createEl("div", {
            className: "tl-lunch",
            attrs: { style: `left:${pct(from)}%;width:${pct(to) - pct(from)}%` },
          }));
        }
      }
      for (const seg of segsOf[i]) {
        const s = Math.max(seg.startMs(), winStart), e = Math.min(seg.endMs(), winEnd);
        if (e <= s) continue;
        const task = seg.isOff ? null : store.taskById(seg.taskId);
        const color = seg.isOff ? "" : task ? task.color : "var(--text-faint)";
        const data = {
          name: seg.isOff ? seg.reason : task ? task.displayName : "?",
          range: `${fmtClock(new Date(s))}–${fmtClock(new Date(e))}`,
          dur: formatter.clock(calc.segmentMs(seg, winStart, winEnd) / 60000),
          color, key: d.key,
        };
        const parts = seg.raw ? [[s, e, true]] : workedParts(s, e, d.ranges);
        parts.forEach(([from, to, counted], j) => {
          const edge = parts.length === 1 ? "" : j === 0 ? "seg-l" : j === parts.length - 1 ? "seg-r" : "seg-mid";
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
      wrap.appendChild(row);
    });
    this.el.appendChild(wrap);
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

  /** Morceau de segment : `counted=false` ⇒ estompé (hors horaires). */
  #part(left, right, counted, data, edge) {
    return createEl("div", {
      className: "tl-seg" + (data.color ? "" : " off") + (counted ? "" : " uncounted") + (edge ? " " + edge : ""),
      attrs: {
        style: `left:${left}%;width:${Math.max(0.6, right - left)}%` + (data.color ? `;background:${data.color}` : ""),
        "data-name": data.name, "data-range": data.range, "data-dur": data.dur,
        "data-color": data.color, "data-day": data.key,
      },
    });
  }
}
