import { STORAGE_KEY } from "../core/constants.js";

/**
 * Adaptateur de persistance (localStorage). Isolé pour rester remplaçable
 * (IndexedDB, fichier, backend…) sans toucher au domaine.
 */
export class Persistence {
  constructor(key = STORAGE_KEY) {
    this.key = key;
  }

  load() {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn("Stint: lecture du stockage impossible", e);
      return null;
    }
  }

  save(obj) {
    try {
      localStorage.setItem(this.key, JSON.stringify(obj));
    } catch (e) {
      console.warn("Stint: écriture du stockage impossible", e);
    }
  }

  clear() {
    try {
      localStorage.removeItem(this.key);
    } catch (e) {
      console.warn("Stint: effacement du stockage impossible", e);
    }
  }
}
