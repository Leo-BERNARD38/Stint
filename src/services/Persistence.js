import { STORAGE_KEY } from "../core/constants.js";

/**
 * Persistance à deux zones :
 *   - IndexedDB : zone primaire, historique complet, fiable, gros quota.
 *   - localStorage : miroir des 30 derniers jours, synchrone (affichage
 *     instantané au démarrage) et redondance si IndexedDB est indisponible.
 *
 * On ne tronque le miroir localStorage que si IndexedDB est opérationnel
 * (sinon localStorage garde l'état complet pour ne rien perdre).
 */
const DB_NAME = "stint";
const STORE = "state";
const KEY = "current";
const LS_KEY = STORAGE_KEY;
const RECENT_MS = 30 * 86_400_000;
const OPEN_TIMEOUT = 2500;

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

function openDB() {
  return new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(DB_NAME, 1); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("idb open"));
    req.onblocked = () => reject(new Error("idb blocked"));
  });
}

function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function idbPut(db, key, val) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function idbClear(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export class Persistence {
  constructor() {
    this.db = null;
    this.idbOk = false;
  }

  /** Lecture synchrone du miroir localStorage (récent) — affichage instantané. */
  loadSync() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn("Stint: lecture localStorage impossible", e);
      return null;
    }
  }

  /** Ouvre IndexedDB (avec délai de garde). À appeler une fois au démarrage. */
  async init() {
    if (typeof indexedDB === "undefined") return;
    try {
      this.db = await withTimeout(openDB(), OPEN_TIMEOUT);
      this.idbOk = true;
    } catch (e) {
      console.warn("Stint: IndexedDB indisponible, repli sur localStorage", e);
      this.db = null;
      this.idbOk = false;
    }
  }

  /** Historique complet depuis IndexedDB (null si vide ou indisponible). */
  async loadFull() {
    if (!this.idbOk) return null;
    try {
      return (await idbGet(this.db, KEY)) ?? null;
    } catch (e) {
      console.warn("Stint: lecture IndexedDB impossible", e);
      return null;
    }
  }

  /** Écrit dans les deux zones : IndexedDB (complet) + localStorage (récent). */
  save(full) {
    try {
      const local = this.idbOk ? this.#recent(full) : full;
      localStorage.setItem(LS_KEY, JSON.stringify(local));
    } catch (e) {
      console.warn("Stint: écriture localStorage impossible", e);
    }
    if (this.idbOk) {
      idbPut(this.db, KEY, full).catch((e) => console.warn("Stint: écriture IndexedDB impossible", e));
    }
  }

  clear() {
    try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ }
    if (this.idbOk) idbClear(this.db).catch(() => { /* ignore */ });
  }

  /** Vue « 30 derniers jours » : on garde réglages/tâches et les segments récents. */
  #recent(full) {
    const cutoff = Date.now() - RECENT_MS;
    const segments = (full.segments || []).filter((s) => !s.end || new Date(s.end).getTime() >= cutoff);
    return { ...full, segments };
  }
}
