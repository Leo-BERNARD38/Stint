/**
 * Constantes globales et valeurs par défaut.
 * Aucune dépendance : ce module est la racine du graphe d'imports.
 */

export const STORAGE_KEY = "stint.v1";
export const SCHEMA_VERSION = 1;
export const DAY_MS = 86_400_000;

/** Palette assignée automatiquement aux tâches (cyclique). */
export const PALETTE = [
  "#4F46E5", "#0891B2", "#16A34A", "#CA8A04", "#DC2626",
  "#DB2777", "#7C3AED", "#2563EB", "#059669", "#EA580C",
  "#9333EA", "#0D9488", "#65A30D", "#E11D48", "#475569",
];

/** Libellés des jours, indexés sur ISO (1 = lundi … 7 = dimanche). */
export const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export const TASK_TYPES = ["dev", "support", "autre"];
export const ROUNDING_MODES = ["none", "1m", "5m", "15m"];

/** Réglages par défaut (cf. §8 du cahier des charges). */
export const THEMES = ["system", "light", "dark"];

export const DEFAULT_SETTINGS = Object.freeze({
  appName: "Stint",
  theme: "system",
  workDays: [1, 2, 3, 4, 5],
  arrival: "09:00",
  lunchStart: "12:30",
  lunchEnd: "13:30",
  departure: "18:00",
  jira: { hoursPerDay: 8, daysPerWeek: 5 },
  rounding: "none",
});
