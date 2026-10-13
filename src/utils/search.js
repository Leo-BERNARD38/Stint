/**
 * La recherche de tâche — UNE règle pour toutes les listes qui filtrent des
 * tâches (sélecteur des popovers et de la Reprise, champ de tâche, onglet
 * Tâches). Avant, chaque liste avait la sienne, à la casse près : « reunion »
 * ne trouvait pas « Réunion », et « mod 12 » ne trouvait pas « MOD-123 ».
 *
 * - casse et accents ignorés (« reunion » trouve « Réunion ») ;
 * - chaque mot de la requête doit apparaître, dans n'importe quel ordre
 *   (« client 12 » trouve « MOD-123 Support client »).
 */

/** Forme comparable d'un texte : minuscules, sans diacritiques, espaces réduits. */
export function searchKey(str) {
  return String(str ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

/** Les mots d'une requête, déjà normalisés ; `[]` pour une requête vide. */
export function queryTerms(query) {
  const k = searchKey(query);
  return k ? k.split(" ") : [];
}

/**
 * `true` si `text` contient tous les mots de `query`. `text` peut être déjà
 * normalisé (`searchKey`) : le re-normaliser ne change rien.
 */
export function matchesQuery(text, query) {
  const terms = Array.isArray(query) ? query : queryTerms(query);
  if (!terms.length) return true;
  const hay = searchKey(text);
  return terms.every((t) => hay.includes(t));
}
