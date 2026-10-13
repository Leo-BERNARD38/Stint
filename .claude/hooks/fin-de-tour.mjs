// Hook Stop : avant de rendre la main, on répare ce qui se répare seul et on
// vérifie le reste — mais seulement si le tour a touché au code.
//
//  1. rien de servi ni de contrôlé n'a changé depuis la version en ligne
//     (ni commit non poussé, ni modification) → on se tait ;
//  2. sinon `checks/tout.mjs --fix` : INVENTAIRE.md régénéré, CACHE bumpé s'il
//     le faut (idempotent : un seul bump par livraison), puis tous les
//     contrôles Node ;
//  3. échec → `decision: "block"` avec la sortie : Claude reprend la main pour
//     corriger au lieu d'annoncer « c'est fait ». Une réparation automatique
//     (bump, inventaire) est aussi signalée, pour qu'elle soit committée.
//
// `stop_hook_active` : si ce tour est DÉJÀ une reprise forcée par ce hook, on
// ne bloque plus (sinon boucle infinie sur un échec que Claude ne sait pas
// corriger) — on se contente d'un message à l'utilisateur.
import { readFileSync } from "node:fs";
import { spawnSync, execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.CLAUDE_PROJECT_DIR || join(dirname(fileURLToPath(import.meta.url)), "..", "..");
let input = {};
try { input = JSON.parse(readFileSync(0, "utf8") || "{}"); } catch { /* entrée vide : on continue */ }
const git = (...a) => { try { return execFileSync("git", a, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; } };

const base = git("rev-parse", "--verify", "-q", "origin/master") ? "origin/master" : "HEAD";
const touched = [
  ...git("diff", "--name-only", base).split("\n"),
  ...git("ls-files", "--others", "--exclude-standard").split("\n"),
].filter((p) => /^(src|assets|checks)\/|^(index\.html|sw\.js|manifest\.webmanifest)$/.test(p));
if (!touched.length) process.exit(0);

const before = git("status", "--porcelain", "--", "sw.js", "INVENTAIRE.md");
const r = spawnSync(process.execPath, [join(ROOT, "checks", "tout.mjs"), "--fix"], { cwd: ROOT, encoding: "utf8" });
const after = git("status", "--porcelain", "--", "sw.js", "INVENTAIRE.md");
const out = (r.stdout + r.stderr).trim();
const repaired = before !== after
  ? "Réparé automatiquement (à committer avec le reste) : " +
    out.split("\n").filter((l) => /CACHE bumpé|Inventaire régénéré/.test(l)).map((l) => l.replace(/^✓\s*/, "")).join(" ; ")
  : "";

if (r.status !== 0) {
  const msg = "Contrôles en échec (hook de fin de tour, `node checks/tout.mjs --fix`) :\n\n" + out.split("\n").slice(-30).join("\n");
  if (input.stop_hook_active) {
    console.log(JSON.stringify({ systemMessage: "⚠️ Stint : des contrôles échouent encore — voir `node checks/tout.mjs`." }));
  } else {
    console.log(JSON.stringify({ decision: "block", reason: msg + (repaired ? "\n\n" + repaired : "") }));
  }
  process.exit(0);
}
if (repaired && !input.stop_hook_active) {
  console.log(JSON.stringify({ decision: "block", reason: repaired + "\nTous les contrôles passent. Inclure ces fichiers dans le commit (ou le dire à l'utilisateur s'il n'y a pas de commit à faire)." }));
}
