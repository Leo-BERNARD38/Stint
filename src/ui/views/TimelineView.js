import { el, createEl } from "../../utils/dom.js";
import { DAY_MS } from "../../core/constants.js";
import { startOfDay, sameDay, fmtClock, pad2 } from "../../utils/datetime.js";
import { attachTimelineTip } from "../components/TimelineTip.js";
import { createFillPopover } from "../components/FillPopover.js";

const SNAP_MS = 300_000; // calage par pas de 5 minutes

/**
 * Timeline journalière : segments colorés **redimensionnables** (poignées sur
 * chaque bord, snap 5 min), **trous cliquables** (popover de remplissage :
 * prolonger gauche/droite ou créer un segment) et repère « maintenant ».
 *
 * Pendant un glisser actif, `render()` est court-circuité (garde-fou
 * anti-reconstruction, cf. CLAUDE.md §10) : le bloc est repositionné à la main,
 * et le changement n'est committé qu'au relâchement (un seul rebuild propre).
 */
export class TimelineView {
  dragging = null;

  constructor(app) {
    this.app = app;
    this.timeline = el("timeline");
    this.anchor = this.timeline;
    this.axis = el("tlAxis");
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

    // 2) segments (un bloc par segment, avec poignées de redimensionnement)
    for (const seg of store.segmentsForDay(viewDay)) {
      const task = store.taskById(seg.taskId);
      const s = Math.max(seg.startMs(), ds);
      const e = Math.min(seg.endMs(), de);
      if (e <= s) continue;
      const color = task ? task.color : "var(--text-faint)";
      const block = createEl("div", {
        className: "tl-seg",
        attrs: {
          style: `left:${pct(s)}%;width:${Math.max(0.6, pct(e) - pct(s))}%;background:${color}`,
          "data-id": seg.id,
          "data-name": task ? task.displayName : "?",
          "data-range": `${fmtClock(new Date(seg.startMs()))}–${seg.isRunning ? "en cours" : fmtClock(new Date(seg.endMs()))}`,
          "data-dur": formatter.clock(calc.segmentMs(seg, ds, de) / 60000),
          "data-color": color,
        },
        on: { click: (ev) => { if (!ev.target.closest(".tl-grip") && !this._dragged) this.app.scrollToSegment(seg.id); } },
      });
      block.appendChild(createEl("div", { className: "tl-grip left", html: "<span></span>", attrs: { "data-seg": seg.id, "data-side": "left" } }));
      if (!seg.isRunning) block.appendChild(createEl("div", { className: "tl-grip right", html: "<span></span>", attrs: { "data-seg": seg.id, "data-side": "right" } }));
      this.timeline.appendChild(block);
    }

    // 3) bande déjeuner : superposition sombre au-dessus des segments (DS §7.1)
    for (let i = 0; i < ranges.length - 1; i++) {
      const ls = ranges[i][1], le = ranges[i + 1][0];
      if (le > ls) this.timeline.appendChild(createEl("div", {
        className: "tl-lunch", attrs: { title: "Pause", style: `left:${pct(ls)}%;width:${pct(le) - pct(ls)}%` },
      }));
    }

    // 4) repère « maintenant »
    const now = Date.now();
    if (sameDay(viewDay, new Date()) && now >= win.start && now <= win.end) {
      this.timeline.appendChild(createEl("div", { className: "tl-now", attrs: { title: "Maintenant", style: `left:${pct(now)}%` } }));
    }

    // axe : bornes des plages ouvrées + extrémités de la fenêtre
    const bounds = new Set([win.start, win.end]);
    for (const [rs, re] of ranges) { bounds.add(rs); bounds.add(re); }
    const ticks = [...bounds].filter((t) => t >= win.start && t <= win.end).sort((a, b) => a - b);
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
    this.timeline.classList.add("dragging");
    window.addEventListener("pointermove", this.#onMove);
    window.addEventListener("pointerup", this.#onUp);
    window.addEventListener("pointercancel", this.#onUp);
  }

  #snap(ms) { return Math.round(ms / SNAP_MS) * SNAP_MS; }

  #pctToMs(clientX) {
    const r = this.timeline.getBoundingClientRect();
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
    const lunches = [];
    for (let k = 0; k < this._ranges.length - 1; k++) lunches.push([this._ranges[k][1], this._ranges[k + 1][0]]);
    const workStart = this._ranges.length ? this._ranges[0][0] : this._win.start;

    let ms = this.#snap(this.#pctToMs(e.clientX));
    let newStart, newEnd;
    if (d.side === "right") {
      const next = segs[i + 1];
      let max = next ? next.startMs() : (isToday ? now : this._win.end);
      for (const [ls] of lunches) if (seg.startMs() < ls) max = Math.min(max, ls);
      ms = Math.min(Math.max(seg.startMs() + SNAP_MS, ms), max);
      newStart = seg.startMs(); newEnd = ms;
    } else {
      const prev = segs[i - 1];
      let min = prev ? prev.endMs() : workStart;
      for (const [, le] of lunches) if (seg.startMs() >= le) min = Math.max(min, le);
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
      d.segEl.style.width = Math.max(0.6, pct(newEnd) - pct(newStart)) + "%";
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
      tasks: store.tasks.filter((t) => !t.archived).map((t) => ({ id: t.id, name: t.displayName, color: t.color })),
      onExtendLeft: () => this.app.extendLeftIntoGap(leftSeg.id, new Date(ge)),
      onExtendRight: () => this.app.extendRightIntoGap(rightSeg.id, new Date(gs)),
      onCreate: (taskId) => this.app.createSegmentInGap(taskId, new Date(gs), new Date(ge)),
    });
  }

  closeFill() { this.fillPopover.close(); }
}
