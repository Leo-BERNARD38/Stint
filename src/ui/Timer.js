import { EventEmitter } from "../core/EventEmitter.js";

/** Horloge applicative : émet `tick` chaque seconde (§7 réactivité 1 s). */
export class Timer extends EventEmitter {
  constructor(intervalMs = 1000) {
    super();
    this.intervalMs = intervalMs;
    this.handle = null;
  }

  start() {
    this.stop();
    this.handle = setInterval(() => this.emit("tick"), this.intervalMs);
  }

  stop() {
    if (this.handle) clearInterval(this.handle);
    this.handle = null;
  }
}
