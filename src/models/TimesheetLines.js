/**
 * Lignes d'un jour de SAISIE (§17) : ce qu'on déclare dans Jira ce jour-là,
 * tâche par tâche — `{ taskId, min, done }`. `done` = « saisi dans Jira ».
 *
 * Fonctions pures : le Store les appelle pour normaliser ce qu'il stocke, les
 * vues pour préparer une modification qu'elles confient ensuite au Store. Aucune
 * ne mute son entrée.
 */

/**
 * Range une liste de lignes : écarte les tâches inconnues et les durées nulles,
 * arrondit à la minute, et **fusionne les doublons** d'une même tâche (une tâche
 * = une ligne = un worklog Jira). Une ligne fusionnée n'est saisie que si
 * toutes ses parts l'étaient : on ne coche pas à la place de l'utilisateur.
 */
export function normalizeLines(lines, isKnown = () => true) {
  const out = [];
  const byTask = new Map();
  for (const l of Array.isArray(lines) ? lines : []) {
    if (!l || !l.taskId || !isKnown(l.taskId)) continue;
    const min = Math.round(Number(l.min));
    if (!Number.isFinite(min) || min <= 0) continue;
    const cur = byTask.get(l.taskId);
    if (cur) { cur.min += min; cur.done = cur.done && !!l.done; continue; }
    const line = { taskId: l.taskId, min, done: !!l.done };
    byTask.set(l.taskId, line);
    out.push(line);
  }
  return out;
}

/** Coche / décoche la ligne d'une tâche. */
export function toggleLine(lines, taskId) {
  return lines.map((l) => (l.taskId === taskId ? { ...l, done: !l.done } : { ...l }));
}

/** Coche (ou décoche) toutes les lignes. */
export function setAllDone(lines, done) {
  return lines.map((l) => ({ ...l, done: !!done }));
}

/** Retire la ligne d'une tâche (son temps retourne en réserve, par le calcul). */
export function removeLine(lines, taskId) {
  return lines.filter((l) => l.taskId !== taskId).map((l) => ({ ...l }));
}

/**
 * Ajoute `min` minutes à une tâche : à sa ligne si elle existe (qui redevient
 * alors « à saisir » — le worklog Jira a changé), sinon une ligne neuve en fin.
 */
export function addToLine(lines, taskId, min) {
  const add = Math.round(Number(min));
  if (!taskId || !Number.isFinite(add) || add <= 0) return lines.map((l) => ({ ...l }));
  let found = false;
  const out = lines.map((l) => {
    if (l.taskId !== taskId) return { ...l };
    found = true;
    return { ...l, min: l.min + add, done: false };
  });
  if (!found) out.push({ taskId, min: add, done: false });
  return out;
}
