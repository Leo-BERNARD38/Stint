/**
 * Service worker de Stint — rend l'app installable, hors-ligne et **cohérente** :
 * une version = un cache complet, jamais de panachage ancien HTML / vieux CSS.
 * Stratégies :
 *   - install : précache de TOUTES les ressources en contournant le cache HTTP
 *     (`cache: "reload"`, GitHub Pages sert avec un max-age de 10 min) ;
 *   - assets même origine : cache d'abord (on sert la version précachée, le
 *     réseau ne sert qu'aux ressources oubliées de CORE) ;
 *   - navigation : réseau d'abord avec délai de garde, repli app shell en cache
 *     (ouverture instantanée même sur réseau lent) ;
 *   - polices : auto-hébergées et précachées (CORE) → servies cache-d'abord
 *     comme les autres assets même origine, aucune requête tierce ;
 *   - nouvelle version : purge de l'ancien cache, prise de contrôle, puis la
 *     page se recharge une fois sur "controllerchange" (voir main.js).
 * Bumper CACHE à chaque release ; ajouter à CORE tout nouveau fichier servi.
 */
const CACHE = "stint-v75";
const NAV_TIMEOUT_MS = 2500;

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
  "./assets/fonts/inter-latin.woff2",
  "./assets/fonts/inter-latin-ext.woff2",
  "./assets/fonts/bitcount-latin.woff2",
  "./assets/fonts/bitcount-latin-ext.woff2",
  "./src/main.js",
  "./src/core/EventEmitter.js",
  "./src/core/constants.js",
  "./src/models/Segment.js",
  "./src/models/Settings.js",
  "./src/models/Store.js",
  "./src/models/Task.js",
  "./src/services/DataTransfer.js",
  "./src/services/Formatter.js",
  "./src/services/Persistence.js",
  "./src/services/StorageInfo.js",
  "./src/services/TimeCalculator.js",
  "./src/ui/App.js",
  "./src/ui/BgDots.js",
  "./src/ui/DayGlyphAnimator.js",
  "./src/ui/Timer.js",
  "./src/ui/icons.js",
  "./src/ui/components/CopyButton.js",
  "./src/ui/components/FillPopover.js",
  "./src/ui/components/ScheduleEditor.js",
  "./src/ui/components/TimelineTip.js",
  "./src/ui/components/Toast.js",
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
  "./src/ui/views/StatsTimelineView.js",
  "./src/ui/views/StatsView.js",
  "./src/ui/views/StorageView.js",
  "./src/ui/views/TabsView.js",
  "./src/ui/views/TaskListView.js",
  "./src/ui/views/ThemeView.js",
  "./src/ui/views/TimelineView.js",
  "./src/ui/views/ToolsView.js",
  "./src/ui/views/TotalsView.js",
  "./src/utils/clipboard.js",
  "./src/utils/datetime.js",
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

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Navigations : réseau d'abord, mais sans attendre un réseau lent (délai de
  // garde) — l'app shell en cache assure une ouverture instantanée.
  if (req.mode === "navigate") {
    event.respondWith((async () => {
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
