/**
 * Pack d'icônes — silhouettes Lucide (https://lucide.dev, licence ISC/MIT),
 * embarquées localement en SVG inline : aucun appel réseau, fonctionne
 * hors-ligne et se thème via `currentColor`. Source de vérité unique des icônes.
 */

const ICONS = {
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  square: '<rect x="4" y="4" width="16" height="16" rx="2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  "rotate-ccw": '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  copy: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  "chevron-left": '<path d="m15 18-6-6 6-6"/>',
  "chevron-right": '<path d="m9 18 6-6-6-6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
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
   Glyphe « moment de la journée » — un soleil qui parcourt un arc d'est en
   ouest selon l'heure (une position distincte par heure, de 6h à 20h), puis la
   lune la nuit. En points jointifs (r=0.5, comme les icônes) sur une grille
   13×13, au-dessus d'une ligne d'horizon. Points éteints = non dessinés.
   Vraie animation **image par image** : chaque glyphe fournit plusieurs frames
   (bitmaps) que `DayGlyphAnimator` fait défiler à bas FPS. Pas d'animation CSS.
   ============================================================================ */
const DAY_N = 13;
const SUN_HORIZON = 10;   // ligne de sol (rangée)
const SUN_DAY_START = 6;  // le soleil est visible de 6h…
const SUN_DAY_END = 20;   // …à 20h (au-delà : lune)

const gNew = () => Array.from({ length: DAY_N }, () => Array(DAY_N).fill(0));
const gDot = (g, x, y) => { if (x >= 0 && x < DAY_N && y >= 0 && y < DAY_N) g[y][x] = 1; };
const gDisc = (g, cx, cy, r) => {
  const r2 = r * r;
  for (let y = 0; y < DAY_N; y++) for (let x = 0; x < DAY_N; x++) {
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy <= r2) g[y][x] = 1;
  }
};
/** Bitmap (0/1) → balisage des cercles allumés (points jointifs). */
const gBake = (g) => {
  let b = "";
  for (let y = 0; y < DAY_N; y++) for (let x = 0; x < DAY_N; x++) {
    if (g[y][x]) b += `<circle cx="${x + 0.5}" cy="${y + 0.5}" r="0.5"/>`;
  }
  return b;
};

/**
 * Phase du jour (0 = lever, 0,5 = zénith, 1 = coucher) et libellé, dérivés de
 * l'heure. Le soleil parcourt un arc d'est en ouest : une position distincte par
 * tranche horaire, qu'on voit donc évoluer tout au long d'une journée de travail.
 */
function sunPhase(hour) {
  const mid = hour + 0.5; // milieu de la tranche horaire
  const t = Math.min(1, Math.max(0, (mid - SUN_DAY_START) / (SUN_DAY_END - SUN_DAY_START)));
  let label = "Après-midi";
  if (t < 0.12) label = "Lever du soleil";
  else if (t < 0.4) label = "Matinée";
  else if (t < 0.6) label = "Plein midi";
  else if (t >= 0.88) label = "Coucher du soleil";
  return { t, label };
}

/** Soleil plein sur un arc (est → ouest, haut au zénith) + rayons tournants, au-dessus
 *  d'une ligne d'horizon ; sous l'horizon est masqué (le soleil s'y lève / couche). */
function framesSunArc(t) {
  const cx = 2 + t * 8;                                    // est → ouest
  const cy = SUN_HORIZON - 2 - 5.5 * Math.sin(Math.PI * t); // bas au lever/coucher, haut au zénith
  const R = 2.2;
  const card = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  const diag = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  const ray = (g, dx, dy) => {
    const off = (dx === 0 || dy === 0) ? 3.4 : 2.5;
    gDot(g, Math.round(cx + dx * off), Math.round(cy + dy * off));
  };
  return [card, [...card, ...diag], diag, [...card, ...diag]].map((dirs) => {
    const g = gNew();
    gDisc(g, cx, cy, R);
    for (const [dx, dy] of dirs) ray(g, dx, dy);
    for (let x = 0; x < DAY_N; x++) for (let y = SUN_HORIZON; y < DAY_N; y++) g[y][x] = 0; // sous l'horizon
    for (let x = 1; x <= 11; x++) g[SUN_HORIZON][x] = 1;                                    // ligne de sol
    return g;
  });
}

/** Lune en croissant au-dessus de l'horizon + étoiles qui scintillent. */
function framesMoon() {
  const big = gNew(); gDisc(big, 5, 5, 3.9);
  const cut = gNew(); gDisc(cut, 7.8, 4.4, 4.0);
  const base = gNew();
  for (let y = 0; y < DAY_N; y++) for (let x = 0; x < DAY_N; x++) base[y][x] = (big[y][x] && !cut[y][x]) ? 1 : 0;
  for (let x = 1; x <= 11; x++) base[SUN_HORIZON][x] = 1; // ligne de sol (cohérence avec le jour)
  const star = [
    [[10, 8]],
    [[10, 8], [11, 4]],
    [[10, 8], [11, 4], [8, 2]],
    [[11, 4], [8, 2]],
  ];
  return star.map((dots) => {
    const g = base.map((r) => r.slice());
    for (const [x, y] of dots) gDot(g, x, y);
    return g;
  });
}

/**
 * Nom du glyphe selon l'heure : une position de soleil par heure le jour
 * (6h → 20h), la lune la nuit. Le nom encode la tranche horaire — l'animateur
 * reconstruit le glyphe à chaque changement d'heure, d'où l'évolution visible
 * au fil de la journée.
 */
export function dayGlyphName(date = new Date()) {
  const h = date.getHours();
  if (h < SUN_DAY_START || h >= SUN_DAY_END) return "moon";
  return "sun:" + h;
}

/**
 * Frames d'animation d'un glyphe : tableau de contenus SVG (chacun = `<title>` +
 * cercles). Consommé par `DayGlyphAnimator` pour le défilé image par image.
 */
export function dayGlyphFrames(name = dayGlyphName()) {
  if (name === "moon") {
    const title = "<title>Nuit</title>";
    return { label: "Nuit", frames: framesMoon().map((g) => title + gBake(g)) };
  }
  const hour = Number(name.split(":")[1]);
  const { t, label } = sunPhase(Number.isFinite(hour) ? hour : 12);
  const title = `<title>${label}</title>`;
  return { label, frames: framesSunArc(t).map((g) => title + gBake(g)) };
}

/** Glyphe dot-matrix du moment de la journée (1ʳᵉ frame, pour le rendu initial). */
export function dayGlyph(name = dayGlyphName(), { size = 52 } = {}) {
  const { frames } = dayGlyphFrames(name);
  return `<svg class="day-glyph" data-glyph="${name}" width="${size}" height="${size}" ` +
    `viewBox="0 0 ${DAY_N} ${DAY_N}" fill="currentColor" aria-hidden="true">${frames[0]}</svg>`;
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
