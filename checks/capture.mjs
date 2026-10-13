// Captures de l'app, en clair et en sombre — et les erreurs JS de chaque écran.
//
//   node checks/capture.mjs                       tous les écrans, deux thèmes
//   node checks/capture.mjs journee stats         seulement ces écrans
//   node checks/capture.mjs --mobile              en 390 px de large
//   node checks/capture.mjs --vide                sans données de démonstration
//   node checks/capture.mjs --sortie dossier      (défaut : captures/, ignoré par git)
//
// Écrans : journee segments saisie taches stats settings guide tools.
// Sortie non nulle si une erreur JS ou console est apparue : une capture
// propre d'un écran qui a planté à moitié ne prouve rien.
//
// Je (Claude) ne peux pas juger le rendu autrement qu'en lisant ces PNG :
// tout changement visuel se valide AUSSI par l'utilisateur (CLAUDE.md §9).
import { mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { ROOT, SCREENS, serve, launch, openApp, seedDemo, showScreen } from "./navigateur.mjs";

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : null; };
const flag = (name) => { const i = args.indexOf(name); if (i >= 0) args.splice(i, 1); return i >= 0; };
const outDir = join(ROOT, opt("--sortie") ?? "captures");
const mobile = flag("--mobile");
const empty = flag("--vide");
const screens = args.length ? args : SCREENS;
const unknown = screens.filter((s) => !SCREENS.includes(s));
if (unknown.length) { console.error(`Écran(s) inconnu(s) : ${unknown.join(", ")}. Connus : ${SCREENS.join(" ")}`); process.exit(2); }

mkdirSync(outDir, { recursive: true });
const { server, url } = await serve();
const browser = await launch();
let failed = 0;
try {
  for (const scheme of ["light", "dark"]) {
    const { page, errors, close } = await openApp(browser, url, { scheme, width: mobile ? 390 : 1280, height: mobile ? 844 : 900 });
    if (!empty) await seedDemo(page);
    for (const s of screens) {
      const before = errors.length;
      await showScreen(page, s);
      const file = join(outDir, `${s}-${scheme === "light" ? "clair" : "sombre"}${mobile ? "-mobile" : ""}.png`);
      await page.screenshot({ path: file, fullPage: true });
      const errs = errors.slice(before);
      console.log(`${errs.length ? "✗" : "✓"} ${relative(ROOT, file)}`);
      for (const e of errs) console.log("    " + e);
      failed += errs.length;
    }
    await close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(failed ? `\n${failed} erreur(s) JS pendant les captures` : "\nAucune erreur JS.");
process.exitCode = failed ? 1 : 0;
