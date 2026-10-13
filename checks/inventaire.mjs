// Inventaire du code — GÉNÉRÉ, jamais écrit à la main.
//
//   node checks/inventaire.mjs          réécrit INVENTAIRE.md
//   node checks/inventaire.mjs --check  sortie non nulle s'il est périmé
//
// Pourquoi : les arborescences tenues à la main (CLAUDE.md, ARCHITECTURE.md)
// dérivaient à chaque fichier ajouté — on y citait des vues disparues depuis
// des mois, et un composant partagé absent de la liste n'existait pas pour qui
// la lisait : on le réécrivait à côté (trois sélecteurs de tâche différents en
// sont nés). L'inventaire se lit dans le code : la doc (`/** … */`) qui précède
// chaque export, et les titres de section des feuilles CSS. Un fichier sans
// doc s'y voit tout de suite.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "INVENTAIRE.md");

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const rel = (p) => relative(ROOT, p).split("\\").join("/");

/** Première phrase d'un bloc de commentaire, sans les `*`, bornée. */
function firstSentence(block) {
  const text = block
    .replace(/^\/\*\*?|\*\/$/g, "")
    .split("\n").map((l) => l.replace(/^\s*\*?\s?/, ""))
    // La description s'arrête aux balises (`@param` et leurs continuations).
    .reduce((acc, l) => (acc.stop || l.startsWith("@") ? { ...acc, stop: true } : { ...acc, lines: [...acc.lines, l] }), { lines: [], stop: false })
    .lines.join(" ")
    .replace(/\s+/g, " ").trim();
  // Une fin de phrase est suivie d'une majuscule : « (ex. URL Jira) » n'en est pas une.
  const m = text.match(/^(.+?[.!?])(?=\s+[A-ZÀ-ÝÉ«]|$)/);
  let s = (m ? m[1] : text).replace(/\.$/, "");
  if (s.length > 150) s = s.slice(0, 149).replace(/\s+\S*$/, "") + " …";
  return s.replace(/\|/g, "\\|");
}

/** Les exports d'un module, chacun avec la doc qui le précède immédiatement. */
function exportsOf(src) {
  const out = [];
  // Un bloc de doc ne contient pas de `*/` : sans ce garde, le motif paresseux
  // enjamberait du code jusqu'au commentaire d'un export plus bas.
  const re = /(\/\*\*(?:(?!\*\/)[\s\S])*\*\/)?\s*export\s+(?:default\s+)?(?:async\s+)?(class|function\*?|const|let)\s+([A-Za-z_$][\w$]*)/g;
  for (const m of src.matchAll(re)) {
    // La doc ne compte que si RIEN ne la sépare de l'export.
    out.push({ name: m[3], kind: m[2].startsWith("function") ? "fn" : m[2], doc: m[1] ? firstSentence(m[1]) : "" });
  }
  return out;
}

/**
 * La doc de tête d'un fichier, dans cet ordre :
 *  1. celle de l'export qui porte le nom du fichier (`Settings` dans Settings.js) ;
 *  2. son premier commentaire `/** … *\/` (avant ou après les imports), sauf
 *     s'il documente une déclaration privée — une fonction, une classe, ou une
 *     constante commentée d'une seule ligne ;
 *  3. la doc de son premier export documenté.
 */
function fileDoc(src, exps, base) {
  const named = exps.find((e) => e.name === base && e.doc);
  if (named) return named.doc;
  const top = src.match(/^\s*(?:import[^\n]*\n|\s)*(\/\*\*(?:(?!\*\/)[\s\S])*\*\/)\s*(\S+)/);
  const priv = top && (/^(async|function|class)$/.test(top[2]) || (!top[1].includes("\n") && /^(const|let)$/.test(top[2])));
  const own = top && !priv ? firstSentence(top[1]) : "";
  return own || exps.find((e) => e.doc)?.doc || "";
}

const GROUPS = [
  ["src/ui/components", "Composants partagés — à réutiliser avant d'en écrire un", "Factories et fonctions appelées par plusieurs vues. Un besoin qui ressemble à l'une de ces lignes passe par elle."],
  ["src/ui/views", "Vues", "Une vue = une région du DOM : `bind()` (une fois) + `render(viewDay)` + `anchor` (§3)."],
  ["src/ui/modals", "Modales", "Héritent de `Modal` (ouverture, `[data-close]`, clic hors carte)."],
  ["src/ui", "UI (contrôleur, boucles, icônes)", ""],
  ["src/models", "Modèles (domaine)", "Purs, testés dans `checks/domaine.mjs`."],
  ["src/services", "Services", ""],
  ["src/utils", "Utilitaires", "Fonctions pures sans état, réutilisables partout."],
  ["src/core", "Noyau", ""],
  ["src", "Entrée", ""],
];

function jsSection(files) {
  const lines = ["| Fichier | Rôle | Exporte |", "|---|---|---|"];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    const exps = exportsOf(src);
    const doc = fileDoc(src, exps, f.split(/[\\/]/).pop().replace(/\.js$/, "")) || "⚠️ *sans doc*";
    const names = exps.map((e) => "`" + e.name + (e.kind === "fn" ? "()" : "") + "`").join(", ") || "—";
    lines.push(`| \`${rel(f).replace(/^src\//, "")}\` | ${doc} | ${names} |`);
  }
  return lines.join("\n");
}

/** Le détail des exports documentés des composants partagés : c'est la liste qu'on doit lire avant d'écrire. */
function componentApi(files) {
  const out = [];
  for (const f of files) {
    const exps = exportsOf(readFileSync(f, "utf8"));
    if (exps.length < 2) continue;
    out.push(`- **${rel(f).split("/").pop()}**`);
    for (const e of exps) out.push(`  - \`${e.name}${e.kind === "fn" ? "()" : ""}\`${e.doc ? " — " + e.doc : ""}`);
  }
  return out.join("\n");
}

/** Les titres de section d'une feuille (`/* ---------- Titre ---------- *\/`), avec leur ligne. */
function cssSections(file) {
  const src = readFileSync(file, "utf8").split("\n");
  const out = [];
  src.forEach((l, i) => {
    const m = l.match(/^\/\*\s*-{3,}\s*(.+?)\s*-{3,}/);
    if (m) out.push(`  - l. ${i + 1} — ${m[1].replace(/\|/g, "\\|")}`);
  });
  return out;
}

function generate() {
  const all = walk(join(ROOT, "src")).filter((f) => f.endsWith(".js")).sort();
  const seen = new Set();
  const parts = [
    "# Inventaire du code",
    "",
    "> **Généré** par `node checks/inventaire.mjs` — ne pas éditer à la main.",
    "> `node checks/inventaire.mjs --check` échoue s'il est périmé (§9 de CLAUDE.md).",
    "> Le rôle d'un fichier est la première phrase de la doc de son premier export.",
    "",
    `${all.length} modules JS.`,
  ];
  for (const [dir, title, intro] of GROUPS) {
    const files = all.filter((f) => !seen.has(f) && dirname(rel(f)) === dir);
    if (!files.length) continue;
    files.forEach((f) => seen.add(f));
    parts.push("", `## ${title}`, "");
    if (intro) parts.push(intro, "");
    parts.push(jsSection(files));
    if (dir === "src/ui/components") {
      const api = componentApi(files);
      if (api) parts.push("", "API détaillée :", "", api);
    }
  }
  const rest = all.filter((f) => !seen.has(f));
  if (rest.length) parts.push("", "## Autres", "", jsSection(rest));

  parts.push("", "## Feuilles de style", "", "Sections de chaque feuille (titres `/* ---------- … ---------- */`). Chercher la classe existante avant d'en créer une.", "");
  const css = walk(join(ROOT, "assets/styles")).filter((f) => f.endsWith(".css")).sort();
  for (const f of css) {
    const secs = cssSections(f);
    parts.push(`- \`${rel(f)}\`${secs.length ? "" : " — sans sections"}`, ...secs);
  }
  return parts.join("\n") + "\n";
}

const text = generate();
if (process.argv.includes("--check")) {
  const cur = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (cur !== text) {
    console.error("INVENTAIRE.md est périmé : lancer `node checks/inventaire.mjs`.");
    process.exitCode = 1;
  } else console.log("INVENTAIRE.md à jour.");
} else {
  writeFileSync(OUT, text);
  console.log("INVENTAIRE.md réécrit.");
}
