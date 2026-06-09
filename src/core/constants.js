/**
 * Constantes globales et valeurs par défaut.
 * Aucune dépendance : ce module est la racine du graphe d'imports.
 */

export const STORAGE_KEY = "stint.v1";
export const SCHEMA_VERSION = 4;
export const DAY_MS = 86_400_000;

/**
 * Seuil de fusion des micro-pauses : reprendre la même tâche dans cet intervalle
 * après une pause rouvre le segment précédent au lieu d'en créer un nouveau.
 * Évite de fragmenter la base et garde une timeline lisible. (2 minutes)
 */
export const SEGMENT_MERGE_GAP_MS = 120_000;

/**
 * Palettes de couleurs assignées automatiquement aux tâches, **par catégorie**.
 * Chaque type a sa propre famille chromatique : on distingue ainsi les catégories
 * au premier coup d'œil, tandis que les petites variations au sein d'une famille
 * permettent de différencier les tâches entre elles. Généreuses et **cycliques**
 * (on repart au début une fois la palette épuisée).
 *   - dev     → froides (indigo, bleu, cyan, sarcelle)
 *   - support → chaudes (rouge, orange, ambre, rose)
 *   - autre   → neutres (ardoise, gris, pierre, zinc)
 */
export const PALETTES = {
  dev: [
    "#4F46E5", "#2563EB", "#0EA5E9", "#0891B2", "#0D9488",
    "#6366F1", "#1D4ED8", "#0284C7", "#0E7490", "#0F766E",
    "#3B82F6", "#4338CA",
  ],
  support: [
    "#DC2626", "#EA580C", "#F59E0B", "#E11D48", "#DB2777",
    "#B91C1C", "#C2410C", "#D97706", "#BE123C", "#BE185D",
    "#F43F5E", "#EF4444",
  ],
  autre: [
    "#475569", "#64748B", "#334155", "#525252", "#737373",
    "#57534E", "#78716C", "#52525B", "#6B7280", "#404040",
    "#44403C", "#3F3F46",
  ],
};

/** Palette à plat (toutes catégories confondues) — repli générique. */
export const PALETTE = [...PALETTES.dev, ...PALETTES.support, ...PALETTES.autre];

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
  arrival: "08:30",
  lunchStart: "12:30",
  lunchEnd: "13:30",
  departure: "17:00",
  weekdayHours: {},  // exceptions par jour de semaine : { "5": [["08:30","12:50"]] }
  dateHours: {},     // exceptions par date : { "2026-06-12": [["08:30","12:30"],["13:30","16:30"]] }
  jira: { auto: true, hoursPerDay: 8, daysPerWeek: 5 },
  rounding: "none",
});
