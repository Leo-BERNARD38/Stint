/**
 * Chemins SVG pour les courbes de l'onglet Stats. Aucun DOM : des points
 * `{x, y}` en pixels entrent, une chaîne `d` sort — testable en Node.
 *
 * L'interpolation est une **spline cubique monotone** (Fritsch–Carlson) : sur
 * des séries en dents de scie (une journée à 0 h entre deux journées pleines)
 * une spline classique « déborderait » sous zéro et dessinerait du temps qui
 * n'existe pas. La version monotone garantit qu'entre deux points la courbe
 * reste comprise entre leurs deux valeurs.
 */

const r1 = (n) => Math.round(n * 10) / 10; // 1 décimale : chemins courts, précision suffisante

/** Polyligne simple (segments droits). */
export function linePath(pts) {
  if (!pts.length) return "";
  return pts.map((p, i) => `${i ? "L" : "M"}${r1(p.x)} ${r1(p.y)}`).join(" ");
}

/**
 * Tangentes monotones (Fritsch–Carlson) : pente en chaque point, ramenée à 0
 * aux extremums locaux et bridée pour ne jamais dépasser les valeurs voisines.
 */
function slopes(pts) {
  const n = pts.length;
  const dx = [], dy = [], m = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    dy[i] = pts[i + 1].y - pts[i].y;
    m[i] = dx[i] === 0 ? 0 : dy[i] / dx[i];
  }
  const t = new Array(n);
  t[0] = m[0] ?? 0;
  t[n - 1] = m[n - 2] ?? 0;
  for (let i = 1; i < n - 1; i++) {
    // Extremum local (la pente change de signe, ou un palier) ⇒ tangente plate.
    t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i];
    const h = Math.hypot(a, b);
    if (h > 3) { t[i] = (3 / h) * a * m[i]; t[i + 1] = (3 / h) * b * m[i]; }
  }
  return { t, dx };
}

/** Courbe lissée passant exactement par tous les points, sans dépassement. */
export function smoothPath(pts) {
  if (pts.length < 3) return linePath(pts);
  const { t, dx } = slopes(pts);
  let d = `M${r1(pts[0].x)} ${r1(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const c1x = pts[i].x + dx[i] / 3, c1y = pts[i].y + (t[i] * dx[i]) / 3;
    const c2x = pts[i + 1].x - dx[i] / 3, c2y = pts[i + 1].y - (t[i + 1] * dx[i]) / 3;
    d += ` C${r1(c1x)} ${r1(c1y)} ${r1(c2x)} ${r1(c2y)} ${r1(pts[i + 1].x)} ${r1(pts[i + 1].y)}`;
  }
  return d;
}

/**
 * Aire fermée entre une arête haute et une arête basse (déjà dans l'ordre des
 * x croissants toutes les deux) : la basse est parcourue à l'envers.
 */
export function areaPath(top, bottom, smooth = true) {
  if (!top.length || !bottom.length) return "";
  const draw = smooth ? smoothPath : linePath;
  // `back` commence par un « M » : on le remplace par un « L » pour rester dans
  // le même sous-chemin et fermer une seule aire.
  const back = draw([...bottom].reverse());
  return `${draw(top)} L${back.slice(1)} Z`;
}
