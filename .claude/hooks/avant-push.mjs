// Hook PreToolUse (Bash, filtré sur `git push`) : un push sur `master` EST un
// déploiement (GitHub Pages). On n'y laisse partir que ce qui passe
// `checks/tout.mjs` — CACHE bumpé compris, sans quoi la nouvelle version
// resterait invisible chez l'utilisateur (§2).
//
// Refus = `permissionDecision: "deny"` avec la raison : Claude la lit, corrige,
// et relance le push. Un push forcé vers master est refusé d'office : il
// réécrirait l'historique de ce qui est en ligne.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.CLAUDE_PROJECT_DIR || join(dirname(fileURLToPath(import.meta.url)), "..", "..");
let input = {};
try { input = JSON.parse(readFileSync(0, "utf8") || "{}"); } catch { process.exit(0); }
const cmd = input.tool_input?.command ?? "";
if (!/\bgit\s+push\b/.test(cmd)) process.exit(0);

const deny = (reason) => {
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } }));
  process.exit(0);
};

if (/(--force\b|--force-with-lease\b|\s-f\b|\s\+\S*master)/.test(cmd) && /master/.test(cmd)) {
  deny("Push forcé vers master refusé : master est la version en ligne, on n'en réécrit pas l'historique. Faire un commit correctif.");
}

const r = spawnSync(process.execPath, [join(ROOT, "checks", "tout.mjs")], { cwd: ROOT, encoding: "utf8" });
if (r.status !== 0) {
  deny(
    "Contrôles en échec — push bloqué (un push sur master déploie). Corriger, committer, puis relancer.\n" +
    "Astuce : `node checks/tout.mjs --fix` répare seul l'inventaire et le CACHE.\n\n" +
    (r.stdout + r.stderr).trim().split("\n").slice(-30).join("\n"),
  );
}
// Tout passe : on laisse le flux de permissions normal décider.
