import { STORAGE_KEY } from "../core/constants.js";

/**
 * Estimation de l'espace de stockage occupé. On privilégie
 * `navigator.storage.estimate()` (couvre IndexedDB + caches, quota réel, gros),
 * avec repli sur la taille du miroir localStorage face à ~5 Mo.
 */
const FALLBACK_BUDGET = 5 * 1024 * 1024;

let snap = null; // { used, quota, percent } — dernière mesure connue

export function storageSnapshot() {
  return snap;
}

export async function refreshStorage() {
  let used = 0;
  let quota = 0;
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const e = await navigator.storage.estimate();
      used = e.usage || 0;
      quota = e.quota || 0;
    }
  } catch (e) { /* indisponible : on bascule sur le repli */ }

  if (!quota) {
    used = localStorageBytes();
    quota = FALLBACK_BUDGET;
  }
  snap = { used, quota, percent: quota ? Math.min(100, (used / quota) * 100) : 0 };
  return snap;
}

function localStorageBytes() {
  try {
    return new Blob([localStorage.getItem(STORAGE_KEY) || ""]).size;
  } catch (e) {
    return 0;
  }
}

export function formatBytes(n) {
  if (n < 1024) return n + " o";
  if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10 * 1024 ? 1 : 0) + " Ko";
  if (n < 1024 * 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + " Mo";
  return (n / (1024 * 1024 * 1024)).toFixed(1) + " Go";
}
