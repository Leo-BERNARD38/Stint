import { MEMO_TEXT_MAX } from "../core/constants.js";

/**
 * Un mémo : une ligne de texte à se laisser pour demain, rattachée à une tâche
 * (`taskId`) ou générale (`null`). `done` la barre sans l'effacer — on relit
 * volontiers ce qu'on a fini. `createdAt` (ISO) sert d'ordre : le plus récent
 * en haut, les faits en bas.
 */
export class Memo {
  constructor({ id, text, taskId = null, done = false, createdAt = null }) {
    this.id = id;
    this.text = String(text ?? "").trim().slice(0, MEMO_TEXT_MAX);
    this.taskId = taskId ?? null;
    this.done = !!done;
    this.createdAt = createdAt || new Date().toISOString();
  }

  static fromJSON(o) {
    return new Memo(o);
  }

  toJSON() {
    return { id: this.id, text: this.text, taskId: this.taskId, done: this.done, createdAt: this.createdAt };
  }
}
