import { STORAGE_KEY } from "../core/constants.js";

/**
 * Estimation de l'occupation du stockage local. localStorage est limité
 * (~5 Mo par origine selon les navigateurs) : on mesure la taille (UTF-8) de
 * notre entrée et on la rapporte à un budget prudent de 5 Mo.
 */
export const STORAGE_BUDGET = 5 * 1024 * 1024;

/** Seuils d'occupation (%) : barre ambre puis rouge ; CRIT déclenche l'alerte. */
export const WARN = 70;
export const CRIT = 85;

export function usedBytes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || "";
    return new Blob([raw]).size;
  } catch (e) {
    return 0;
  }
}

export function storageInfo() {
  const used = usedBytes();
  return { used, budget: STORAGE_BUDGET, percent: Math.min(100, (used / STORAGE_BUDGET) * 100) };
}

export function formatBytes(n) {
  if (n < 1024) return n + " o";
  if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10 * 1024 ? 1 : 0) + " Ko";
  return (n / (1024 * 1024)).toFixed(1) + " Mo";
}
