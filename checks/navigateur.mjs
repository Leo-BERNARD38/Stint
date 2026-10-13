// Aides partagées des contrôles qui ont besoin d'un navigateur (capture.mjs,
// contraste.mjs). Pas une dépendance de l'app : Playwright est cherché là où
// l'environnement l'a installé (global npm, /opt/node-tools des sessions
// cloud), et Chromium est celui préinstallé.
//
// Trois pièges qu'elles évitent une fois pour toutes (CLAUDE.md §9) :
//  - le service worker sert cache d'abord → contexte VIERGE, SW bloqué ;
//  - Chromium headless se croit tactile → `--blink-settings` de survol ;
//  - une transition en cours fausse les couleurs → animations coupées.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Les écrans de l'app : les cinq onglets et les trois pages pleines. */
export const SCREENS = ["journee", "segments", "saisie", "taches", "stats", "settings", "guide", "tools"];

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml",
  ".png": "image/png", ".woff2": "font/woff2",
};

/** Sert le dépôt en HTTP sur un port libre (les modules ES refusent file://). */
export function serve() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (p.endsWith("/")) p += "index.html";
      const file = normalize(join(ROOT, p));
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      try {
        const body = await readFile(file);
        res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
        res.end(body);
      } catch { res.writeHead(404).end(); }
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/` }));
  });
}

/** Playwright, où qu'il soit installé ; une erreur claire sinon. */
function loadPlaywright() {
  const roots = [ROOT, "/opt/node-tools"];
  try { roots.push(execSync("npm root -g", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()); } catch { /* pas de npm */ }
  for (const r of roots) {
    try { return createRequire(join(r, "noop.js"))("playwright"); } catch { /* suivant */ }
    try { return createRequire(join(r, "node_modules", "noop.js"))("playwright"); } catch { /* suivant */ }
  }
  throw new Error("Playwright introuvable (ni local, ni global, ni /opt/node-tools). `npm i -g playwright` hors du dépôt — jamais dans package.json : l'app n'a pas de dépendance.");
}

/** Lance Chromium avec le survol simulé (sinon on photographie la variante tactile). */
export async function launch() {
  const { chromium } = loadPlaywright();
  const exe = ["/opt/pw-browsers/chromium/chrome-linux/chrome", "/opt/pw-browsers/chromium"].find((p) => existsSync(p) && extname(p) === "");
  return chromium.launch({
    ...(process.env.PLAYWRIGHT_BROWSERS_PATH ? {} : exe ? { executablePath: exe } : {}),
    args: ["--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4"],
  });
}

/**
 * Ouvre l'app dans un contexte vierge, service worker bloqué, animations
 * coupées. Renvoie `{ page, errors }` — `errors` collecte les erreurs JS et
 * console pendant toute la vie de la page.
 */
export async function openApp(browser, url, { scheme = "light", width = 1280, height = 900 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme, serviceWorkers: "block", reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.stint && !document.body.classList.contains("booting"));
  await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important}" });
  return { page, errors, close: () => ctx.close() };
}

/**
 * Une semaine de données plausibles (dev, support, autre, une terminée, un
 * hors tâche, un mémo), pour que chaque écran ait quelque chose à montrer.
 * Passe par les commandes du Store, comme un utilisateur.
 */
export async function seedDemo(page) {
  await page.evaluate(() => {
    const app = window.stint, s = app.store;
    const day = (d, h, m = 0) => { const x = new Date(); x.setDate(x.getDate() - d); x.setHours(h, m, 0, 0); return x; };
    const mk = (name, type) => { s.startNew({ name, type }); return s.activeTask(); };
    const a = mk("MOD-123 Refonte export", "dev");
    const b = mk("SUP-88 Client Dupré", "support");
    const c = mk("Réunion d'équipe", "autre");
    const d = mk("MOD-140 Bug de fuseau", "dev");
    s.pause();
    for (let k = 4; k >= 1; k--) {
      s.addSegment({ taskId: a.id, start: day(k, 8, 30), end: day(k, 11, 0) });
      s.addSegment({ taskId: b.id, start: day(k, 11, 10), end: day(k, 12, 30) });
      s.addSegment({ taskId: k % 2 ? d.id : a.id, start: day(k, 13, 30), end: day(k, 16, 15) });
    }
    s.addSegment({ taskId: c.id, start: day(0, 8, 45), end: day(0, 9, 30) });
    s.addSegment({ taskId: a.id, start: day(0, 9, 40), end: day(0, 11, 5) });
    s.addOffSegment?.({ reason: "Pause", start: day(0, 11, 5), end: day(0, 11, 20) });
    s.closeTask(c.id);
    s.addMemo?.({ text: "Relancer la revue de MOD-123", taskId: a.id });
    s.resume(d.id);
  });
}

/** Affiche un écran (onglet de l'app ou page pleine) et attend son rendu. */
export async function showScreen(page, name) {
  await page.evaluate((n) => {
    const app = window.stint;
    if (["settings", "guide", "tools"].includes(n)) app.showScreen(n);
    else { app.showScreen("app"); app.tabs.select(n); }
  }, name);
  await page.waitForTimeout(150);
}
