// Version du service worker — `CACHE` dans sw.js.
//
//   node checks/cache.mjs          contrôle : sortie non nulle si un fichier
//                                  servi a changé sans que CACHE ait bougé
//   node checks/cache.mjs --fix    bumpe CACHE (stint-vN → stint-vN+1) si,
//                                  et seulement si, c'est nécessaire
//
// Pourquoi : la navigation est servie depuis le précache (CLAUDE.md §2). Un
// CACHE non bumpé = un déploiement INVISIBLE, quoi qu'on ait poussé — et
// l'oubli ne se voit qu'une fois en production.
//
// La référence est la branche déployée (`origin/master`, à défaut HEAD) : on
// compare l'arbre de travail — commits non poussés ET modifications non
// committées — à ce qui est en ligne. Le bump est donc IDEMPOTENT : relancer
// `--fix` après un premier bump ne rebumpe pas, puisque CACHE diffère déjà de
// la version en ligne. Un seul bump par livraison, quel que soit le nombre de
// commits.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const tryGit = (...args) => { try { return git(...args); } catch { return null; } };

/** Ce qui part chez l'utilisateur : tout le reste (checks/, .claude/, *.md) n'est pas servi. */
export const isServed = (p) =>
  p === "index.html" || p === "manifest.webmanifest" || p === "sw.js" ||
  p.startsWith("src/") || p.startsWith("assets/");

const readCache = (src) => src?.match(/const CACHE = "stint-v(\d+)";/)?.[1];

/** État de la version : base comparée, fichiers servis modifiés, CACHE en ligne / local. */
export function cacheState() {
  const base = tryGit("rev-parse", "--verify", "-q", "origin/master") ? "origin/master" : "HEAD";
  const changed = new Set([
    ...(tryGit("diff", "--name-only", base) ?? "").split("\n"),
    ...(tryGit("ls-files", "--others", "--exclude-standard") ?? "").split("\n"),
  ].filter(Boolean));
  const served = [...changed].filter(isServed);
  const local = readCache(readFileSync(join(ROOT, "sw.js"), "utf8"));
  const online = readCache(tryGit("show", `${base}:sw.js`)) ?? local;
  // sw.js modifié uniquement pour son CACHE ne compte pas comme un changement.
  const real = served.filter((p) => p !== "sw.js" || local === online);
  return { base, served: real, local: Number(local), online: Number(online), stale: real.length > 0 && local === online };
}

/** Bumpe CACHE d'un cran au-dessus de la version en ligne. Renvoie la nouvelle valeur. */
export function bumpCache(online) {
  const file = join(ROOT, "sw.js");
  const next = online + 1;
  writeFileSync(file, readFileSync(file, "utf8").replace(/const CACHE = "stint-v\d+";/, `const CACHE = "stint-v${next}";`));
  return next;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const s = cacheState();
  if (!s.stale) {
    console.log(s.served.length
      ? `✓ CACHE stint-v${s.local} (en ligne : v${s.online}) — ${s.served.length} fichier(s) servi(s) modifié(s)`
      : `✓ CACHE stint-v${s.local} — aucun fichier servi modifié depuis ${s.base}`);
  } else if (process.argv.includes("--fix")) {
    const v = bumpCache(s.online);
    console.log(`↑ CACHE bumpé : stint-v${s.online} → stint-v${v} (${s.served.length} fichier(s) servi(s) modifié(s) depuis ${s.base})`);
  } else {
    console.log(`✗ CACHE toujours à stint-v${s.local} alors que ${s.served.length} fichier(s) servi(s) ont changé depuis ${s.base} :`);
    for (const p of s.served.slice(0, 15)) console.log("    " + p);
    console.log("  → `node checks/cache.mjs --fix`");
    process.exitCode = 1;
  }
}
