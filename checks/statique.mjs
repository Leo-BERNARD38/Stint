// Contrôles statiques (§9 de CLAUDE.md) — ce qui se vérifie sans navigateur.
//
//   node checks/statique.mjs
//
// Ils étaient décrits en prose et refaits à la main, donc différemment, à
// chaque session. Sortie non nulle si l'un échoue.
//  - IDs : tout `el("x")` / `super("x")` (modales) a son `id="x"` dans index.html ;
//  - icônes : tout `data-icon="x"` (HTML) et tout `icon("x")` / `dotIcon("x")`
//    littéral (JS) existe dans `ICONS` / `DOT_GLYPHS` ;
//  - CSS : accolades équilibrées, tout `var(--x)` défini dans variables.css,
//    aucune couleur en dur hors variables.css (exception documentée : `#fff`) ;
//  - plancher Bitcount : aucune règle `--font-display` sous 16 px ;
//  - service worker : tout fichier servi est dans `CORE`, `CORE` ne cite aucun
//    fichier disparu ;
//  - inventaire : INVENTAIRE.md est à jour (cf. checks/inventaire.mjs).
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const rel = (p) => relative(ROOT, p).split("\\").join("/");

let failed = 0;
function report(name, problems) {
  if (problems.length) {
    failed++;
    console.log(`✗ ${name}`);
    for (const p of problems.slice(0, 30)) console.log("    " + p);
    if (problems.length > 30) console.log(`    … et ${problems.length - 30} de plus`);
  } else console.log(`✓ ${name}`);
}

const html = read("index.html");
const jsFiles = walk(join(ROOT, "src")).filter((f) => f.endsWith(".js"));
const js = Object.fromEntries(jsFiles.map((f) => [rel(f), readFileSync(f, "utf8")]));
const cssFiles = walk(join(ROOT, "assets/styles")).filter((f) => f.endsWith(".css"));
const css = Object.fromEntries(cssFiles.map((f) => [rel(f), readFileSync(f, "utf8")]));

/* --- IDs ------------------------------------------------------------------ */
{
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const probs = [];
  for (const [f, src] of Object.entries(js)) {
    for (const m of src.matchAll(/\b(?:el|super)\("([A-Za-z][\w-]*)"\)/g)) {
      if (!ids.has(m[1])) probs.push(`${f} : #${m[1]} absent d'index.html`);
    }
  }
  report("IDs : tout el(\"x\") existe dans index.html", probs);
}

/* --- Icônes --------------------------------------------------------------- */
{
  const src = js["src/ui/icons.js"];
  const block = (name) => {
    const start = src.indexOf(`const ${name} = {`);
    let depth = 0, i = src.indexOf("{", start);
    const from = i;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}" && --depth === 0) break;
    }
    return src.slice(from, i);
  };
  // Clés de premier niveau seulement (indentation de deux espaces).
  const keys = (b) => new Set([...b.matchAll(/^ {2}(?:"([^"]+)"|([\w-]+))\s*:/gm)].map((m) => m[1] ?? m[2]));
  const ICONS = keys(block("ICONS"));
  const DOTS = keys(block("DOT_GLYPHS"));
  const probs = [];
  for (const m of html.matchAll(/<[^>]*\sdata-icon="([^"]+)"[^>]*>/g)) {
    const dot = /data-dot="true"/.test(m[0]);
    if (!(dot ? DOTS : ICONS).has(m[1])) probs.push(`index.html : data-icon="${m[1]}"${dot ? " (dot)" : ""} inconnu`);
  }
  for (const [f, s] of Object.entries(js)) {
    for (const m of s.matchAll(/\b(icon|dotIcon)\("([\w-]+)"/g)) {
      if (!(m[1] === "dotIcon" ? DOTS : ICONS).has(m[2])) probs.push(`${f} : ${m[1]}("${m[2]}") inconnu`);
    }
  }
  report(`Icônes : ${ICONS.size} Lucide + ${DOTS.size} dot-matrix, toutes celles citées existent`, probs);
}

/* --- CSS ------------------------------------------------------------------ */
{
  const vars = css["assets/styles/variables.css"];
  const defined = new Set([...vars.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  // Les variables posées par le JS (style="--x:…") ou localement dans une règle comptent aussi.
  for (const s of [...Object.values(css), html, ...Object.values(js)]) {
    for (const m of s.matchAll(/(--[\w-]+)\s*:/g)) defined.add(m[1]);
    for (const m of s.matchAll(/setProperty\(\s*"(--[\w-]+)"/g)) defined.add(m[1]);
  }
  const braces = [], undef = [], colors = [], bitcount = [];
  for (const [f, raw] of Object.entries(css)) {
    const s = raw.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
    const open = (s.match(/\{/g) || []).length, close = (s.match(/\}/g) || []).length;
    if (open !== close) braces.push(`${f} : ${open} { pour ${close} }`);
    const lines = s.split("\n");
    lines.forEach((l, i) => {
      for (const m of l.matchAll(/var\((--[\w-]+)/g)) {
        if (!defined.has(m[1])) undef.push(`${f}:${i + 1} : ${m[1]} n'est défini nulle part`);
      }
      if (f !== "assets/styles/variables.css" && f !== "assets/styles/fonts.css") {
        for (const m of l.matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab)\(/g)) {
          if (/^#fff(fff)?$/i.test(m[0])) continue; // blanc sur aplat minium plein (§7)
          if (/mask/.test(l) && /^#000$/.test(m[0])) continue; // un masque n'est pas une couleur : seul l'alpha compte
          colors.push(`${f}:${i + 1} : ${m[0]}`);
        }
      }
    });
    // Plancher Bitcount : une règle qui pose --font-display ne descend pas sous 16 px.
    for (const m of s.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/font-family:\s*var\(--font-display\)/.test(m[2])) continue;
      for (const px of m[2].matchAll(/font-size:\s*([\d.]+)px/g)) {
        if (Number(px[1]) < 16) bitcount.push(`${f} : « ${m[1].trim().slice(0, 60)} » en ${px[1]} px`);
      }
    }
  }
  report("CSS : accolades équilibrées", braces);
  report("CSS : toute var(--x) est définie", undef);
  report("CSS : aucune couleur en dur hors variables.css", colors);
  report("CSS : plancher de 16 px sur Bitcount", bitcount);
}

/* --- Service worker -------------------------------------------------------- */
{
  const sw = read("sw.js");
  const core = new Set([...sw.slice(sw.indexOf("const CORE")).split("];")[0].matchAll(/"\.\/([^"]*)"/g)].map((m) => m[1]));
  const served = [
    ...walk(join(ROOT, "src")), ...walk(join(ROOT, "assets")),
  ].map(rel).filter((p) => /\.(js|css|woff2|png|svg)$/.test(p));
  const probs = [];
  for (const p of served) if (!core.has(p)) probs.push(`${p} absent de CORE`);
  for (const p of core) if (p && !existsSync(join(ROOT, p))) probs.push(`CORE cite ${p}, qui n'existe pas`);
  report(`Service worker : CORE = fichiers servis (${core.size} entrées)`, probs);
}

/* --- Inventaire ------------------------------------------------------------ */
{
  let probs = [];
  try {
    execFileSync(process.execPath, [join(ROOT, "checks/inventaire.mjs"), "--check"], { stdio: "pipe" });
  } catch {
    probs = ["INVENTAIRE.md est périmé : lancer `node checks/inventaire.mjs`"];
  }
  report("Inventaire : INVENTAIRE.md à jour", probs);
}

console.log(failed ? `\n${failed} contrôle(s) en échec` : "\nTous les contrôles statiques passent");
if (failed) process.exitCode = 1;
