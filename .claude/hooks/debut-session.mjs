// Hook SessionStart : un état des lieux injecté dans le contexte de Claude.
//
// Ce que chaque session redécouvrait à la main (branche, retard sur la
// version en ligne, CACHE, fichiers en cours) et les réflexes du projet
// qu'on oublie le plus (inventaire, contrôles, CACHE). Rien n'est installé :
// l'app n'a aucune dépendance, et Node suffit aux contrôles.
//
// Sortie standard = contexte ajouté à la session. Jamais d'échec bloquant :
// un état des lieux incomplet vaut mieux qu'une session qui ne démarre pas.
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.CLAUDE_PROJECT_DIR || join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const git = (...a) => { try { return execFileSync("git", a, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; } };

const lines = ["## État de Stint au démarrage (hook .claude/hooks/debut-session.mjs)", ""];
const branch = git("branch", "--show-current") || "(détaché)";
const hasRemote = !!git("rev-parse", "--verify", "-q", "origin/master");
const ahead = hasRemote ? git("rev-list", "--count", "origin/master..HEAD") : "?";
const behind = hasRemote ? git("rev-list", "--count", "HEAD..origin/master") : "?";
lines.push(`- Branche : \`${branch}\` — ${ahead} commit(s) non déployé(s), ${behind} de retard sur \`origin/master\` (la branche déployée).`);

const dirty = git("status", "--porcelain").split("\n").filter(Boolean);
if (dirty.length) lines.push(`- Arbre de travail : ${dirty.length} fichier(s) modifié(s) — ${dirty.slice(0, 6).map((l) => l.replace(/^\s*\S+\s+/, "")).join(", ")}${dirty.length > 6 ? "…" : ""}`);

try {
  const { cacheState } = await import(join(ROOT, "checks", "cache.mjs"));
  const s = cacheState();
  lines.push(`- Service worker : \`CACHE = stint-v${s.local}\` (en ligne : v${s.online})${s.stale ? " — ⚠️ fichiers servis modifiés SANS bump : `node checks/cache.mjs --fix`" : ""}.`);
} catch { /* contrôle indisponible : on n'en dit rien */ }

const log = git("log", "--oneline", "-5");
if (log) lines.push("- Derniers commits :", ...log.split("\n").map((l) => "  - " + l));

lines.push(
  "",
  "Réflexes du projet (détail : CLAUDE.md) :",
  "- Avant de créer un fichier, un composant ou un motif : lire `INVENTAIRE.md` (généré) et la table « Composants partagés » de CLAUDE.md §3 — étendre l'existant plutôt que d'en refaire un.",
  "- Avant de committer : `node checks/tout.mjs --fix` (syntaxe, statique, domaine UTC + Paris, inventaire, CACHE). Le hook de fin de tour le lance aussi.",
  "- Rendu : `node checks/capture.mjs [écrans]` (PNG clair + sombre dans captures/) et `node checks/contraste.mjs` (attendu : zéro défaut).",
  "- Skills du projet : `/verifier`, `/capture`, `/livrer`.",
);
console.log(lines.join("\n"));
