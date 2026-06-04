import { el, createEl } from "../../utils/dom.js";
import { DAY_MS, startOfDay, sameDay, fmtClock } from "../../utils/datetime.js";

/** Timeline journalière (blocs colorés par tâche) + signalement du temps non tracé. */
export class TimelineView {
  constructor(app) {
    this.app = app;
    this.timeline = el("timeline");
    this.axis = el("tlAxis");
    this.gapsList = el("gapsList");
  }

  render(viewDay) {
    const { calc, store } = this.app;
    this.timeline.innerHTML = "";
    this.axis.innerHTML = "";
    this.gapsList.innerHTML = "";

    const ds = startOfDay(viewDay).getTime();
    const de = ds + DAY_MS;
    const { start: winStart, end: winEnd } = calc.timelineWindow(viewDay);
    const span = winEnd - winStart;
    const pct = (ms) => ((ms - winStart) / span) * 100;

    // bandes de pause : intervalles entre créneaux ouvrés consécutifs
    const ranges = calc.workRangesForDay(viewDay);
    for (let i = 0; i < ranges.length - 1; i++) {
      const ls = ranges[i][1];
      const le = ranges[i + 1][0];
      if (le > ls) {
        this.timeline.appendChild(createEl("div", {
          className: "tl-lunch",
          attrs: { title: "Pause", style: `left:${pct(ls)}%;width:${pct(le) - pct(ls)}%` },
        }));
      }
    }

    // segments
    for (const seg of store.segmentsForDay(viewDay)) {
      const task = store.taskById(seg.taskId);
      const s = Math.max(seg.startMs(), ds);
      const e = Math.min(seg.endMs(), de);
      const minutes = calc.segmentMs(seg, ds, de) / 60000;
      const block = createEl("div", {
        className: "tl-seg",
        attrs: {
          style: `left:${pct(s)}%;width:${Math.max(0.4, pct(e) - pct(s))}%;background:${task ? task.color : "var(--text-faint)"}`,
          title: `${task ? task.displayName : "?"} · ${fmtClock(new Date(s))}–${fmtClock(new Date(e))} · ${this.app.formatter.clock(minutes)}`,
        },
        on: { click: () => this.app.scrollToSegment(seg.id) },
      });
      this.timeline.appendChild(block);
    }

    // repère « maintenant » (uniquement aujourd'hui, dans la fenêtre)
    const now = Date.now();
    if (sameDay(viewDay, new Date()) && now >= winStart && now <= winEnd) {
      this.timeline.appendChild(createEl("div", {
        className: "tl-now",
        attrs: { title: "Maintenant", style: `left:${pct(now)}%` },
      }));
    }

    // axe : les bornes des plages ouvrées (entrée, début/fin de pause, sortie)
    // positionnées à leur emplacement réel, + les extrémités de la fenêtre.
    const bounds = new Set([winStart, winEnd]);
    for (const [rs, re] of ranges) { bounds.add(rs); bounds.add(re); }
    const ticks = [...bounds].filter((t) => t >= winStart && t <= winEnd).sort((a, b) => a - b);
    ticks.forEach((t, i) => {
      const tick = createEl("span", { className: "tl-tick", text: fmtClock(new Date(t)) });
      tick.style.left = pct(t) + "%";
      tick.style.transform = i === 0 ? "translateX(0)"
        : i === ticks.length - 1 ? "translateX(-100%)"
        : "translateX(-50%)";
      this.axis.appendChild(tick);
    });

    // temps non tracé : signalé sobrement sous la timeline (plus de hachures dans la barre)
    for (const [gs, ge] of calc.gapsForDay(viewDay)) {
      const mins = Math.round((ge - gs) / 60000);
      const item = createEl("div", {
        className: "gap-item",
        html: `<span class="gap-dot"></span><span>${fmtClock(new Date(gs))}–${fmtClock(new Date(ge))} · ${mins} min non tracées</span>`,
      });
      item.appendChild(createEl("button", {
        className: "gap-fill",
        text: "Combler",
        on: { click: () => this.app.addManualSegment(new Date(gs), new Date(ge)) },
      }));
      this.gapsList.appendChild(item);
    }
  }
}
