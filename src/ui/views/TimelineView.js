import { el, createEl, escapeHtml } from "../../utils/dom.js";
import { DAY_MS } from "../../core/constants.js";
import { startOfDay, sameDay, fmtClock, pad2 } from "../../utils/datetime.js";
import { attachTimelineTip } from "../components/TimelineTip.js";
import { onColorClass } from "../../utils/color.js";
import { createFillPopover } from "../components/FillPopover.js";

const SNAP_MS = 300_000; // calage par pas de 5 minutes
const HOUR_MS = 3_600_000;
/* Largeurs minimales d'un bloc pour y écrire quelque chose, en % de la piste.
   En dessous, le texte serait rogné au milieu d'un mot : mieux vaut rien. */
const LABEL_MIN_PCT = 7.5;   // le nom de la tâche
const DUR_MIN_PCT = 12;      // le nom + la durée
const LUNCH_MIN_PCT = 5;     // le mot « déjeuner » sur la bande de pause
// Garde-fou anti-disparition, en pourcentage de la piste. Le VRAI plancher
// est en CSS (`.tl-seg { min-width }`), en pixels : lui seul connaît la largeur
// réelle. Celui-ci ne sert qu'à ne jamais écrire `width:0%`, et doit donc rester
// sous le plancher CSS — à 0,6 % il le dépassait sur toute piste large de plus
// de 500 px, et c'était lui qui épaississait les segments d'une minute.
const SEG_MIN_PCT = 0.15;

/**
 * Timeline journalière : segments colorés **redimensionnables** (poignées sur
 * chaque bord, snap 5 min), **trous cliquables** (popover de remplissage :
 * prolonger gauche/droite ou créer un segment) et repère « maintenant ».
 *
 * Pendant un glisser actif, `render()` est court-circuité (garde-fou
 * anti-reconstruction, cf. CLAUDE.md §10) : le bloc est repositionné à la main,
 * et le changement n'est committé qu'au relâchement (un seul rebuild propre).
 *
 * Composant réutilisable : monté une fois dans « Journée » et une fois dans
 * « Segments » (ids passés en options). `onSegHover`/`onSegClick` permettent le
 * survol croisé et l'édition (modale) côté Segments, sans dupliquer la logique.
 */
export class TimelineView {
  dragging = null;

  constructor(app, { timelineId = "timeline", axisId = "tlAxis", onSegHover = null, onSegClick = null } = {}) {
    this.app = app;
    this.timeline = el(timelineId);
    this.anchor = this.timeline;
    this.axis = el(axisId);
    this.onSegHover = onSegHover;
    this.onSegClick = onSegClick || ((segId) => this.app.scrollToSegment(segId));
    this.wrap = this.timeline.closest(".timeline-wrap");
    // Infobulle de survol (partagée, montée dans le wrap : survit aux re-rendus).
    attachTimelineTip(this.timeline, { parent: this.wrap, top: () => this.timeline.offsetTop });
    // Infobulle de glisser (distincte du survol) + popover de remplissage.
    this.dragTip = createEl("div", { className: "tl-drag-tip" });
    this.wrap.appendChild(this.dragTip);
    this.fillPopover = createFillPopover({ parent: this.wrap });
    this._win = null;
    this._ranges = [];
  }

  bind() {
    // Délégation : un pointerdown sur une poignée démarre le glisser.
    this.timeline.addEventListener("pointerdown", (e) => this.#onGripDown(e));
    // Survol croisé (instance Segments) : signale le segment survolé (ou null).
    if (this.onSegHover) {
      this._hoverId = null;
      this.timeline.addEventListener("mousemove", (e) => {
        const seg = e.target.closest(".tl-seg");
        const id = seg ? seg.dataset.id : null;
        if (id !== this._hoverId) { this._hoverId = id; this.onSegHover(id); }
      });
      this.timeline.addEventListener("mouseleave", () => {
        if (this._hoverId != null) { this._hoverId = null; this.onSegHover(null); }
      });
    }
  }

  render(viewDay) {
    if (this.dragging) return; // garde-fou : pas de reconstruction pendant un glisser
    const { calc, store, formatter } = this.app;
    this.timeline.innerHTML = "";
    this.axis.innerHTML = "";

    const ds = startOfDay(viewDay).getTime();
    const de = ds + DAY_MS;
    const win = calc.timelineWindow(viewDay);
    this._win = win;
    const span = win.end - win.start;
    const pct = (ms) => ((ms - win.start) / span) * 100;
    const ranges = calc.workRangesForDay(viewDay);
    this._ranges = ranges;

    // 1) zones de trou (temps non tracé) — cliquables, en fond de piste
    for (const [gs, ge] of calc.gapsForDay(viewDay)) {
      const w = pct(ge) - pct(gs);
      this.timeline.appendChild(createEl("div", {
        className: "tl-gap",
        html: w > 6 ? `<span class="tl-gap-lab">+ ${formatter.clock((ge - gs) / 60000)}</span>` : "",
        attrs: { style: `left:${pct(gs)}%;width:${w}%`, "data-gs": gs, "data-ge": ge },
        on: { click: () => this.openFill(gs, ge) },
      }));
    }

    // 2) graduation horaire : l'échelle de l'instrument. Filets fins toutes les
    //    heures, marqués toutes les deux. Posée après les trous (elle se lit donc
    //    aussi sur les zones ambre) et avant les segments (qui la couvrent).
    for (let h = Math.ceil(win.start / HOUR_MS) * HOUR_MS; h <= win.end; h += HOUR_MS) {
      this.timeline.appendChild(createEl("div", {
        className: "tl-hour" + (new Date(h).getHours() % 2 === 0 ? " maj" : ""),
        attrs: { style: `left:${pct(h)}%` },
      }));
    }

    // 3) segments (un bloc par segment, avec poignées de redimensionnement)
    for (const seg of store.segmentsForDay(viewDay)) {
      const task = store.taskById(seg.taskId);
      const s = Math.max(seg.startMs(), ds);
      const e = Math.min(seg.endMs(), de);
      if (e <= s) continue;
      const color = task ? task.color : "var(--text-faint)";
      const width = Math.max(SEG_MIN_PCT, pct(e) - pct(s));
      const name = task ? task.displayName : "?";
      const dur = formatter.clock(calc.segmentMs(seg, ds, de) / 60000);
      // Le texte est posé SUR la couleur de la tâche : on choisit clair ou
      // sombre d'après sa luminance (cf. utils/color.js), jamais en dur.
      const block = createEl("div", {
        className: "tl-seg " + (task ? onColorClass(color) : "on-dark"),
        attrs: {
          style: `left:${pct(s)}%;width:${width}%;background:${color}`,
          "data-id": seg.id,
          "data-name": name,
          "data-range": `${fmtClock(new Date(seg.startMs()))}–${seg.isRunning ? "en cours" : fmtClock(new Date(seg.endMs()))}`,
          "data-dur": dur,
          "data-color": color,
        },
        on: { click: (ev) => { if (!ev.target.closest(".tl-grip") && !this._dragged) this.onSegClick(seg.id); } },
      });
      if (width >= LABEL_MIN_PCT) {
        block.appendChild(createEl("b", { text: name }));
        if (width >= DUR_MIN_PCT) block.appendChild(createEl("i", { text: dur }));
      }
      block.appendChild(createEl("div", { className: "tl-grip left", html: "<span></span>", attrs: { "data-seg": seg.id, "data-side": "left" } }));
      if (!seg.isRunning) block.appendChild(createEl("div", { className: "tl-grip right", html: "<span></span>", attrs: { "data-seg": seg.id, "data-side": "right" } }));
      this.timeline.appendChild(block);
    }

    // 4) bande déjeuner : superposition sombre au-dessus des segments (DS §7.1)
    for (let i = 0; i < ranges.length - 1; i++) {
      const ls = ranges[i][1], le = ranges[i + 1][0];
      if (le <= ls) continue;
      const w = pct(le) - pct(ls);
      this.timeline.appendChild(createEl("div", {
        className: "tl-lunch",
        html: w >= LUNCH_MIN_PCT ? "<b>pause</b>" : "",
        attrs: { title: "Pause", style: `left:${pct(ls)}%;width:${w}%` },
      }));
    }

    // 5) rappels de la journée (déjeuner, fin de journée, pauses posées à la
    //    main) : des REPÈRES, pas des coupures — rien n'a été retranché du temps
    //    ouvré, sans quoi une pause café deviendrait un trou à combler. En encre,
    //    jamais en minium : le tampon ne désigne que « maintenant ».
    //    L'étiquette est en bas de piste, où ni la pastille de l'heure (en haut)
    //    ni le mot « pause » de la bande déjeuner ne viennent la disputer.
    const markGap = (46 / (this.timeline.clientWidth || 600)) * 100;
    let lastMarkPct = -Infinity;
    for (const occ of this.app.reminders.occurrencesFor(viewDay)) {
      if (occ.at < win.start || occ.at > win.end) continue;
      const p = pct(occ.at);
      // Deux étiquettes trop proches se chevauchent : on garde les deux filets
      // (l'information de position est juste), on lâche la seconde étiquette.
      const labelled = p - lastMarkPct >= markGap;
      if (labelled) lastMarkPct = p;
      // Près du bord droit l'étiquette sortirait de la piste : elle se retourne
      // et pousse à gauche du filet, qui reste à sa place exacte.
      const edge = p > 100 - markGap ? " at-end" : "";
      this.timeline.appendChild(createEl("div", {
        className: "tl-mark" + edge,
        html: labelled ? `<b>${escapeHtml(occ.label)}</b>` : "",
        attrs: { title: `${occ.label} · ${fmtClock(new Date(occ.at))}`, style: `left:${p}%` },
      }));
    }

    // 6) repère « maintenant »
    const now = Date.now();
    if (sameDay(viewDay, new Date()) && now >= win.start && now <= win.end) {
      // La piste est en `overflow:hidden` : près des bords, la pastille d'heure
      // serait coupée. On la recale sur le bord plutôt que de la centrer.
      const p = pct(now);
      const edge = p > 92 ? " at-end" : p < 8 ? " at-start" : "";
      this.timeline.appendChild(createEl("div", {
        className: "tl-now" + edge,
        html: `<b>${fmtClock(new Date(now))}</b>`,
        attrs: { title: "Maintenant", style: `left:${p}%` },
      }));
    }

    // axe : d'abord la règle graduée (un trait par heure, plus haut toutes les
    // deux). Les blocs couvrent la graduation posée dans la piste dès que la
    // journée est bien remplie : c'est sous la piste que l'échelle reste
    // toujours lisible.
    for (let h = Math.ceil(win.start / HOUR_MS) * HOUR_MS; h <= win.end; h += HOUR_MS) {
      this.axis.appendChild(createEl("i", {
        className: "tl-atick" + (new Date(h).getHours() % 2 === 0 ? " maj" : ""),
        attrs: { style: `left:${pct(h)}%` },
      }));
    }

    // bornes des plages ouvrées + extrémités de la fenêtre
    const bounds = new Set([win.start, win.end]);
    for (const [rs, re] of ranges) { bounds.add(rs); bounds.add(re); }
    const allTicks = [...bounds].filter((t) => t >= win.start && t <= win.end).sort((a, b) => a - b);
    // Anti-chevauchement : on impose une distance minimale (~ largeur d'un
    // libellé) entre deux étiquettes. Le bord droit (fin de fenêtre, p. ex. la
    // fin réelle d'un segment qui déborde de l'horaire) est prioritaire : il
    // évince les bornes internes trop proches plutôt que de se superposer à
    // elles (cas 17:00 / 17:05). Les deux extrémités sont toujours conservées.
    const axisW = this.axis.clientWidth || this.timeline.clientWidth || 600;
    const minGap = (50 / axisW) * 100; // en % de la largeur de l'axe
    const ticks = [];
    const lastIdx = allTicks.length - 1;
    allTicks.forEach((t, i) => {
      const close = () => ticks.length && pct(t) - pct(ticks[ticks.length - 1]) < minGap;
      if (i === lastIdx) { while (close()) ticks.pop(); ticks.push(t); }
      else if (!close()) ticks.push(t);
    });
    ticks.forEach((t, i) => {
      const tick = createEl("span", { className: "tl-tick", text: fmtClock(new Date(t)) });
      tick.style.left = pct(t) + "%";
      tick.style.transform = i === 0 ? "translateX(0)" : i === ticks.length - 1 ? "translateX(-100%)" : "translateX(-50%)";
      this.axis.appendChild(tick);
    });
  }

  /* ----------------- glisser des bords ----------------- */
  #onGripDown(e) {
    const grip = e.target.closest(".tl-grip");
    if (!grip) return;
    e.preventDefault();
    this.dragging = { segId: grip.dataset.seg, side: grip.dataset.side, segEl: grip.closest(".tl-seg"), value: null };
    this._dragged = false;
    // Rect figé pour toute la durée du glisser : évite un reflow (getBoundingClientRect)
    // à chaque pointermove ; il ne change pas tant qu'on ne scrolle/redimensionne pas.
    this._dragRect = this.timeline.getBoundingClientRect();
    this.timeline.classList.add("dragging");
    window.addEventListener("pointermove", this.#onMove);
    window.addEventListener("pointerup", this.#onUp);
    window.addEventListener("pointercancel", this.#onUp);
  }

  #snap(ms) { return Math.round(ms / SNAP_MS) * SNAP_MS; }

  #pctToMs(clientX) {
    const r = this._dragRect || this.timeline.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return this._win.start + ratio * (this._win.end - this._win.start);
  }

  #onMove = (e) => {
    const d = this.dragging;
    if (!d || !this._win) return;
    this._dragged = true;
    const { store, formatter } = this.app;
    const viewDay = this.app.viewDay;
    const seg = store.segments.find((s) => s.id === d.segId);
    if (!seg) return;
    const segs = store.segmentsForDay(viewDay).slice().sort((a, b) => a.startMs() - b.startMs());
    const i = segs.findIndex((s) => s.id === d.segId);
    const now = Date.now();
    const isToday = sameDay(viewDay, new Date());

    // Redimensionnement libre : les seules bornes sont le segment voisin (jamais
    // de chevauchement), « maintenant » (pas de futur) et le bord de la fenêtre
    // visible. On ne cale plus sur les créneaux ouvrés / pauses — c'était la
    // source du comportement « aléatoire » hors horaires (un segment couvrant la
    // pause se repliait dès qu'on saisissait sa poignée). Le temps ouvré reste
    // calculé par intersection avec les créneaux au moment de l'affichage.
    let ms = this.#snap(this.#pctToMs(e.clientX));
    let newStart, newEnd;
    if (d.side === "right") {
      const next = segs[i + 1];
      const max = next ? next.startMs() : (isToday ? now : this._win.end);
      ms = Math.min(Math.max(seg.startMs() + SNAP_MS, ms), max);
      newStart = seg.startMs(); newEnd = ms;
    } else {
      const prev = segs[i - 1];
      const min = prev ? prev.endMs() : this._win.start;
      const endRef = seg.isRunning ? (isToday ? now : this._win.end) : seg.endMs();
      ms = Math.max(Math.min(ms, endRef - SNAP_MS), min);
      newStart = ms; newEnd = endRef;
    }
    d.value = ms;

    // repositionnement direct (sans commit ni reconstruction)
    const span = this._win.end - this._win.start;
    const pct = (m) => ((m - this._win.start) / span) * 100;
    if (d.segEl) {
      d.segEl.style.left = pct(newStart) + "%";
      d.segEl.style.width = Math.max(SEG_MIN_PCT, pct(newEnd) - pct(newStart)) + "%";
    }
    const at = new Date(ms);
    this.dragTip.textContent = pad2(at.getHours()) + ":" + pad2(at.getMinutes()) + " · " + formatter.clock((newEnd - newStart) / 60000);
    this.dragTip.style.left = pct(ms) + "%";
    this.dragTip.style.top = this.timeline.offsetTop + "px";
    this.dragTip.classList.add("show");
  };

  #onUp = () => {
    window.removeEventListener("pointermove", this.#onMove);
    window.removeEventListener("pointerup", this.#onUp);
    window.removeEventListener("pointercancel", this.#onUp);
    this.timeline.classList.remove("dragging");
    this.dragTip.classList.remove("show");
    this._dragRect = null;
    const d = this.dragging;
    this.dragging = null;
    if (d && d.value != null) this.app.resizeSegment(d.segId, d.side, new Date(d.value));
    setTimeout(() => { this._dragged = false; }, 0); // évite un scroll parasite après le glisser
  };

  /* ----------------- popover de remplissage des trous ----------------- */
  openFill(gs, ge) {
    if (!this._win) return;
    const { store, formatter } = this.app;
    const viewDay = this.app.viewDay;
    const span = this._win.end - this._win.start;
    const anchorPct = (((gs + ge) / 2) - this._win.start) / span * 100;
    const segs = store.segmentsForDay(viewDay);
    const leftSeg = segs.find((s) => !s.isRunning && Math.abs(s.endMs() - gs) < 60_000);
    const rightSeg = segs.find((s) => Math.abs(s.startMs() - ge) < 60_000);
    const nameColor = (seg) => { const t = store.taskById(seg.taskId); return { name: t ? t.displayName : "—", color: t ? t.color : "var(--text-faint)" }; };
    this.fillPopover.open({
      topPx: this.timeline.offsetTop + this.timeline.offsetHeight + 12,
      leftPct: anchorPct,
      range: `${fmtClock(new Date(gs))} → ${fmtClock(new Date(ge))}`,
      dur: formatter.clock((ge - gs) / 60000),
      left: leftSeg ? nameColor(leftSeg) : null,
      right: rightSeg ? nameColor(rightSeg) : null,
      tasks: store.tasks.filter((t) => !t.archived).map((t) => ({ id: t.id, name: t.displayName, color: t.color, done: t.done })),
      onExtendLeft: () => this.app.extendLeftIntoGap(leftSeg.id, new Date(ge)),
      onExtendRight: () => this.app.extendRightIntoGap(rightSeg.id, new Date(gs)),
      onCreate: (taskId) => this.app.createSegmentInGap(taskId, new Date(gs), new Date(ge)),
    });
  }

  closeFill() { this.fillPopover.close(); }
}
