/**
 * Utilitaires de couleur — le strict nécessaire pour écrire du texte PAR-DESSUS
 * une couleur de tâche choisie librement par l'utilisateur.
 *
 * Les couleurs de tâche vivent dans les données (pas dans le CSS) : impossible
 * de décider en feuille de style si le libellé d'un segment doit être clair ou
 * sombre. On tranche donc ici, et la vue pose une classe — la couleur elle-même
 * reste définie dans `variables.css`, conformément à la règle du projet.
 */

/** `#abc` ou `#aabbcc` → [r, g, b] (0-255). Renvoie null si non reconnu. */
function parseHex(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** Luminance relative (WCAG 2.x). */
export function luminance(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Seuil de bascule clair/sombre. C'est le point d'équilibre des contrastes WCAG
 * entre un texte blanc et un texte encre (#131a20) : au-delà, l'encre l'emporte.
 *   1.05 / (L + .05) = (L + .05) / (L_encre + .05)  ⟹  L ≈ 0.198
 * Calculé plutôt que tâtonné : la palette de tâches est libre, le seuil doit
 * donc valoir pour n'importe quelle couleur, pas seulement pour la nôtre.
 */
const SWITCH = 0.198;

/** Classe à poser sur un bloc coloré : `on-dark` (texte clair) ou `on-light`. */
export function onColorClass(hex) {
  return luminance(hex) > SWITCH ? "on-light" : "on-dark";
}
