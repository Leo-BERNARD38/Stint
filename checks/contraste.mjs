// Audit de contraste WCAG sur le DOM RENDU (CLAUDE.md §7 et §9).
//
//   node checks/contraste.mjs                tous les écrans, deux thèmes
//   node checks/contraste.mjs stats saisie   seulement ces écrans
//   node checks/contraste.mjs --mobile       en 390 px de large
//
// Seuil : 4,5:1, ou 3:1 au-delà de 24 px. Attendu : ZÉRO défaut.
//
// Les jetons ne suffisent pas : le fond réel d'un texte dépend des surfaces
// empilées, des opacités d'ancêtres et parfois d'un pseudo-élément (le
// curseur des onglets). D'où, pour chaque élément porteur de texte :
//  - la couleur du texte, son alpha multiplié par l'`opacity` de TOUS ses
//    ancêtres (piège n° 1) ;
//  - la pile des fonds en remontant jusqu'au premier opaque, composée de bas
//    en haut ; un `::before`/`::after` positionné n'y entre que s'il COUVRE
//    le centre de l'élément (piège n° 2), `transform` compris (piège n° 3 —
//    sinon la pilule d'onglet est attribuée aux cinq onglets) ;
//  - toute couleur CSS (light-dark, color-mix, oklch…) est ramenée en sRGB
//    par un canvas : c'est le navigateur qui la résout, pas nous.
// Limites assumées : les images de fond (hachures) sont ignorées — une trame
// à 45° ne change pas le fond moyen —, les contrôles désactivés sont exemptés
// (WCAG 1.4.3), les placeholders aussi.
import { ROOT, SCREENS, serve, launch, openApp, seedDemo, showScreen } from "./navigateur.mjs";

const args = process.argv.slice(2);
const mobile = args.includes("--mobile");
const screens = args.filter((a) => !a.startsWith("--"));
const list = screens.length ? screens : SCREENS;
const unknown = list.filter((s) => !SCREENS.includes(s));
if (unknown.length) { console.error(`Écran(s) inconnu(s) : ${unknown.join(", ")}. Connus : ${SCREENS.join(" ")}`); process.exit(2); }
void ROOT;

/** Exécuté DANS la page : la liste des textes sous le seuil. */
function audit() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const rgba = (css) => {
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = "rgba(0,0,0,0)";
    cx.fillStyle = css;
    cx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = cx.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const over = (top, bottom) => {
    const a = top[3];
    return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1);
  };
  const lum = ([r, g, b]) => {
    const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

  /** Le rectangle d'un pseudo-élément positionné, transform compris (en pixels de page). */
  function pseudoRect(host, which) {
    const s = getComputedStyle(host, which);
    if (s.content === "none" || s.display === "none" || !/absolute|fixed/.test(s.position)) return null;
    const bg = rgba(s.backgroundColor);
    if (bg[3] === 0) return null;
    const hr = host.getBoundingClientRect();
    const w = parseFloat(s.width), h = parseFloat(s.height);
    let x = hr.left + (parseFloat(s.left) || 0) + host.clientLeft;
    let y = hr.top + (parseFloat(s.top) || 0) + host.clientTop;
    if (Number.isNaN(w) || Number.isNaN(h)) return null;
    const m = s.transform && s.transform !== "none" ? new DOMMatrix(s.transform) : null;
    if (m) { x += m.e; y += m.f; }
    return { x, y, w: w * (m ? m.a : 1), h: h * (m ? m.d : 1), bg };
  }

  const pageBg = (() => { const c = rgba(getComputedStyle(document.body).backgroundColor); return c[3] ? c : [255, 255, 255, 1]; })();

  function backgroundOf(el, cxp, cyp) {
    const layers = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const s = getComputedStyle(n);
      for (const which of ["::after", "::before"]) {
        const r = pseudoRect(n, which);
        if (r && cxp >= r.x && cxp <= r.x + r.w && cyp >= r.y && cyp <= r.y + r.h) {
          layers.push(r.bg);
          if (r.bg[3] >= 1) return layers.reverse().reduce((acc, l) => over(l, acc), pageBg);
        }
      }
      const c = rgba(s.backgroundColor);
      if (c[3] > 0) {
        layers.push(c);
        if (c[3] >= 1) break;
      }
    }
    return layers.reverse().reduce((acc, l) => over(l, acc), pageBg);
  }

  const visible = (el) => {
    if (el.closest("[hidden], [aria-hidden='true']")) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el);
    return s.visibility === "visible" && s.display !== "none";
  };
  const ownText = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
  const path = (el) => {
    const parts = [];
    for (let n = el; n && n !== document.body && parts.length < 3; n = n.parentElement) {
      parts.unshift(n.id ? `#${n.id}` : n.tagName.toLowerCase() + (n.classList.length ? "." + [...n.classList].slice(0, 2).join(".") : ""));
      if (n.id) break;
    }
    return parts.join(" > ");
  };

  const out = [];
  for (const el of document.body.querySelectorAll("*")) {
    if (/^(SCRIPT|STYLE|SVG|PATH|NOSCRIPT|TEMPLATE)$/i.test(el.tagName)) continue;
    const text = /^(INPUT|TEXTAREA)$/.test(el.tagName) && el.type !== "checkbox" && el.type !== "range" && el.type !== "color" ? el.value : ownText(el);
    if (!text) continue;
    if (el.closest(":disabled, [aria-disabled='true'], .idle")) continue;
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    let fg = rgba(s.color);
    let op = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) op *= parseFloat(getComputedStyle(n).opacity);
    if (op === 0 || fg[3] === 0) continue;
    const r = el.getBoundingClientRect();
    const bg = backgroundOf(el, r.left + r.width / 2, r.top + r.height / 2);
    fg = over([fg[0], fg[1], fg[2], fg[3] * op], bg);
    const px = parseFloat(s.fontSize);
    const need = px >= 24 ? 3 : 4.5;
    const got = ratio(fg, bg);
    if (got < need - 0.005) {
      const hex = (c) => "#" + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
      out.push({ where: path(el), text: text.slice(0, 40), ratio: Math.round(got * 100) / 100, need, fg: hex(fg), bg: hex(bg), px });
    }
  }
  return out;
}

const { server, url } = await serve();
const browser = await launch();
let total = 0;
try {
  for (const scheme of ["light", "dark"]) {
    const { page, close } = await openApp(browser, url, { scheme, width: mobile ? 390 : 1280 });
    await seedDemo(page);
    for (const s of list) {
      await showScreen(page, s);
      const bad = await page.evaluate(audit);
      total += bad.length;
      console.log(`${bad.length ? "✗" : "✓"} ${s} (${scheme === "light" ? "clair" : "sombre"})${bad.length ? ` — ${bad.length} défaut(s)` : ""}`);
      for (const b of bad.slice(0, 20)) {
        console.log(`    ${b.ratio}:1 < ${b.need}:1  « ${b.text} »  ${b.fg} sur ${b.bg}, ${b.px}px  — ${b.where}`);
      }
      if (bad.length > 20) console.log(`    … et ${bad.length - 20} de plus`);
    }
    await close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(total ? `\n${total} défaut(s) de contraste` : "\nZéro défaut de contraste.");
process.exitCode = total ? 1 : 0;
