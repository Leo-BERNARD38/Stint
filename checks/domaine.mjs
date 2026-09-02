/**
 * Contrôles du DOMAINE, en Node ESM pur : ni DOM, ni IndexedDB. On teste les
 * règles (horaires, plages, formats, rappels), pas le rendu.
 *
 *   node checks/domaine.mjs
 */
import { Settings, mergeBlocks, blocksFromDay, dayFromBlocks, validateDay } from "../src/models/Settings.js";
import { Store } from "../src/models/Store.js";
import { TimeCalculator } from "../src/services/TimeCalculator.js";
import { Formatter } from "../src/services/Formatter.js";
import { Reminders } from "../src/ui/Reminders.js";
import { countDays, eachDateKey, formatDateRange, parseDateInput, atTime } from "../src/utils/datetime.js";

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
  eq(store.version, 11, "version réécrite au format courant");

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

console.log(`\n${total - failed}/${total} contrôles passés`);
if (failed) process.exitCode = 1;
