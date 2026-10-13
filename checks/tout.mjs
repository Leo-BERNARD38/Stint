// Tous les contrôles Node, dans l'ordre, en une commande (≈ 2 s).
//
//   node checks/tout.mjs          tout contrôler
//   node checks/tout.mjs --fix    d'abord réparer ce qui se répare seul
//                                 (INVENTAIRE.md régénéré, CACHE bumpé si
//                                 nécessaire), puis tout contrôler
//
// C'est la commande à lancer avant un commit (CLAUDE.md §9) ; les hooks de
// .claude/ l'appellent aussi (fin de tour, avant un push). Ce qui demande un
// navigateur — captures, contraste — reste à part : checks/capture.mjs et
// checks/contraste.mjs.
import { readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fix = process.argv.includes("--fix");
const walk = (dir) => (existsSync(dir) ? readdirSync(dir) : []).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

function run(label, args, env = {}) {
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: "utf8", env: { ...process.env, ...env } });
  const out = (r.stdout + r.stderr).trim();
  return { label, ok: r.status === 0, out };
}

const results = [];

// 1. Syntaxe : tout module de l'app et des contrôles.
{
  const files = [...walk(join(ROOT, "src")), ...walk(join(ROOT, "checks")), ...walk(join(ROOT, ".claude"))]
    .filter((f) => /\.m?js$/.test(f));
  const bad = files.map((f) => ({ f, r: spawnSync(process.execPath, ["--check", f], { encoding: "utf8" }) }))
    .filter(({ r }) => r.status !== 0)
    .map(({ f, r }) => `${relative(ROOT, f)} : ${r.stderr.split("\n").find((l) => /Error/.test(l)) ?? "erreur de syntaxe"}`);
  results.push({ label: `Syntaxe (${files.length} fichiers)`, ok: !bad.length, out: bad.join("\n") });
}

// 2. Réparations automatiques, avant les contrôles qui les vérifient.
if (fix) {
  results.push(run("Inventaire régénéré", ["checks/inventaire.mjs"]));
  results.push(run("Version du service worker", ["checks/cache.mjs", "--fix"]));
} else {
  results.push(run("Version du service worker", ["checks/cache.mjs"]));
}

// 3. Contrôles statiques et domaine (UTC puis Paris : sans le second passage,
//    les bornes de jour et de période ne prouvent rien — §9).
results.push(run("Contrôles statiques", ["checks/statique.mjs"]));
results.push(run("Domaine (UTC)", ["checks/domaine.mjs"], { TZ: "UTC" }));
results.push(run("Domaine (Europe/Paris)", ["checks/domaine.mjs"], { TZ: "Europe/Paris" }));

let failed = 0;
for (const r of results) {
  const last = r.out.split("\n").filter(Boolean).at(-1) ?? "";
  console.log(`${r.ok ? "✓" : "✗"} ${r.label}${r.ok && last ? " — " + last.replace(/^[✓↑]\s*/, "") : ""}`);
  if (!r.ok) {
    failed++;
    // Seules les lignes en échec : la sortie complète noierait l'erreur.
    const lines = r.out.split("\n").filter((l) => /✗|ÉCHEC|FAIL|Error|échec|absent|périmé|→/.test(l));
    for (const l of (lines.length ? lines : r.out.split("\n")).slice(0, 25)) console.log("    " + l);
  }
}
console.log(failed ? `\n${failed} contrôle(s) en échec` : "\nTout passe.");
process.exitCode = failed ? 1 : 0;
