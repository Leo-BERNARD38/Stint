/**
 * Cases FIXÉES d'un jour de SAISIE (§17). Un jour n'est pas figé en bloc : seules
 * les cases qu'on a touchées sont stockées, le reste du jour reste une
 * proposition qui suit le pointage. Une case fixée est `{ taskId, min, done, set }` :
 *   - `done` = cochée « saisi dans Jira » — sa durée ne bouge plus ;
 *   - `set`  = durée choisie à la main (modifiée, ajoutée, retirée) ;
 *   - `min: 0` = RETIRÉE : la tâche n'est pas déclarée ce jour-là, son temps
 *     attend en réserve.
 * Une case seulement cochée (`done` sans `set`) redevient une proposition quand
 * on la décoche : cocher n'était pas choisir une durée.
 *
 * Figer le jour entier au premier geste était la cause du « ça part en réserve
 * alors que je ne suis pas à 7 h » : cocher ou retoucher une case à midi gelait
 * la journée, et tout ce qu'on pointait ensuite filait en réserve.
 *
 * Fonctions pures : le Store les appelle pour normaliser ce qu'il stocke, les
 * vues pour préparer un geste qu'elles confient ensuite au Store. `pins` = les
 * cases fixées du jour, `shown` = les lignes AFFICHÉES (fixées + proposées), qui
 * donnent la durée d'une case proposée au moment où on la fixe. Aucune ne mute
 * son entrée.
 */

const copy = (pins) => pins.map((p) => ({ ...p }));
const pin = (taskId, min, done, set) => ({ taskId, min, done: !!done && min > 0, set: !!set });

/**
 * Range une liste de cases fixées : écarte les tâches inconnues et les durées
 * négatives ou illisibles, arrondit à la minute, garde les RETRAITS (`min: 0`)
 * et **fusionne les doublons** d'une même tâche (une tâche = une case par jour =
 * un worklog Jira). Une case fusionnée n'est saisie que si toutes ses parts
 * l'étaient (on ne coche pas à la place de l'utilisateur), et choisie à la main
 * dès qu'une part l'était.
 */
export function normalizeLines(lines, isKnown = () => true) {
  const out = [];
  const byTask = new Map();
  for (const l of Array.isArray(lines) ? lines : []) {
    if (!l || !l.taskId || !isKnown(l.taskId)) continue;
    const min = Math.round(Number(l.min));
    if (!Number.isFinite(min) || min < 0) continue;
    const cur = byTask.get(l.taskId);
    if (cur) {
      cur.min += min;
      cur.done = cur.done && !!l.done && cur.min > 0;
      cur.set = cur.set || !!l.set;
      continue;
    }
    const line = pin(l.taskId, min, l.done, l.set);
    byTask.set(l.taskId, line);
    out.push(line);
  }
  return out;
}

/**
 * Coche / décoche la case d'une tâche. Cocher fixe la durée affichée (c'est
 * elle qui est dans Jira) ; décocher une case seulement cochée la rend à la
 * proposition, décocher une case choisie à la main garde sa durée.
 */
export function toggleLine(pins, shown, taskId) {
  const cur = pins.find((p) => p.taskId === taskId);
  if (cur?.done) {
    return cur.set
      ? pins.map((p) => (p.taskId === taskId ? { ...p, done: false } : { ...p }))
      : copy(pins.filter((p) => p.taskId !== taskId));
  }
  if (cur) return pins.map((p) => (p.taskId === taskId ? { ...p, done: p.min > 0 } : { ...p }));
  const line = shown.find((l) => l.taskId === taskId);
  return line && line.min > 0 ? [...copy(pins), pin(taskId, line.min, true, false)] : copy(pins);
}

/** Coche (ou décoche) toutes les cases affichées, avec la règle de `toggleLine`. */
export function setAllDone(pins, shown, done) {
  let out = copy(pins);
  for (const l of shown) {
    const cur = out.find((p) => p.taskId === l.taskId);
    if (!!cur?.done === !!done) continue;
    if (done && !cur && l.min <= 0) continue;
    out = toggleLine(out, shown, l.taskId);
  }
  return out;
}

/**
 * Fixe la durée déclarée d'une tâche ce jour-là — « combien j'en loggue ». 0 (ou
 * moins) RETIRE la case : la tâche n'est pas déclarée ce jour-là, son temps
 * attend en réserve. Une durée CHANGÉE repasse la case à « à saisir » : le
 * worklog Jira n'est plus celui qu'on avait coché.
 */
export function setLine(pins, taskId, min) {
  const m = Math.max(0, Math.round(Number(min)));
  if (!taskId || !Number.isFinite(m)) return copy(pins);
  const cur = pins.find((p) => p.taskId === taskId);
  const next = pin(taskId, m, cur && cur.min === m ? cur.done : false, true);
  return cur ? pins.map((p) => (p.taskId === taskId ? next : { ...p })) : [...copy(pins), next];
}

/**
 * Ajoute `min` minutes à une tâche ce jour-là, en partant de sa case affichée
 * (fixée ou proposée) : la case devient choisie à la main et repasse « à
 * saisir » — le worklog Jira a changé.
 */
export function addToLine(pins, shown, taskId, min) {
  const add = Math.round(Number(min));
  if (!taskId || !Number.isFinite(add) || add <= 0) return copy(pins);
  const base = shown.find((l) => l.taskId === taskId)?.min ?? 0;
  return setLine(pins, taskId, base + add);
}

/** Rend la case d'une tâche à la proposition : elle suit de nouveau le pointage. */
export function releaseLine(pins, taskId) {
  return copy(pins.filter((p) => p.taskId !== taskId));
}
