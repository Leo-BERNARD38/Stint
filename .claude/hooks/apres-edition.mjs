// Hook PostToolUse (Edit | Write) : contrôle IMMÉDIAT du fichier qu'on vient
// d'écrire, pour corriger tant qu'on a encore le contexte en tête plutôt que
// de le découvrir en fin de tour.
//
//  - .js / .mjs        `node --check` (une erreur de syntaxe casse TOUTE l'app :
//                      un module ES qui ne parse pas emporte l'arbre d'imports) ;
//  - .json / manifest  JSON valide ;
//  - .css              accolades équilibrées, aucune couleur en dur hors
//                      variables.css (§7) ;
//  - nouveau fichier servi (src/, assets/) absent de `CORE` dans sw.js : il ne
//    serait jamais précaché, donc absent hors-ligne (§2) ;
//  - export public sans doc `/** … */` (fonction ou classe) : INVENTAIRE.md
//    le lit pour dire aux sessions suivantes à quoi il sert (§9) — simple
//    rappel, non bloquant.
//
// Erreur → code 2 et message sur stderr : Claude le lit et corrige. Le fichier
// n'est pas annulé, c'est un retour, pas un veto.
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, relative, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.CLAUDE_PROJECT_DIR || join(dirname(fileURLToPath(import.meta.url)), "..", "..");
let input = {};
try { input = JSON.parse(readFileSync(0, "utf8") || "{}"); } catch { process.exit(0); }
const file = input.tool_input?.file_path ?? input.tool_response?.filePath;
if (!file || !existsSync(file)) process.exit(0);
const rel = relative(ROOT, file).split("\\").join("/");
if (rel.startsWith("..")) process.exit(0); // hors du dépôt : pas notre affaire

const errors = [];
const notes = [];
const ext = extname(file);
const src = readFileSync(file, "utf8");

if (ext === ".js" || ext === ".mjs") {
  const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (r.status !== 0) errors.push(`Syntaxe invalide dans ${rel} :\n${r.stderr.trim().split("\n").slice(0, 6).join("\n")}`);
}

if (ext === ".json" || ext === ".webmanifest") {
  try { JSON.parse(src); } catch (e) { errors.push(`JSON invalide dans ${rel} : ${e.message}`); }
}

if (ext === ".css") {
  const s = src.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
  const open = (s.match(/\{/g) || []).length, close = (s.match(/\}/g) || []).length;
  if (open !== close) errors.push(`${rel} : ${open} « { » pour ${close} « } ».`);
  if (!/variables\.css$|fonts\.css$/.test(rel)) {
    s.split("\n").forEach((l, i) => {
      for (const m of l.matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab)\(/g)) {
        if (/^#fff(fff)?$/i.test(m[0]) || (/mask/.test(l) && m[0] === "#000")) continue;
        errors.push(`${rel}:${i + 1} : couleur en dur « ${m[0]} » — passer par un jeton de variables.css (§7).`);
      }
    });
  }
}

if (/^(src|assets)\//.test(rel) && /\.(js|css|woff2|png|svg)$/.test(rel)) {
  const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
  if (!sw.includes(`"./${rel}"`)) errors.push(`${rel} n'est pas dans CORE (sw.js) : il ne serait pas précaché, donc absent hors-ligne. L'ajouter (§2).`);
}

if (/^src\/.*\.js$/.test(rel)) {
  const L = src.split("\n");
  L.forEach((l, i) => {
    const m = l.match(/^export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|class)\s+(\w+)/);
    if (!m) return;
    let j = i - 1;
    while (j >= 0 && !L[j].trim()) j--;
    if (!(L[j] ?? "").trim().endsWith("*/")) notes.push(`${rel}:${i + 1} : \`${m[1]}\` est exporté sans doc /** … */ — sa première phrase est ce qu'INVENTAIRE.md dira de lui.`);
  });
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(2);
}
if (notes.length) {
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: notes.join("\n") } }));
}
