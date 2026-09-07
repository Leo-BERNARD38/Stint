/**
 * Contrôles du DOMAINE, en Node ESM pur : ni DOM, ni IndexedDB. On teste les
 * règles (horaires, plages, formats, rappels), pas le rendu.
 *
 *   node checks/domaine.mjs
 */
import { Settings, mergeBlocks, blocksFromDay, dayFromBlocks, validateDay, offKey, normalizeOffLabel } from "../src/models/Settings.js";
import { Segment } from "../src/models/Segment.js";
import { StatsAggregator, periodStart, stepPeriod } from "../src/services/StatsAggregator.js";
import { Store } from "../src/models/Store.js";
import { SCHEMA_VERSION } from "../src/core/constants.js";
import { TimeCalculator } from "../src/services/TimeCalculator.js";
import { Formatter } from "../src/services/Formatter.js";
import { Reminders } from "../src/ui/Reminders.js";
import { countDays, eachDateKey, formatDateRange, parseDateInput, atTime, toLocalISO, fmtDateInput } from "../src/utils/datetime.js";

let failed = 0, total = 0;
function ok(cond, label) {
  total++;
  if (!cond) { failed++; console.log("  ÉCHEC  " + label); }
}
function eq(got, want, label) {
  ok(JSON.stringify(got) === JSON.stringify(want),
     `${label} — attendu ${JSON.stringify(want)}, obtenu ${JSON.stringify(got)}`);
}
function section(name) { console.log("\n· " + name); }

/** Persistance simulée : l'API que `Store` attend, sans navigateur. */
function fakePersistence() {
  return {
    saved: null,
    loadSync() { return null; },
    async init() {},
    async loadFull() { return null; },
    save(full) { this.saved = full; },
    async clear() { this.saved = null; },
  };
}

/* ------------------------------------------------------------------ §1 */
section("baseBlocks : la pause, et la fusion des créneaux jointifs");
{
  const s = new Settings();
  eq(s.baseBlocks(), [["08:30", "12:30"], ["13:30", "17:00"]], "pause nominale : deux créneaux");

  eq(new Settings({ lunch: false }).baseBlocks(), [["08:30", "17:00"]], "sans pause : un créneau continu");

  // L'encodage v10 de « pas de pause » : deux bornes collées. La fusion doit le
  // rattraper, sinon on annonce une pause déjeuner qui n'existe pas.
  const v10 = new Settings({ lunchStart: "12:30", lunchEnd: "12:30" });
  ok(v10.lunch === false, "v10 aux bornes collées se relit en lunch:false");
  eq(v10.baseBlocks(), [["08:30", "17:00"]], "bornes collées : UN créneau, pas deux jointifs");

  eq(new Settings({ arrival: "18:00", departure: "17:00" }).baseBlocks(), [], "départ avant arrivée : rien");
  eq(new Settings({ lunchStart: "07:00", lunchEnd: "08:00" }).baseBlocks(), [["08:30", "17:00"]],
     "pause hors journée : ignorée, journée entière");

  eq(mergeBlocks([["13:30", "17:00"], ["08:30", "12:30"]]), [["08:30", "12:30"], ["13:30", "17:00"]],
     "mergeBlocks trie");
  eq(mergeBlocks([["08:30", "12:30"], ["12:30", "17:00"]]), [["08:30", "17:00"]], "mergeBlocks fusionne les jointifs");
  eq(mergeBlocks([["09:00", "09:00"], ["10:00", "09:00"]]), [], "mergeBlocks jette les créneaux vides ou inversés");

  const b = new Settings({ arrival: "07:00", departure: "22:00", lunchStart: "12:00", lunchEnd: "13:00" }).baseBlocks();
  ok(b.every((p, i) => i === 0 || p[0] > b[i - 1][1]), "invariant : créneaux disjoints et croissants");
}

/* ------------------------------------------------------------------ §2 */
section("invariant Jira : les unités ne doivent PAS bouger");
{
  const s = new Settings();
  const store = { settings: s };
  eq(s.scheduleMinutesPerDay(), 450, "défauts : 450 min");
  eq(new Formatter(store).effHoursPerDay(), 7.5, "défauts : 1d = 7,5 h");

  const sc = new Settings({ lunch: false });
  eq(sc.scheduleMinutesPerDay(), 510, "journée continue 08:30–17:00 : 510 min");
  eq(new Formatter({ settings: sc }).effHoursPerDay(), 8.5, "journée continue : 1d = 8,5 h");

  const collé = new Settings({ lunchStart: "12:30", lunchEnd: "12:30" });
  eq(collé.scheduleMinutesPerDay(), sc.scheduleMinutesPerDay(), "bornes collées ≡ lunch:false, à la minute près");

  // `scheduleMinutesPerDay` lit la BASE seule, volontairement : « une journée »
  // au sens Jira, pas « aujourd'hui ». Une année de congés ne bouge pas 1d.
  const avecConges = new Settings();
  avecConges.setDateRange("2026-08-10", "2026-08-21", []);
  eq(avecConges.scheduleMinutesPerDay(), 450, "les exceptions de date ne touchent pas l'unité Jira");
}

/* ------------------------------------------------------------------ §3 */
section("blocksFor : la précédence sur les 3 niveaux");
{
  const s = new Settings({ weekdayHours: { 5: [["08:30", "12:50"]] } });
  s.setDateHours("2026-08-14", []);                      // un vendredi
  eq(s.blocksFor(parseDateInput("2026-08-10")), [["08:30", "12:30"], ["13:30", "17:00"]], "lundi → base");
  eq(s.blocksFor(parseDateInput("2026-08-07")), [["08:30", "12:50"]], "vendredi → jour de semaine");
  eq(s.blocksFor(parseDateInput("2026-08-14")), [], "date > jour de semaine");
  eq(s.blocksFor(parseDateInput("2026-08-08")), [], "samedi → non travaillé");

  s.setDateHours("2026-08-15", [["09:00", "12:00"]]);    // un samedi
  eq(s.blocksFor(parseDateInput("2026-08-15")), [["09:00", "12:00"]], "date > workDays");

  eq(s.scheduleFor(parseDateInput("2026-08-14")), [["08:30", "12:50"]],
     "scheduleFor ignore le niveau date (c'est tout son intérêt)");
}

/* ------------------------------------------------------------------ §4 */
section("setDateRange : l'expansion d'une période");
{
  const mk = () => new Settings();
  eq(countDays("2026-03-25", "2026-03-31"), 7, "changement d'heure : 7 jours, pas 6 (Math.round)");
  eq(eachDateKey("2026-12-30", "2027-01-02").length, 4, "année à cheval");

  const a = mk();
  eq(a.setDateRange("2026-08-10", "2026-08-21", []), 10, "12 jours calendaires → 10 jours ouvrés écrits");
  ok(!a.dateHours["2026-08-15"], "le samedi n'est PAS écrit");

  const b = mk();
  eq(b.setDateRange("2026-08-28", "2026-09-03", []), 5, "mois à cheval");
  const c = mk();
  eq(c.setDateRange("2026-12-28", "2027-01-03", []), 5, "année à cheval");
  const d = mk();
  eq(d.setDateRange("2026-03-25", "2026-03-31", []), 5, "plage enjambant le changement d'heure");

  const e = mk();
  eq(e.setDateRange("2026-08-10", "", []), 1, "`to` vide = ce jour-là seulement");

  for (const [args, raison] of [
    [["2026-08-21", "2026-08-10"], "range"],
    [["2026-01-01", "2027-06-01"], "too-long"],
    [["2026-08-08", "2026-08-09"], "empty"],
    [["2026-8-1", ""], "invalid"],
  ]) {
    const s = mk();
    eq(s.setDateRange(args[0], args[1], []), raison, `refus « ${raison} »`);
    eq(Object.keys(s.dateHours).length, 0, `refus « ${raison} » : RIEN d'écrit`);
  }

  const f = mk();
  f.setDateRange("2026-08-10", "2026-08-11", [["09:00", "17:00"]]);
  f.dateHours["2026-08-10"][0][0] = "10:00";
  eq(f.dateHours["2026-08-11"][0][0], "09:00", "copie par clé : pas d'aliasing entre les dates");

  const g = mk();
  g.setDateRange("2026-08-10", "2026-08-21", []);
  eq(g.setDateRange("2026-08-10", "2026-08-21", null), 12, "blocks null : la plage est retirée");
  eq(Object.keys(g.dateHours).length, 0, "plus rien après retrait");
}

/* ------------------------------------------------------------------ §5 */
section("dateGroups : le regroupement à l'affichage");
{
  const s = new Settings();
  s.setDateRange("2026-08-10", "2026-08-21", []);
  let g = s.dateGroups();
  eq(g.length, 1, "deux semaines de congés = UNE ligne (les week-ends sont enjambés)");
  eq([g[0].from, g[0].to, g[0].keys.length], ["2026-08-10", "2026-08-21", 10], "bornes et contenu du groupe");

  s.setDateRange("2026-08-14", "", [["09:00", "12:00"]]);
  eq(s.dateGroups().length, 3, "un planning différent au milieu coupe en trois");

  s.setDateRange("2026-08-14", "", null);
  g = s.dateGroups();
  eq(g.length, 2, "un jour travaillé SANS exception au milieu coupe aussi");
  eq([g[0].to, g[1].from], ["2026-08-13", "2026-08-17"], "bornes des deux morceaux");

  const solo = new Settings();
  solo.setDateRange("2026-08-12", "", []);
  eq(solo.dateGroups()[0].from === solo.dateGroups()[0].to, true, "date isolée : groupe d'un jour");

  const all = new Settings();
  all.setDateRange("2026-08-10", "2026-08-21", []);
  eq(all.dateGroups().flatMap((x) => x.keys), Object.keys(all.dateHours).sort(),
     "aller-retour : les groupes couvrent exactement les clés stockées");

  eq(formatDateRange("2026-08-10", "2026-08-21"), "du lun. 10 au ven. 21 août 2026", "libellé d'une période");
  eq(formatDateRange("2026-08-10", "2026-08-10"), "lun. 10 août 2026", "libellé d'un jour seul");
}

/* ------------------------------------------------------------------ §6 */
section("modification partielle d'une période");
{
  const s = new Settings();
  s.setDateRange("2026-08-10", "2026-08-21", []);
  const keys = s.dateGroups()[0].keys;
  eq(s.setDateRange("2026-08-10", "2026-08-14", [], { replacing: keys }), 5, "rétrécie à une semaine");
  const g = s.dateGroups();
  eq(g.length, 1, "toujours UNE période après rétrécissement");
  eq([g[0].from, g[0].to], ["2026-08-10", "2026-08-14"], "la période a bien rétréci, elle ne s'est pas dédoublée");

  const t = new Settings();
  t.setDateRange("2026-08-10", "2026-08-14", []);
  const k2 = t.dateGroups()[0].keys;
  t.setDateRange("2026-08-10", "2026-08-21", [], { replacing: k2 });
  eq(t.dateGroups()[0].to, "2026-08-21", "et elle s'étend aussi");
}

/* ------------------------------------------------------------------ §7 */
section("validation : une raison par cause");
{
  const jour = { worked: true, arrival: "09:00", departure: "17:00", lunch: true, lunchStart: "12:00", lunchEnd: "13:00" };
  eq(validateDay(jour), null, "journée valide");
  eq(validateDay({ ...jour, worked: false }), null, "jour non travaillé : rien à valider");
  eq(validateDay({ ...jour, arrival: "" }), "invalid", "heure absente");
  eq(validateDay({ ...jour, departure: "08:00" }), "order", "départ avant arrivée");
  eq(validateDay({ ...jour, lunchEnd: "11:00" }), "lunch-order", "fin de pause avant son début");
  eq(validateDay({ ...jour, lunchStart: "08:00" }), "lunch-outside", "pause hors de la journée");

  eq(blocksFromDay(jour), [["09:00", "12:00"], ["13:00", "17:00"]], "saisie → créneaux");
  eq(blocksFromDay({ ...jour, lunch: false }), [["09:00", "17:00"]], "sans pause → un créneau");
  const back = dayFromBlocks([["08:00", "10:00"], ["10:30", "12:00"], ["14:00", "17:00"]]);
  ok(back.extra === true, "3 créneaux : `extra` signale la perte à venir");
  eq([back.arrival, back.departure, back.lunchStart, back.lunchEnd], ["08:00", "17:00", "12:00", "14:00"],
     "3 créneaux : le plus grand trou devient la pause");

  // Régression : les trois raisons d'`addBreak`, le motif qu'on recopie.
  const s = new Settings();
  eq(s.addBreak({ time: "nope" }), "invalid", "addBreak : invalid");
  s.addBreak({ label: "Café", time: "10:00" });
  eq(s.addBreak({ label: "Thé", time: "10:00" }), "duplicate", "addBreak : duplicate");
}

/* ------------------------------------------------------------------ §8 */
section("migration v10 → v11 (Store, persistance simulée)");
{
  const brut = {
    version: 10,
    settings: { arrival: "08:30", lunchStart: "12:30", lunchEnd: "12:30", departure: "17:00" },
    tasks: [], segments: [], meta: {},
  };
  const store = new Store(fakePersistence());
  store.hydrate(JSON.parse(JSON.stringify(brut)));
  ok(store.settings.lunch === false, "v10 aux bornes collées → lunch:false");
  eq(store.version, SCHEMA_VERSION, "version réécrite au format courant");

  const store2 = new Store(fakePersistence());
  store2.hydrate({ ...brut, settings: { ...brut.settings, lunchEnd: "13:30" } });
  ok(store2.settings.lunch === true, "v10 normal → lunch:true");

  const store3 = new Store(fakePersistence());
  store3.hydrate(store.toJSON());
  ok(store3.settings.lunch === false, "ré-hydratation idempotente");
}

/* ------------------------------------------------------------------ §9 */
section("non-régression : TimeCalculator et Reminders");
{
  const jour = parseDateInput("2026-08-10");
  const continu = new Settings({ lunch: false });
  const store = { settings: continu, segments: [], segmentsForDay: () => [], taskById: () => null };
  const calc = new TimeCalculator(store);
  eq(calc.plannedMsForDay(jour), (17 * 60 + 0 - (8 * 60 + 30)) * 60000, "journée continue : planifié = départ − arrivée");
  eq(calc.workRangesForDay(jour).length, 1, "journée continue : une seule plage");
  eq(calc.gapsForDay(jour).length, 1, "journée continue sans segment : UN trou, pas deux");

  const avecPause = new TimeCalculator({ ...store, settings: new Settings() });
  eq(avecPause.gapsForDay(jour).length, 2, "avec pause : deux trous, de part et d'autre du déjeuner");

  // La pause déjeuner est le trou entre deux créneaux : sans pause, pas de rappel.
  const rem = new Reminders({
    store: { settings: continu }, calc, notifier: null, toast: null,
  });
  const kinds = (s) => rem.occurrencesFor(jour).map((o) => o.kind);
  continu.reminders.lunch = true;
  continu.reminders.dayEnd = true;
  eq(kinds(), ["dayEnd"], "journée continue : aucun rappel « déjeuner » fantôme");

  const s2 = new Settings();
  s2.reminders.lunch = true;
  s2.reminders.dayEnd = true;
  const rem2 = new Reminders({ store: { settings: s2 }, calc: new TimeCalculator({ ...store, settings: s2 }) });
  eq(rem2.occurrencesFor(jour).map((o) => o.kind), ["lunch", "dayEnd"], "avec pause : les deux rappels");
  eq(rem2.occurrencesFor(jour)[0].at, atTime(jour, "12:30").getTime(), "le déjeuner tombe au début du trou");
}

/* ----------------------------------------------------------------- §10 */
section("seuils du chrono : micro-pauses fusionnées, segments courts jetés (v12)");
{
  const ago = (ms) => toLocalISO(new Date(Date.now() - ms));
  const fresh = (segments = {}) => {
    const store = new Store(fakePersistence());
    store.hydrate({ version: 12, settings: { segments }, tasks: [], segments: [], meta: {} });
    return store;
  };

  // Défauts et bornes.
  const d = fresh();
  eq(d.settings.segments, { mergeGapMin: 2, minMin: 1 }, "v11 → v12 : défauts fournis");
  eq(fresh({ mergeGapMin: -5, minMin: 999 }).settings.segments, { mergeGapMin: 0, minMin: 15 },
     "valeurs absurdes ramenées dans les bornes");
  const back = new Store(fakePersistence());
  back.hydrate(fresh({ mergeGapMin: 7, minMin: 3 }).toJSON());
  eq(back.settings.segments, { mergeGapMin: 7, minMin: 3 }, "round-trip toJSON idempotent");

  // Un segment de 30 s mis en pause est jeté.
  const a = fresh();
  const t = a.startNew({ name: "A", type: "dev" });
  a.segments[0].start = ago(30_000);
  a.pause();
  eq(a.segments.length, 0, "pause sous la minute : le segment est jeté");
  ok(!a.activeSegment(), "…et plus rien ne tourne");

  // Seuil à 0 : tout est gardé.
  const z = fresh({ minMin: 0 });
  z.startNew({ name: "Z", type: "dev" });
  z.segments[0].start = ago(5_000);
  z.pause();
  eq(z.segments.length, 1, "minMin = 0 : un segment de 5 s est conservé");
  ok(!z.segments[0].isRunning, "…et il est bien fermé");

  // Terminer une tâche sur un segment court : jeté, mais la tâche est terminée.
  const c = fresh();
  const tc = c.startNew({ name: "C", type: "dev" });
  c.segments[0].start = ago(10_000);
  c.closeTask(tc.id);
  eq(c.segments.length, 0, "Terminer sur un segment court : jeté");
  ok(c.taskById(tc.id).done === true, "…mais la tâche est terminée");

  // Fusion : reprise à 60 s → même segment rouvert ; à 3 min → un second.
  const m = fresh();
  const tm = m.startNew({ name: "M", type: "dev" });
  m.segments[0].start = ago(20 * 60_000);
  m.pause();
  const id0 = m.segments[0].id;
  m.segments[0].end = ago(60_000);
  m.resume(tm.id);
  eq(m.segments.length, 1, "reprise à 60 s : aucun segment ajouté");
  ok(m.segments[0].id === id0 && m.segments[0].isRunning, "…le segment est rouvert");
  m.segments[0].start = ago(30 * 60_000);
  m.pause();
  m.segments[0].end = ago(3 * 60_000);
  m.resume(tm.id);
  eq(m.segments.length, 2, "reprise à 3 min : un second segment");

  const n = fresh({ mergeGapMin: 0 });
  const tn = n.startNew({ name: "N", type: "dev" });
  n.segments[0].start = ago(20 * 60_000);
  n.pause();
  n.segments[0].end = ago(10_000);
  n.resume(tn.id);
  eq(n.segments.length, 2, "mergeGapMin = 0 : jamais de fusion, même à 10 s");

  // Un segment jeté n'est plus « le dernier » : c'est celui d'avant qui compte.
  const p = fresh();
  const tp = p.startNew({ name: "P", type: "dev" });
  p.segments[0].start = ago(20 * 60_000);
  p.pause();
  p.segments[0].end = ago(90_000);
  p.resume(tp.id);                   // rouvre (90 s ≤ 2 min)
  eq(p.segments.length, 1, "reprise à 90 s : rouvert");
  const other = p.startNew({ name: "Q", type: "support" });   // ferme P (long), démarre Q
  p.segments.at(-1).start = ago(20_000);
  p.resume(tp.id);                   // Q (20 s) est jeté, P rouvert : son écart est nul
  eq(p.segments.length, 1, "bascule corrigée dans la foulée : Q jeté, P rouvert");
  ok(p.segments[0].taskId === tp.id && p.segments[0].isRunning, "…et c'est bien P qui tourne");
  ok(p.taskById(other.id) != null, "la tâche Q, elle, existe toujours");
}

/* ----------------------------------------------------------------- §11 */
section("fusionner / couper un segment");
{
  const iso = (h, m = 0) => toLocalISO(new Date(2026, 7, 10, h, m));
  const fresh = () => {
    const store = new Store(fakePersistence());
    store.hydrate({ version: 12, settings: { segments: { minMin: 0, mergeGapMin: 0 } },
      tasks: [{ id: "tA", name: "A", type: "dev", color: "#000" }, { id: "tB", name: "B", type: "dev", color: "#000" }],
      segments: [], meta: {} });
    return store;
  };
  const add = (store, taskId, s, e, raw = false) => {
    store.addSegment({ taskId, start: new Date(2026, 7, 10, ...s), end: e ? new Date(2026, 7, 10, ...e) : null, raw });
    return store.segments.at(-1).id;
  };

  // Fusion nominale : même tâche, adjacents (l'écart est absorbé), raw de A.
  const m = fresh();
  const a = add(m, "tA", [9, 0], [10, 0], true);
  const b = add(m, "tA", [10, 15], [11, 0]);
  eq(m.canMerge(a, b), null, "même tâche, rien entre : fusion possible");
  eq(m.mergeSegments(b, a), "merged", "ordre des ids indifférent");
  eq(m.segments.length, 1, "un seul segment après fusion");
  eq([m.segments[0].start, m.segments[0].end, m.segments[0].raw], [iso(9), iso(11), true],
     "[A.start, B.end], raw de A");

  // Refus : tâches différentes, tiers intercalé, ids inconnus.
  const r = fresh();
  const ra = add(r, "tA", [9, 0], [10, 0]);
  const rb = add(r, "tB", [10, 0], [11, 0]);
  eq(r.canMerge(ra, rb), "task", "tâches différentes : refusé");
  eq(r.mergeSegments(ra, rb), "task", "mergeSegments rend la même raison");
  eq(r.segments.length, 2, "…et ne touche à rien");
  const rc = add(r, "tA", [11, 0], [12, 0]);
  eq(r.canMerge(ra, rc), "blocked", "un segment s'intercale : refusé");
  eq(r.canMerge(ra, "nope"), "missing", "id inconnu : missing");
  eq(r.canMerge(ra, ra), "missing", "un segment avec lui-même : missing");

  // Fusion avec un segment en cours : le résultat court.
  const run = fresh();
  const ua = add(run, "tA", [9, 0], [10, 0]);
  run.segments.push(new (run.segments[0].constructor)({ id: "live", taskId: "tA", start: iso(10, 5), end: null }));
  eq(run.mergeSegments(ua, "live"), "merged", "fusion avec le segment en cours");
  ok(run.segments.length === 1 && run.segments[0].isRunning && run.segments[0].id === ua,
     "…A garde son id et tourne");
  eq(run.canMerge("nope2", ua), "missing", "après fusion, B n'existe plus");

  // Coupe : deux segments jointifs, même tâche, même raw, ids distincts.
  const c = fresh();
  const ca = add(c, "tA", [9, 0], [11, 0], true);
  const newId = c.splitSegment(ca, new Date(2026, 7, 10, 10, 0).getTime());
  ok(typeof newId === "string" && newId !== ca, "splitSegment rend l'id du nouveau");
  eq(c.segments.map((s) => [s.start, s.end, s.taskId, s.raw]),
     [[iso(9), iso(10), "tA", true], [iso(10), iso(11), "tA", true]], "deux moitiés jointives");
  eq(c.splitSegment(ca, new Date(2026, 7, 10, 9, 0).getTime()), "outside", "coupe au début : outside");
  eq(c.splitSegment(ca, new Date(2026, 7, 10, 12, 0).getTime()), "outside", "coupe après la fin : outside");
  eq(c.splitSegment("nope", 0), "missing", "coupe d'un inconnu : missing");
  // Coupe puis fusion = identité.
  eq(c.mergeSegments(ca, newId), "merged", "recoller les deux moitiés");
  eq([c.segments.length, c.segments[0].start, c.segments[0].end], [1, iso(9), iso(11)], "coupe ∘ fusion = identité");

  // Coupe d'un segment en cours : la moitié droite tourne.
  const l = fresh();
  l.segments.push(new (m.segments[0].constructor)({ id: "live2", taskId: "tA", start: toLocalISO(new Date(Date.now() - 3_600_000)), end: null }));
  const rid = l.splitSegment("live2", Date.now() - 1_800_000);
  ok(typeof rid === "string", "coupe d'un segment en cours acceptée");
  ok(!l.segments[0].isRunning && l.segments[1].isRunning && l.segments[1].id === rid,
     "…la gauche est fermée, la droite tourne");
  eq(l.activeSegment()?.id, rid, "activeSegment() est la moitié droite");

  // Voisins : toutes tâches confondues, par début.
  const v = fresh();
  const v1 = add(v, "tA", [9, 0], [10, 0]);
  const v2 = add(v, "tB", [10, 0], [11, 0]);
  const v3 = add(v, "tA", [11, 0], [12, 0]);
  eq([v.neighbours(v2).prev?.id, v.neighbours(v2).next?.id], [v1, v3], "neighbours : prev/next");
  eq([v.neighbours(v1).prev, v.neighbours(v3).next], [null, null], "neighbours : bords");
}

/* ----------------------------------------------------------------- §12 */
section("vides justifiés (hors tâche, v13)");
{
  // Réglages : épinglés, normalisation, raisons.
  const s = new Settings();
  eq(s.offReasons, ["Pause", "Réunion", "Discussion"], "trois motifs épinglés par défaut");
  eq(offKey("  Pause  "), "pause", "offKey : trim + minuscules");
  eq(normalizeOffLabel("  Dentiste   du   matin "), "Dentiste du matin", "normalizeOffLabel replie les espaces");
  eq(s.addOffReason("   "), "invalid", "addOffReason : vide → invalid");
  eq(s.addOffReason("pause"), "duplicate", "addOffReason : « pause » ≡ « Pause » → duplicate");
  eq(s.addOffReason("Dentiste"), "Dentiste", "addOffReason : rend le libellé normalisé");
  ok(s.isPinnedOff("DENTISTE"), "isPinnedOff insensible à la casse");
  s.removeOffReason("dentiste");
  ok(!s.isPinnedOff("Dentiste"), "removeOffReason par clé");
  for (let i = 0; i < 20; i++) s.addOffReason("Motif " + i);
  eq(s.offReasons.length, 12, "la liste est bornée à 12");
  eq(s.addOffReason("Encore"), "full", "…et refuse au-delà : full");
  eq(new Settings({ offReasons: [] }).offReasons, [], "une liste vidée reste vide (pas de retour aux défauts)");
  eq(new Settings({ offReasons: ["a", "A", " a "] }).offReasons, ["a"], "les doublons de clé sont fusionnés à l'hydratation");
  eq(new Settings(s.toJSON()).offReasons, s.offReasons, "round-trip toJSON");

  // Modèle : une tâche OU un motif.
  ok(Segment.fromJSON({ id: "x", taskId: "t1", start: "2026-08-10T09:00:00" }).isOff === false, "sans reason : une tâche");
  const off = Segment.fromJSON({ id: "y", taskId: "t1", reason: " Pause ", start: "2026-08-10T09:00:00", end: "2026-08-10T09:30:00" });
  ok(off.isOff && off.taskId === null && off.reason === "Pause", "avec reason : hors tâche, taskId nul, libellé trimé");
  eq(Segment.fromJSON({ id: "z", taskId: "t1", reason: "", start: "2026-08-10T09:00:00" }).isOff, false, "reason vide = tâche");

  // Store : addOffSegment, invariant, dernière tâche, fusion, coupe.
  const store = new Store(fakePersistence());
  store.hydrate({ version: 13, settings: { segments: { minMin: 0, mergeGapMin: 0 } },
    tasks: [{ id: "tA", name: "A", type: "dev", color: "#000" }], segments: [], meta: {} });
  const at = (h, m = 0) => new Date(2026, 7, 10, h, m);
  store.addSegment({ taskId: "tA", start: at(8, 30), end: at(12, 30) });
  eq(store.addOffSegment({ reason: "  ", start: at(13, 30), end: at(14) }), "invalid", "addOffSegment : motif vide refusé");
  eq(store.addOffSegment({ reason: "Dentiste", start: at(13, 30) }), "invalid", "addOffSegment : fin obligatoire");
  const o1 = store.addOffSegment({ reason: "Dentiste", start: at(13, 30), end: at(14) });
  ok(typeof o1 === "string", "addOffSegment rend l'id");
  ok(!store.settings.isPinnedOff("Dentiste"), "sans pin : pas épinglé");
  store.addOffSegment({ reason: "Veille techno", start: at(16), end: at(16, 30), pin: true });
  ok(store.settings.isPinnedOff("veille techno"), "pin: true épingle dans le même commit");
  store.addOffSegment({ reason: "PAUSE", start: at(16, 30), end: at(16, 45), pin: true });
  eq(store.settings.offReasons.filter((r) => offKey(r) === "pause").length, 1, "pin d'un doublon : ignoré, pas dédoublé");
  eq(store.lastUsedTask()?.id, "tA", "lastUsedTask ignore les hors tâche");
  store.updateSegment(o1, { taskId: "tA" });
  ok(store.segments.find((x) => x.id === o1).isOff, "updateSegment : taskId ignoré sur un hors tâche");
  store.updateSegment(o1, { reason: "" });
  eq(store.segments.find((x) => x.id === o1).reason, "Dentiste", "updateSegment : motif vide ignoré");
  store.updateSegment(o1, { reason: " dentiste " });
  eq(store.segments.find((x) => x.id === o1).reason, "dentiste", "updateSegment : motif normalisé");
  store.updateSegment(store.segments[0].id, { reason: "Pause" });
  ok(!store.segments[0].isOff, "updateSegment : reason ignoré sur une tâche");
  eq(store.canMerge(store.segments[0].id, o1), "task", "fusion tâche + hors tâche : refusée");
  const o2 = store.addOffSegment({ reason: "pause", start: at(16, 45), end: at(17) });
  const oPause = store.segments.find((x) => x.reason === "PAUSE").id;
  eq(store.mergeSegments(oPause, o2), "merged", "deux hors tâche « PAUSE »/« pause » : fusionnés");
  const half = store.splitSegment(o1, at(13, 45).getTime());
  eq(store.segments.find((x) => x.id === half).reason, "dentiste", "splitSegment recopie le motif");
  eq(store.mergeSegments(o1, half), "merged", "…et se recolle");

  // Calculs du jour : total / byTask sans le hors tâche, off à part, trous, couverture.
  const calc = new TimeCalculator(store);
  const day = at(0);
  const t = calc.totalsForDay(day);
  eq(t.total, 4 * 3_600_000, "total = 4 h de tâche (le hors tâche n'y est pas)");
  eq([...t.byTask.keys()], ["tA"], "byTask ne contient que la tâche");
  eq(t.off.total, 90 * 60_000, "off.total = 30 + 30 + 30 min");
  eq([...t.off.byReason.values()].map((r) => [r.label, r.ms / 60000]), [["dentiste", 30], ["Veille techno", 30], ["PAUSE", 30]],
     "off.byReason regroupe par clé, première graphie");
  // « PAUSE »/« pause » 16:30–17:00 fusionné en un seul : dans byReason aussi.
  eq(t.off.byReason.get("pause")?.ms, 30 * 60_000, "…et « pause » vaut 30 min en une entrée");
  eq(calc.gapsForDay(day).map(([a, b]) => [new Date(a).getHours() + ":" + new Date(a).getMinutes(), new Date(b).getHours() + ":" + new Date(b).getMinutes()]),
     [["14:0", "16:0"]], "un seul trou reste : 14:00 → 16:00 (les vides justifiés ne sont plus des trous)");
  eq(calc.coverageForDay(day), { workedMs: 4 * 3_600_000, offMs: 90 * 60_000, plannedMs: 450 * 60_000 },
     "coverageForDay : 4 h tracées, 1:30 hors tâche, 7:30 planifiées");
  ok(!calc.totalsForDay(day, true).off.byReason.has("nope") && calc.totalsForDay(day, true).off, "totalsForDay(rounded) transmet off");

  // Agrégats : kpi.offMs, couverture incluant le hors tâche, byTask sans lui.
  const nowDay = new Date();
  const s2 = new Store(fakePersistence());
  s2.hydrate({ version: 13, settings: { segments: { minMin: 0 } },
    tasks: [{ id: "tA", name: "A", type: "dev", color: "#000" }], segments: [], meta: {} });
  const y = new Date(nowDay); y.setDate(y.getDate() - 1);
  const yd = (h, m = 0) => { const d = new Date(y); d.setHours(h, m, 0, 0); return d; };
  s2.hydrate({ ...s2.toJSON(), settings: { ...s2.settings.toJSON(), workDays: [1, 2, 3, 4, 5, 6, 7] } });
  s2.addSegment({ taskId: "tA", start: yd(8, 30), end: yd(12, 30) });
  s2.addOffSegment({ reason: "Dentiste", start: yd(13, 30), end: yd(14) });
  s2.addOffSegment({ reason: "dentiste", start: yd(14), end: yd(14, 30) });
  const agg = new StatsAggregator(s2, new TimeCalculator(s2));
  const snapY = agg.snapshot("month", y.getTime()); // le mois contenant la veille
  const k = snapY.kpi;
  eq(k.total, 4 * 3_600_000, "kpi.total sans le hors tâche");
  eq(k.offMs, 60 * 60_000, "kpi.offMs = 1 h");
  eq(k.offByReason.map((r) => [r.key, r.ms / 60000]), [["dentiste", 60]], "kpi.offByReason : une entrée par clé");
  ok(Math.abs(k.coveragePct - (5 * 3_600_000 / k.scheduledMs) * 100) < 1e-6, "coveragePct inclut le hors tâche");
  ok(snapY.byTask.every((r) => r.task?.id === "tA"), "byTask des Stats sans le hors tâche");

  // Migration v12 → v13 : additive et idempotente.
  const m = new Store(fakePersistence());
  m.hydrate({ version: 12, settings: {}, tasks: [], segments: [{ id: "s1", taskId: "tX", start: "2026-08-10T09:00:00", end: "2026-08-10T10:00:00" }], meta: {} });
  ok(!m.segments[0].isOff && m.segments[0].taskId === "tX", "v12 : un segment sans reason reste une tâche");
  eq(m.settings.offReasons.length, 3, "v12 : motifs épinglés par défaut");
  const m2 = new Store(fakePersistence());
  m2.hydrate(m.toJSON());
  eq(m2.toJSON().segments, m.toJSON().segments, "ré-hydratation idempotente");
}

/* ----------------------------------------------------------------- §13 */
section("mémos (v14)");
{
  const store = new Store(fakePersistence());
  store.hydrate({ version: 14, settings: {}, tasks: [{ id: "tA", name: "A", type: "dev", color: "#000" }], segments: [], meta: {} });
  eq(store.memos, [], "v13 → v14 : memos vaut []");
  eq(store.addMemo({ text: "   " }), "invalid", "addMemo : texte vide → invalid");
  const g = store.addMemo({ text: "Relancer Paul" });
  ok(g && g.taskId === null, "mémo général : taskId nul");
  const a = store.addMemo({ text: "Écrire le test", taskId: "tA" });
  eq(a.taskId, "tA", "mémo rattaché à une tâche");
  const orphan = store.addMemo({ text: "Vers nulle part", taskId: "tZ" });
  eq(orphan.taskId, null, "tâche inconnue → mémo général");
  eq(store.openMemos().map((m) => m.text), ["Vers nulle part", "Écrire le test", "Relancer Paul"], "ouverts : les plus récents en haut");
  store.toggleMemo(orphan.id);
  eq(store.allMemos().map((m) => m.text), ["Écrire le test", "Relancer Paul", "Vers nulle part"], "les faits passent en bas");
  eq(store.openMemos().length, 2, "openMemos ignore les faits");
  eq(store.openMemoCountFor("tA"), 1, "openMemoCountFor");
  eq(store.memosFor("tA").map((m) => m.id), [a.id], "memosFor(tâche)");
  eq(store.memosFor(null).length, 2, "memosFor(null) = les généraux");
  store.updateMemo(a.id, { text: "  " });
  eq(store.memos.find((m) => m.id === a.id).text, "Écrire le test", "updateMemo : texte vide ignoré");
  store.updateMemo(a.id, { text: "x".repeat(500) });
  eq(store.memos.find((m) => m.id === a.id).text.length, 200, "updateMemo : texte borné à 200");
  const back = new Store(fakePersistence());
  back.hydrate(store.toJSON());
  eq(back.toJSON().memos, store.toJSON().memos, "round-trip JSON");
  const imp = new Store(fakePersistence());
  imp.hydrate({ version: 14, settings: {}, tasks: [], segments: [], memos: [{ id: "m1", text: "Seul", taskId: "tGone" }], meta: {} });
  eq(imp.memos[0].taskId, null, "import : un taskId inconnu est normalisé à null");
  store.deleteTask("tA");
  eq(store.memos.map((m) => m.text).sort(), ["Relancer Paul", "Vers nulle part"], "deleteTask emporte ses mémos");
  store.deleteMemo(g.id);
  eq(store.memos.length, 1, "deleteMemo");
  store.clearEntries();
  eq(store.memos, [], "clearEntries vide les mémos");
}

/* ----------------------------------------------------------------- §14 */
section("Stats calendaires (période, historique, découpage)");
{
  const at = (y, m, d) => new Date(y, m, d);

  // --- bornes de période : que du calendrier, jamais d'arithmétique en ms ---
  eq(fmtDateInput(periodStart("week", at(2026, 8, 10))), "2026-09-07", "semaine : le lundi ISO");
  eq(fmtDateInput(periodStart("week", at(2026, 8, 7))), "2026-09-07", "un lundi est son propre début de semaine");
  eq(fmtDateInput(periodStart("week", at(2026, 8, 13))), "2026-09-07", "dimanche : toujours la même semaine");
  eq(fmtDateInput(periodStart("month", at(2026, 8, 10))), "2026-09-01", "mois");
  eq(fmtDateInput(periodStart("quarter", at(2026, 8, 10))), "2026-07-01", "trimestre : T3 commence en juillet");
  eq(fmtDateInput(periodStart("quarter", at(2026, 0, 31))), "2026-01-01", "trimestre : T1");
  eq(fmtDateInput(periodStart("year", at(2026, 11, 31))), "2026-01-01", "année");

  // Un pas de mois ne déborde jamais : on part du 1er, pas d'un 31.
  eq(fmtDateInput(stepPeriod("month", at(2026, 0, 1), 1)), "2026-02-01", "janvier + 1 mois = février");
  eq(fmtDateInput(stepPeriod("month", at(2024, 1, 1), 1)), "2024-03-01", "février bissextile + 1 mois = mars");
  eq(fmtDateInput(stepPeriod("month", at(2026, 0, 1), -1)), "2025-12-01", "janvier - 1 mois = décembre de l'an d'avant");
  eq(fmtDateInput(stepPeriod("quarter", at(2026, 9, 1), 1)), "2027-01-01", "T4 + 1 = T1 de l'année suivante");
  eq(fmtDateInput(stepPeriod("year", at(2026, 0, 1), -3)), "2023-01-01", "année - 3");

  // Passage à l'heure d'été (Europe) : une semaine fait 7 jours, pas 7×24 h.
  // Sous TZ=Europe/Paris, le 29 mars 2026 ne dure que 23 h : un `+= DAY_MS`
  // ferait dériver la borne. Cf. CLAUDE.md §11.
  eq(fmtDateInput(stepPeriod("week", at(2026, 2, 23), 1)), "2026-03-30", "semaine suivante à cheval sur le changement d'heure");
  eq(fmtDateInput(stepPeriod("month", at(2026, 2, 1), 1)), "2026-04-01", "mars + 1 mois, malgré ses 30 jours et 23 h");
  ok(stepPeriod("quarter", at(2026, 0, 1), 1).getHours() === 0, "un pas de période reste à minuit local");

  // --- agrégats sur un mois entièrement écoulé ---
  const store = new Store(fakePersistence());
  store.hydrate({
    version: 14,
    settings: {
      workDays: [1, 2, 3, 4, 5, 6, 7], arrival: "09:00", departure: "17:00", lunch: false,
      segments: { minMin: 0, mergeGapMin: 0 },
    },
    tasks: [
      { id: "tA", name: "MOD-1", type: "dev", color: "#000" },
      { id: "tB", name: "MOD-2", type: "support", color: "#111" },
    ],
    segments: [], meta: {},
  });
  const H = 3_600_000;
  const now = new Date();
  // Un mois franchement passé : tous ses jours sont écoulés, donc
  // `scheduledMs` y vaut la journée planifiée entière (8 h × nb de jours).
  const anchor = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const D = (day, h, mn = 0) => {
    const d = new Date(anchor); d.setDate(day); d.setHours(h, mn, 0, 0); return d;
  };
  store.addSegment({ taskId: "tA", start: D(2, 9), end: D(2, 12) });          // 3 h
  store.addOffSegment({ reason: "Réunion", start: D(2, 13), end: D(2, 14) }); // 1 h hors tâche
  store.addSegment({ taskId: "tB", start: D(3, 10), end: D(3, 16) });          // 6 h
  store.addSegment({ taskId: "tA", start: D(4, 8), end: D(4, 22), raw: true }); // brut, déborde

  const agg = new StatsAggregator(store, new TimeCalculator(store));
  const ref = anchor.getTime();
  const snap = agg.snapshot("month", ref);
  const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();

  eq(snap.days.length, daysInMonth, "une entrée par jour du mois");
  eq(snap.range.prevLabel, agg.range("month", stepPeriod("month", anchor, -1).getTime()).label,
     "la période précédente est de même nature (le mois d'avant)");
  ok(snap.range.current === false, "un mois passé n'est pas la période courante");

  // Additivité : c'est la propriété qui fonde l'agrégateur.
  eq(snap.days.reduce((a, d) => a + d.ms, 0), snap.kpi.total, "Σ days.ms = kpi.total");
  const subs = snap.subPeriods();
  eq(subs.reduce((a, s) => a + s.ms, 0), snap.kpi.total, "Σ subPeriods.ms = kpi.total");
  eq(subs.reduce((a, s) => a + s.offMs, 0), snap.kpi.offMs, "Σ subPeriods.offMs = kpi.offMs");
  ok(subs.every((s) => s.unit === "week"), "un mois se découpe en semaines");
  ok(subs.length >= 4 && subs.length <= 6, "4 à 6 semaines touchent un mois");
  eq(snap.byTask.reduce((a, r) => a + r.ms, 0), snap.kpi.total, "Σ byTask = kpi.total (le hors tâche en est exclu)");

  // Le temps NON TRACÉ : ce que ni une tâche ni un motif ne couvre.
  eq(snap.kpi.total, (3 + 6 + 14) * H, "kpi.total : 3 h + 6 h + 14 h de brut");
  eq(snap.kpi.offMs, 1 * H, "kpi.offMs : la réunion");
  eq(snap.kpi.scheduledMs, daysInMonth * 8 * H, "scheduledMs : 8 h par jour, tous écoulés");
  const d2 = snap.days.find((d) => d.date.getDate() === 2);
  const d4 = snap.days.find((d) => d.date.getDate() === 4);
  const d5 = snap.days.find((d) => d.date.getDate() === 5);
  eq(d2.untrackedMs, 4 * H, "jour tracé à moitié : 8 h - 3 h - 1 h = 4 h non tracées");
  eq(d5.untrackedMs, 8 * H, "jour vide : toute la journée est non tracée");
  eq(d4.untrackedMs, 0, "un segment brut qui déborde des horaires ne rend pas le non-tracé négatif");
  eq(snap.kpi.untrackedMs, snap.days.reduce((a, d) => a + d.untrackedMs, 0),
     "kpi.untrackedMs se somme par jour, jamais sur les totaux");
  eq(snap.kpi.untrackedMs, (daysInMonth - 3) * 8 * H + 4 * H + 2 * H,
     "non tracé : les jours vides, plus les restes des jours 2 et 3");

  // --- historique de contexte ---
  const hist = snap.history(12);
  eq(hist.length, 12, "history(12) rend 12 périodes");
  ok(hist[11].current === true && hist.slice(0, 11).every((h) => !h.current),
     "la période courante est la dernière, et la seule");
  eq(hist[11].ms, snap.kpi.total, "la dernière tranche de l'historique = la période affichée");
  ok(hist.every((h, i) => i === 0 || h.start === hist[i - 1].end), "les tranches sont contiguës");
  eq(fmtDateInput(new Date(hist[0].start)), fmtDateInput(stepPeriod("month", anchor, -11)),
     "la plus ancienne est 11 périodes en arrière");

  // --- grain semaine : le découpage suit ---
  const wsnap = agg.snapshot("week", D(2, 12).getTime());
  eq(wsnap.days.length, 7, "une semaine fait 7 jours");
  eq(wsnap.subPeriods().length, 7, "une semaine se découpe en jours");
  ok(wsnap.subPeriods().every((s) => s.unit === "day"), "…en jours, pas en semaines");
  eq(wsnap.subPeriods().reduce((a, s) => a + s.ms, 0), wsnap.kpi.total, "Σ jours = total de la semaine");

  // --- grain trimestre et année : découpage en mois ---
  const qsnap = agg.snapshot("quarter", ref);
  eq(qsnap.subPeriods().length, 3, "un trimestre se découpe en 3 mois");
  ok(qsnap.kpi.total >= snap.kpi.total, "le trimestre contient le mois");
  eq(agg.snapshot("year", ref).subPeriods().length, 12, "une année se découpe en 12 mois");

  // --- le manque se MESURE (géométrie), il ne se déduit pas ---
  {
    const g = new Store(fakePersistence());
    g.hydrate({ version: 14, settings: {
      workDays: [1, 2, 3, 4, 5, 6, 7], arrival: "09:00", departure: "17:00", lunch: false,
      segments: { minMin: 0, mergeGapMin: 0 },
    }, tasks: [{ id: "tA", name: "A", type: "dev", color: "#000" }], segments: [], meta: {} });
    const gd = (day, h, mn = 0) => { const d = new Date(anchor); d.setDate(day); d.setHours(h, mn, 0, 0); return d; };
    // Deux segments qui se CHEVAUCHENT : 4 h comptées, mais seulement 3 h couvertes.
    g.addSegment({ taskId: "tA", start: gd(10, 9), end: gd(10, 11) });
    g.addSegment({ taskId: "tA", start: gd(10, 10), end: gd(10, 12) });
    const gcalc = new TimeCalculator(g);
    const gagg = new StatsAggregator(g, gcalc);
    const gday = gagg.snapshot("month", anchor.getTime()).days.find((d) => d.date.getDate() === 10);
    eq(gday.ms, 4 * H, "chevauchement : le temps compté reste additif (4 h)");
    eq(gday.untrackedMs, 5 * H, "…mais le non-tracé est géométrique : 8 h - 3 h couvertes = 5 h");
    ok(gday.ms + gday.untrackedMs !== gday.scheduledMs,
       "une soustraction `horaire - compté` aurait menti ici — c'est pourquoi on mesure");

    // Pas de seuil de 5 min : ce que la timeline ignore, la couverture le compte.
    const t = new Store(fakePersistence());
    t.hydrate({ ...g.toJSON(), segments: [] });
    t.addSegment({ taskId: "tA", start: gd(11, 9), end: gd(11, 12, 58) });
    t.addSegment({ taskId: "tA", start: gd(11, 13), end: gd(11, 17) });
    const tday = new StatsAggregator(t, new TimeCalculator(t))
      .snapshot("month", anchor.getTime()).days.find((d) => d.date.getDate() === 11);
    eq(tday.untrackedMs, 2 * 60_000, "un trou de 2 min compte dans le non-tracé…");
    eq(new TimeCalculator(t).gapsForDay(gd(11, 12)).length, 0, "…alors que la timeline l'ignore (seuil 5 min)");
  }

  // --- bornes de jour : `addDays`, jamais `+ DAY_MS` ---
  {
    // Le 25 octobre 2026 dure 25 h en Europe : `dayStart + DAY_MS` y tombait à
    // 23:00 du MÊME jour, et la dernière heure n'appartenait plus à aucun jour.
    const dst = new Store(fakePersistence());
    dst.hydrate({ version: 14, settings: {
      workDays: [1, 2, 3, 4, 5, 6, 7], arrival: "09:00", departure: "17:00", lunch: false,
      segments: { minMin: 0, mergeGapMin: 0 },
    }, tasks: [{ id: "tA", name: "A", type: "dev", color: "#000" }], segments: [], meta: {} });
    const late = (h, mn) => { const d = new Date(2026, 9, 25); d.setHours(h, mn, 0, 0); return d; };
    dst.addSegment({ taskId: "tA", start: late(23, 0), end: late(23, 59), raw: true });
    const dcalc = new TimeCalculator(dst);
    const dsnap = new StatsAggregator(dst, dcalc).snapshot("month", new Date(2026, 9, 15).getTime());
    eq(dsnap.days.length, 31, "octobre 2026 : 31 jours, malgré ses 25 h le 25");
    eq(dsnap.days.reduce((a, d) => a + d.ms, 0), dcalc.segmentMs(dst.segments[0], -Infinity, Infinity),
       "un segment de la 25ᵉ heure n'est ni perdu ni compté deux fois");
  }

  // --- mémoïsation : deux appels au même (grain, ref, rev) rendent le même objet ---
  ok(agg.snapshot("month", ref) === agg.snapshot("month", ref), "snapshot mémoïsé");
  ok(agg.snapshot("month", ref).subPeriods() === agg.snapshot("month", ref).subPeriods(),
     "subPeriods mémoïsé sur le snapshot");
  // …et un ref ailleurs dans la même période tombe sur le même cache.
  ok(agg.snapshot("month", D(17, 11).getTime()) === agg.snapshot("month", ref),
     "la clé de cache est le début de période, pas la date pointée");
  store.addSegment({ taskId: "tA", start: D(6, 9), end: D(6, 10) });
  ok(agg.snapshot("month", ref).kpi.total === (3 + 6 + 14 + 1) * H, "une mutation invalide le cache");
}

console.log(`\n${total - failed}/${total} contrôles passés`);
if (failed) process.exitCode = 1;
