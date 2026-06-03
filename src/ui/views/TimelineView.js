import { el, createEl } from "../../utils/dom.js";
import { DAY_MS, startOfDay, fmtClock } from "../../utils/datetime.js";

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

    // bande pause déjeuner
    const ranges = calc.workRangesForDay(viewDay);
    if (ranges.length === 2) {
      const [ls, le] = [ranges[0][1], ranges[1][0]];
      if (le > ls) {
        this.timeline.appendChild(createEl("div", {
          className: "tl-lunch",
          attrs: { title: "Pause déjeuner", style: `left:${pct(ls)}%;width:${pct(le) - pct(ls)}%` },
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
          title: `${task ? task.displayName : "?"} · ${fmtClock(new Date(s))}–${fmtClock(new Date(e))} · ${this.app.formatter.decimal(minutes)} h`,
        },
        on: { click: () => this.app.scrollToSegment(seg.id) },
      });
      this.timeline.appendChild(block);
    }

    // temps non tracé
    for (const [gs, ge] of calc.gapsForDay(viewDay)) {
      this.timeline.appendChild(createEl("div", {
        className: "tl-gap",
        attrs: { title: "Non tracé", style: `left:${pct(gs)}%;width:${Math.max(0.4, pct(ge) - pct(gs))}%` },
      }));
      const mins = Math.round((ge - gs) / 60000);
      const item = createEl("div", {
        className: "gap-item",
        html: `⚠︎ ${mins} min non tracées entre ${fmtClock(new Date(gs))} et ${fmtClock(new Date(ge))}`,
      });
      item.appendChild(createEl("button", {
        text: "Combler →",
        on: { click: () => this.app.addManualSegment(new Date(gs), new Date(ge)) },
      }));
      this.gapsList.appendChild(item);
    }

    // axe
    this.axis.append(
      createEl("span", { text: fmtClock(new Date(winStart)) }),
      createEl("span", { text: fmtClock(new Date(winStart + span / 2)) }),
      createEl("span", { text: fmtClock(new Date(winEnd)) }),
    );
  }
}
