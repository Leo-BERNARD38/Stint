/**
 * Pack d'icônes — silhouettes Lucide (https://lucide.dev, licence ISC/MIT),
 * embarquées localement en SVG inline : aucun appel réseau, fonctionne
 * hors-ligne et se thème via `currentColor`. Source de vérité unique des icônes.
 */

const ICONS = {
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  "rotate-ccw": '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  copy: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  "chevron-left": '<path d="m15 18-6-6 6-6"/>',
  "chevron-right": '<path d="m9 18 6-6-6-6"/>',
  "chevron-down": '<path d="m6 9 6 6 6-6"/>',
  "arrow-right": '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  "arrow-left": '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  calculator: '<rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
};

/**
 * Renvoie le balisage SVG d'une icône.
 * @param {string} name  clé du pack
 * @param {{size?:number, solid?:boolean}} opts
 */
export function icon(name, { size = 18, solid = false } = {}) {
  const body = ICONS[name] ?? "";
  const fill = solid ? "currentColor" : "none";
  const sw = solid ? "0" : "2";
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" ` +
    `fill="${fill}" stroke="currentColor" stroke-width="${sw}" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/* ============================================================================
   Icônes « grille de points » (esthétique Nothing OS / police dot-matrix).
   Glyphes monochromes dessinés sur une grille carrée 7×7, points jointifs
   (sans espace) pour retrouver exactement le rendu de la police Bitcount.
   Traits fins (1 point) pour « + » et « pause ». Réservés aux gros boutons
   d'action ; le reste de l'UI garde les silhouettes Lucide.
   ============================================================================ */

/** Glyphes en bitmap 7×7 — un '#' = un point allumé. */
const DOT_GLYPHS = {
  plus: [
    "...#...",
    "...#...",
    "...#...",
    "#######",
    "...#...",
    "...#...",
    "...#...",
  ],
  pause: [
    "..#..#.",
    "..#..#.",
    "..#..#.",
    "..#..#.",
    "..#..#.",
    "..#..#.",
    "..#..#.",
  ],
  play: [
    "..#....",
    "..##...",
    "..###..",
    "..####.",
    "..###..",
    "..##...",
    "..#....",
  ],
  check: [
    ".......",
    "......#",
    ".....#.",
    "#...#..",
    ".#.#...",
    "..#....",
    ".......",
  ],
  // « Reprise » : barre + triangle (reprendre la lecture d'une tâche).
  resume: [
    "#.#....",
    "#.##...",
    "#.###..",
    "#.####.",
    "#.###..",
    "#.##...",
    "#.#....",
  ],
};

const DOT_BOX = 7;    // grille 7×7 = viewBox carré

/** Points d'un bitmap : pitch 1, rayon 0.5 ⇒ points jointifs (aucun espace). */
function dotsFromBitmap(rows) {
  let out = "";
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      if (row[x] === "#") {
        out += `<circle cx="${(x + 0.5).toFixed(1)}" cy="${(y + 0.5).toFixed(1)}" r="0.5"/>`;
      }
    }
  }
  return out;
}

/**
 * Renvoie le balisage SVG d'une icône en grille de points (monochrome).
 * @param {string} name  plus | pause | play | check | resume
 * @param {{size?:number}} opts
 */
export function dotIcon(name, { size = 24 } = {}) {
  const body = dotsFromBitmap(DOT_GLYPHS[name] ?? []);
  return `<svg class="icon dot-icon" width="${size}" height="${size}" viewBox="0 0 ${DOT_BOX} ${DOT_BOX}" ` +
    `fill="currentColor" stroke="none" aria-hidden="true">${body}</svg>`;
}

/* ============================================================================
   Scène « moment de la journée » — un paysage dot-matrix en **fond** de la carte
   « Total du jour » (pleine largeur, derrière le texte). Montagnes basses sur
   toute la largeur ; le soleil ne circule **que sur la moitié droite** (jamais
   derrière le texte, qui occupe la gauche), culmine au centre-droit ; la nuit, la
   lune traverse de même, étoiles scintillantes — la **moitié gauche / le haut
   gauche restent vides**. Points **allumés / éteints** uniquement (aucun gris),
   matrice fine (points ~2× plus petits). Animation image par image par
   `DayGlyphAnimator`. Tout est réglable ci-dessous : bitmaps, pics, fenêtres.
   ============================================================================ */
const SCENE_W = 96, SCENE_H = 40, SCENE_GROUND = SCENE_H - 1;
const SUN_RISE = 6, SUN_SET = 20; // soleil visible de 6h à 20h ; lune sinon
const SUN_X0 = Math.round(SCENE_W * 0.33), SUN_X1 = Math.round(SCENE_W * 0.92); // trajectoire large : du premier tiers gauche jusqu'à droite

// --- grille binaire (0 = éteint, 1 = allumé) ---
const sNew = () => Array.from({ length: SCENE_H }, () => Array(SCENE_W).fill(0));
const sSet = (g, x, y) => { if (x >= 0 && x < SCENE_W && y >= 0 && y < SCENE_H) g[y][x] = 1; };
/** Pose un bitmap ASCII (`#` = allumé, `.` = éteint) centré en (cx, cy). */
const sStamp = (g, art, cx, cy) => {
  const ox = cx - (art[0].length >> 1), oy = cy - (art.length >> 1);
  for (let sy = 0; sy < art.length; sy++) for (let sx = 0; sx < art[sy].length; sx++) {
    if (art[sy][sx] === "#") sSet(g, ox + sx, oy + sy);
  }
};
/** Grille binaire → cercles SVG (points jointifs, tous pleins). */
const sBake = (g) => {
  let b = "";
  for (let y = 0; y < SCENE_H; y++) for (let x = 0; x < SCENE_W; x++) {
    if (g[y][x]) b += `<circle cx="${x + 0.5}" cy="${y + 0.5}" r="0.5"/>`;
  }
  return b;
};

// --- décor : montagnes, silhouette pleine générée depuis des pics ---
/** Pour chaque colonne, rangée du sommet = min sur les pics (pic + pente × distance). */
const ridge = (peaks, slope) => {
  const top = Array(SCENE_W).fill(SCENE_H);
  for (let x = 0; x < SCENE_W; x++) for (const [px, py] of peaks) {
    top[x] = Math.min(top[x], py + Math.round(Math.abs(x - px) * slope));
  }
  return top;
};
const fillRange = (g, top) => {
  for (let x = 0; x < SCENE_W; x++) for (let y = Math.max(0, top[x]); y <= SCENE_GROUND; y++) sSet(g, x, y);
};
// montagnes basses (sommets vers le bas = grand y), sur toute la largeur
const RIDGE = ridge([[12, 36], [30, 33], [48, 35], [66, 32], [84, 34], [95, 37]], 0.38);

// --- astres (bitmaps modifiables : `#` allumé, `.` éteint) ---
const SUN_CORE = [ // disque rond 7×7
  "..###..",
  ".#####.",
  "#######",
  "#######",
  "#######",
  ".#####.",
  "..###..",
];
const MOON_CORE = [ // croissant 7 de haut
  "..##.",
  ".##..",
  "##...",
  "##...",
  "##...",
  ".##..",
  "..##.",
];
const STARS = [[58, 8], [68, 5], [78, 10], [86, 6], [64, 15], [82, 17], [74, 12], [90, 13]];

/** Soleil (disque rond + rayons tournants détachés) à la position (cx, cy), frame f. */
function drawSun(g, cx, cy, f) {
  const card = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  const diag = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  const dirs = [card, [...card, ...diag], diag, [...card, ...diag]][f % 4];
  for (const [dx, dy] of dirs) { const off = (dx === 0 || dy === 0) ? 5 : 4; sSet(g, cx + dx * off, cy + dy * off); }
  sStamp(g, SUN_CORE, cx, cy);
}
/** Étoiles qui scintillent : chaque frame éteint un sous-ensemble différent. */
function drawStars(g, f) {
  STARS.forEach(([x, y], i) => { if ((i + f) % 3 !== 0) sSet(g, x, y); });
}

/** Corps céleste + phase (0..1) + libellé selon la tranche de 30 min (0..47). */
function scenePhase(slot) {
  const hour = (slot * 30 + 15) / 60; // milieu de la tranche
  if (hour >= SUN_RISE && hour < SUN_SET) {
    const t = (hour - SUN_RISE) / (SUN_SET - SUN_RISE);
    const label = t < 0.12 ? "Lever du soleil" : t < 0.4 ? "Matinée"
      : t < 0.6 ? "Plein midi" : t < 0.88 ? "Après-midi" : "Coucher du soleil";
    return { body: "sun", t, label };
  }
  const span = (24 - SUN_SET) + SUN_RISE; // durée de la nuit (heures)
  return { body: "moon", t: ((hour - SUN_SET + 24) % 24) / span, label: "Nuit" };
}

/** Construit les 4 frames de la scène pour une tranche horaire (label + balisage SVG). */
function sceneFrames(slot) {
  const { body, t, label } = scenePhase(slot);
  const cx = Math.round(SUN_X0 + t * (SUN_X1 - SUN_X0)); // large traversée : premier tiers gauche → droite
  const title = `<title>${label}</title>`;
  const frames = Array.from({ length: 4 }, (_, f) => {
    const g = sNew();
    if (body === "moon") {
      drawStars(g, f);
      sStamp(g, MOON_CORE, cx, Math.round(28 - 22 * Math.sin(Math.PI * t)));
    } else {
      drawSun(g, cx, Math.round(37 - 35 * Math.sin(Math.PI * t)), f);
    }
    fillRange(g, RIDGE); // montagnes par-dessus : le soleil se lève / couche derrière
    return title + sBake(g);
  });
  return { label, frames };
}

/**
 * Nom de la scène = tranche de 30 min (0..47). `DayGlyphAnimator` reconstruit la
 * scène à chaque changement de nom : la position des astres évolue donc toutes
 * les demi-heures, d'où une vraie progression au fil de la journée.
 */
export function dayGlyphName(date = new Date()) {
  return "sky:" + Math.floor((date.getHours() * 60 + date.getMinutes()) / 30);
}

/**
 * Frames d'animation de la scène (chacune = `<title>` + cercles SVG). Consommé
 * par `DayGlyphAnimator` pour le défilé image par image.
 */
export function dayGlyphFrames(name = dayGlyphName()) {
  const slot = Number(name.split(":")[1]);
  return sceneFrames(Number.isFinite(slot) ? slot : 24);
}

/** Scène dot-matrix (1ʳᵉ frame, pour le rendu initial avant animation). Ancrée en
 *  bas (montagnes affleurant le bas) ; `meet` ⇒ jamais rognée, le soleil reste
 *  toujours visible (l'éventuel surplus est du ciel vide, invisible sur l'accent). */
export function dayGlyph(name = dayGlyphName()) {
  const { frames } = dayGlyphFrames(name);
  return `<svg class="day-glyph" viewBox="0 0 ${SCENE_W} ${SCENE_H}" preserveAspectRatio="xMidYMax meet" ` +
    `fill="currentColor" aria-hidden="true">${frames[0]}</svg>`;
}

/** Remplit tous les `[data-icon]` d'un sous-arbre (icônes statiques du HTML). */
export function renderStaticIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((node) => {
    const size = node.dataset.iconSize ? Number(node.dataset.iconSize) : 18;
    node.innerHTML = node.dataset.dot === "true"
      ? dotIcon(node.dataset.icon, { size })
      : icon(node.dataset.icon, { size, solid: node.dataset.iconSolid === "true" });
  });
}
