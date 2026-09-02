/**
 * Constantes globales et valeurs par défaut.
 * Aucune dépendance : ce module est la racine du graphe d'imports.
 */

/** ⚠ Dupliquée en dur dans le script inline anti-flash d'index.html (pas d'import possible là-bas). */
export const STORAGE_KEY = "stint.v1";
export const SCHEMA_VERSION = 11;
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
 *
 * Accordées à la direction artistique : des teintes **rabattues**, tirées des
 * trois familles du système (bleu de Prusse, minium, neutres chauds). Des
 * couleurs saturées type « nuancier d'écran » cassaient le papier et arrivaient
 * toujours plus fort que le chrono, qui doit rester le point le plus vif.
 *   - dev     → froides  (bleu de Prusse, sarcelle, ardoise bleutée)
 *   - support → chaudes  (minium, terre, ambre)
 *   - autre   → neutres chauds (la famille du papier)
 */
/* Chaque teinte est choisie pour qu'au moins un des deux textes possibles
   (blanc ou encre) y passe le seuil AA — c'est `utils/color.js` qui tranche au
   rendu. Cinq d'entre elles tombaient dans la bande où AUCUN des deux ne
   passait : elles ont été décalées de quelques points, à l'œil identiques.
   Les couleurs déjà enregistrées sur des tâches ne sont pas touchées : elles
   vivent dans les données, pas ici. */
export const PALETTES = {
  dev: [
    "#1E5273", "#2C6E8F", "#276A6A", "#3F8BAA", "#22757F",
    "#1F4459", "#487B98", "#2F5F86", "#357F7A", "#4A93A8",
    "#345E7E", "#1C6060",
  ],
  // Support : chaud, mais RABATTU — argile, brique, prune. La famille était
  // faite d'oranges et de rouges vifs ; sur l'écran, une tâche de support
  // ressemblait donc à une alarme, et disputait son sens au minium, qui ne dit
  // qu'une chose : « ça, maintenant ». Aucune teinte par défaut ne doit plus
  // pouvoir être confondue avec le tampon.
  support: [
    "#8B5041", "#924F58", "#7E543E", "#874F64", "#9B5550",
    "#71513D", "#82404F", "#996656", "#8E5773", "#794239",
    "#844D4F", "#91604B",
  ],
  autre: [
    "#6B665C", "#8A8478", "#544F47", "#7D7668", "#605A50",
    "#948C7D", "#4A4640", "#726B61", "#8A8273", "#57534B",
    "#9C9384", "#655F55",
  ],
};

/** Palette à plat (toutes catégories confondues) — repli générique. */
export const PALETTE = [...PALETTES.dev, ...PALETTES.support, ...PALETTES.autre];

/** Libellés des jours, indexés sur ISO (1 = lundi … 7 = dimanche). */
export const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export const TASK_TYPES = ["dev", "support", "autre"];

/** Réglages par défaut (cf. §8 du cahier des charges). */
export const THEMES = ["system", "light", "dark"];

export const DEFAULT_SETTINGS = Object.freeze({
  appName: "Stint",
  theme: "system",
  workDays: [1, 2, 3, 4, 5],
  arrival: "08:30",
  departure: "17:00",
  // La journée se dit partout de la même façon : une arrivée, un départ, et une
  // pause déjeuner **ou non**. `lunch` porte l'état, `lunchStart`/`lunchEnd` la
  // fenêtre — les décorréler permet de décocher la pause sans perdre ses heures.
  lunch: true,
  lunchStart: "12:30",
  lunchEnd: "13:30",
  weekdayHours: {},  // exceptions par jour de semaine : { "5": [["08:30","12:50"]] }
  // Exceptions par date : { "2026-06-12": [["08:30","12:30"],["13:30","16:30"]] }.
  // Une PÉRIODE (des congés) y est stockée **expansée**, une clé par date :
  // délibérément, pour ne pas ajouter un 4ᵉ niveau de précédence à `blocksFor`.
  // C'est l'affichage qui regroupe (`Settings.dateGroups`).
  dateHours: {},
  jira: { auto: true, hoursPerDay: 8, daysPerWeek: 5 },
  rounding: "none",  // pas d'arrondi | 1m | 5m | 15m | 30m | 1h (cf. ROUNDING_STEPS)
  roundedDay: false, // vue « arrondi » de la journée (interrupteur des Tâches du jour)
  bgDots: false,     // fond dot-matrix réactif au curseur (easter-egg, off par défaut)
  // Rappel « repos des yeux » (règle 20-20-20) : rappel toutes les `minutes`
  // **tant qu'un chrono tourne**, puis un repos de `restSeconds`. Off par défaut
  // (demande une permission). Les deux nombres portent le nom de la règle — 20
  // et 20 — mais restent réglables : une règle qu'on ne peut pas adapter à sa
  // fatigue est une règle qu'on coupe.
  // `sound` / `volume` : un bip de synthèse (aucun fichier, cf. ui/Chime.js) au
  // début ET à la fin du repos. C'est le seul canal qui marche quand on ne
  // regarde PAS l'écran — ce qui est précisément ce qu'on demande à l'oreille
  // pendant les vingt secondes. Coupé par défaut : un son qu'on n'a pas
  // demandé est une nuisance.
  eyeBreak: { enabled: false, minutes: 20, restSeconds: 20, sound: false, volume: 0.5 },
  // Rappels de la journée. `lunch` et `dayEnd` n'ont PAS d'heure : elles se
  // déduisent des horaires résolus du jour (`Settings.blocksFor`) — la pause
  // déjeuner est le trou entre deux créneaux, la fin de journée la fin du
  // dernier. Ressaisir ces heures, c'est se garantir de les désynchroniser.
  // `breaks` : les rappels qu'on pose soi-même. `date` nulle = tous les jours
  // travaillés ; `date` renseignée = ce jour-là seulement (une réunion).
  reminders: { lunch: false, dayEnd: false, breaks: [] },
});

/** Bornes de la période du rappel « repos des yeux », en minutes. */
export const EYE_BREAK_MIN = 1;
export const EYE_BREAK_MAX = 240;
/** Bornes de la durée du repos lui-même, en secondes. */
export const EYE_REST_MIN = 5;
export const EYE_REST_MAX = 300;

/** Longueur maximale du libellé d'un rappel (une ligne de notification). */
export const REMINDER_LABEL_MAX = 60;
/** Nombre maximal de rappels enregistrés — garde-fou, pas une ambition. */
export const REMINDER_MAX = 24;

/**
 * Bornes de la saisie d'horaires par période. Le coût d'une plage n'est pas au
 * calcul (`blocksFor` est un accès de map) mais au **stockage** : `dateHours`
 * part dans `toJSON()`, donc dans IndexedDB *et* dans le miroir localStorage, à
 * chaque sauvegarde. Une faute de frappe sur l'année (2026 → 2036) écrirait
 * 3 653 clés réécrites à chaque commit, pour toujours.
 */
export const DATE_RANGE_MAX_DAYS = 366;   // une année pleine reste exprimable
export const DATE_HOURS_MAX = 1500;       // ~45 dates par an → une trentaine d'années

/**
 * Pas d'arrondi disponibles, en **minutes** (0 = aucun). L'arrondi s'applique au
 * **total d'une tâche sur la journée**, pas à chaque segment : c'est la maille
 * qu'on reporte dans Jira.
 */
export const ROUNDING_STEPS = Object.freeze({
  none: 0, "1m": 1, "5m": 5, "15m": 15, "30m": 30, "1h": 60,
});
