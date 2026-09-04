/**
 * Service worker de Stint — rend l'app installable, hors-ligne et **cohérente** :
 * une version = un cache complet, jamais de panachage ancien HTML / vieux CSS.
 * Stratégies :
 *   - install : précache de TOUTES les ressources en contournant le cache HTTP
 *     (`cache: "reload"`, GitHub Pages sert avec un max-age de 10 min) ;
 *   - assets même origine : cache d'abord (on sert la version précachée, le
 *     réseau ne sert qu'aux ressources oubliées de CORE) ;
 *   - navigation : app shell EN CACHE d'abord, réseau en repli seulement. Le
 *     réseau d'abord semblait plus sûr : il ne l'était pas. `fetch()` consulte le
 *     cache HTTP, et GitHub Pages sert avec `max-age=600` — pendant dix minutes
 *     après un déploiement, la navigation renvoyait donc l'ANCIEN index.html
 *     depuis le disque, pendant que les assets, eux, venaient du précache de la
 *     NOUVELLE version (rempli avec `cache:"reload"`). Vieux HTML + CSS/JS neufs :
 *     exactement le panachage que ce fichier prétend interdire, et la seule raison
 *     pour laquelle il fallait un Ctrl+F5. Le précache, lui, contient l'index.html
 *     de SA version : servi d'abord, la cohérence est garantie, et c'est la mise à
 *     jour du service worker (et elle seule) qui fait passer à la version
 *     suivante ;
 *   - polices : auto-hébergées et précachées (CORE) → servies cache-d'abord
 *     comme les autres assets même origine, aucune requête tierce ;
 *   - nouvelle version : purge de l'ancien cache, prise de contrôle, puis la
 *     page se recharge une fois sur "controllerchange" (voir main.js).
 * Bumper CACHE à chaque release ; ajouter à CORE tout nouveau fichier servi.
 */
const CACHE = "stint-v109";
const NAV_TIMEOUT_MS = 2500;
/* Racine de l'application (sw.js est à côté d'index.html) : « /Stint/ » sur
   GitHub Pages, « / » ailleurs. Sert à ne réclamer QUE les navigations de
   l'app — une autre page servie par le même hôte ne doit pas recevoir sa
   coquille. */
const SCOPE = new URL("./", self.location.href).pathname;

const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/apple-touch-icon.png",
  "./assets/styles/variables.css",
  "./assets/styles/base.css",
  "./assets/styles/layout.css",
  "./assets/styles/components.css",
  "./assets/styles/fonts.css",
  "./assets/fonts/bitcount-latin.woff2",
  "./assets/fonts/bitcount-latin-ext.woff2",
  "./assets/fonts/archivo-latin.woff2",
  "./assets/fonts/plexsans-latin.woff2",
  "./assets/fonts/plexsans-latin-ext.woff2",
  "./assets/fonts/plexmono-400-latin.woff2",
  "./assets/fonts/plexmono-400-latin-ext.woff2",
  "./assets/fonts/plexmono-500-latin.woff2",
  "./assets/fonts/plexmono-500-latin-ext.woff2",
  "./src/main.js",
  "./src/core/EventEmitter.js",
  "./src/core/constants.js",
  "./src/models/Segment.js",
  "./src/models/Settings.js",
  "./src/models/Store.js",
  "./src/models/Task.js",
  "./src/models/Memo.js",
  "./src/services/DataTransfer.js",
  "./src/services/Formatter.js",
  "./src/services/Notifier.js",
  "./src/services/Persistence.js",
  "./src/services/StatsAggregator.js",
  "./src/services/StorageInfo.js",
  "./src/services/TimeCalculator.js",
  "./src/ui/App.js",
  "./src/ui/BgDots.js",
  "./src/ui/Chime.js",
  "./src/ui/DayGlyphAnimator.js",
  "./src/ui/EyeBreak.js",
  "./src/ui/Reminders.js",
  "./src/ui/Timer.js",
  "./src/ui/icons.js",
  "./src/ui/components/CopyButton.js",
  "./src/ui/components/FillPopover.js",
  "./src/ui/components/ScheduleEditor.js",
  "./src/ui/components/TimelineTip.js",
  "./src/ui/components/Toast.js",
  "./src/ui/components/MemoList.js",
  "./src/ui/modals/EditTaskModal.js",
  "./src/ui/modals/Modal.js",
  "./src/ui/modals/SegmentModal.js",
  "./src/ui/modals/NewTaskModal.js",
  "./src/ui/modals/ResumeModal.js",
  "./src/ui/views/AllTasksView.js",
  "./src/ui/views/DayNavView.js",
  "./src/ui/views/DayTotalView.js",
  "./src/ui/views/HeaderView.js",
  "./src/ui/views/HeroView.js",
  "./src/ui/views/SegmentTableView.js",
  "./src/ui/views/SettingsView.js",
  "./src/ui/views/StatsBreakdownView.js",
  "./src/ui/views/StatsHeatmapView.js",
  "./src/ui/views/StatsTimelineView.js",
  "./src/ui/views/StatsTrendView.js",
  "./src/ui/views/StatsWeeksView.js",
  "./src/ui/views/StatsView.js",
  "./src/ui/views/StorageView.js",
  "./src/ui/views/TabsView.js",
  "./src/ui/views/TaskListView.js",
  "./src/ui/views/ThemeView.js",
  "./src/ui/views/TimelineView.js",
  "./src/ui/views/ToolsView.js",
  "./src/ui/views/TotalsView.js",
  "./src/ui/views/MemoPanelView.js",
  "./src/utils/clipboard.js",
  "./src/utils/color.js",
  "./src/utils/datetime.js",
  "./src/utils/curve.js",
  "./src/utils/dom.js",
  "./src/utils/intervals.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // "reload" : on remplit le cache depuis le réseau, pas depuis le cache HTTP
      // (sinon un déploiement récent peut précacher… l'ancienne version).
      .then((cache) => cache.addAll(CORE.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Clic sur un rappel « repos des yeux » : on ramène l'onglet Stint au premier
// plan (ou on l'ouvre s'il a été fermé) plutôt que d'ouvrir un doublon.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of clientsList) {
      if (c.url.startsWith(self.registration.scope) && "focus" in c) return c.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow("./");
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Navigations : app shell précaché d'abord (ouverture instantanée ET cohérente
  // avec les assets de la même version), réseau seulement s'il manque — première
  // visite, ou cache purgé par le navigateur. Voir l'en-tête du fichier : c'est
  // ici que se jouait le « il faut faire Ctrl+F5 après un déploiement ».
  if (req.mode === "navigate") {
    // Une seule page dans cette app : sa racine et son index.html. Toute autre
    // navigation dans la portée (une page voisine posée sur le même hôte) part
    // au réseau sans que le service worker s'en mêle.
    const path = url.pathname;
    if (path !== SCOPE && path !== SCOPE + "index.html") return;
    event.respondWith((async () => {
      const shell = await caches.match("./index.html", { cacheName: CACHE });
      if (shell) return shell;
      try {
        return await Promise.race([
          fetch(req),
          new Promise((_, reject) => setTimeout(() => reject(new Error("nav timeout")), NAV_TIMEOUT_MS)),
        ]);
      } catch (e) {
        return (await caches.match("./index.html")) || fetch(req);
      }
    })());
    return;
  }

  // Assets locaux : cache d'abord — la page sert toujours l'ensemble précaché
  // de SA version. Le réseau ne sert qu'aux ressources absentes de CORE.
  if (sameOrigin) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res && res.status === 200) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }
});
