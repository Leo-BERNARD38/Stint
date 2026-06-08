/**
 * Service worker de Stint — rend l'app installable et utilisable hors-ligne.
 * Stratégies :
 *   - navigation : réseau d'abord, repli sur l'app shell en cache ;
 *   - assets même origine + Google Fonts : stale-while-revalidate.
 * Bumper CACHE à chaque release pour purger l'ancien cache.
 */
const CACHE = "stint-v16";

const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./assets/styles/variables.css",
  "./assets/styles/base.css",
  "./assets/styles/layout.css",
  "./assets/styles/components.css",
  "./src/main.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(CORE))
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
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.host);

  // Navigations : réseau d'abord (mises à jour immédiates), repli app shell.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("./index.html")));
    return;
  }

  // Assets locaux + polices : stale-while-revalidate.
  if (sameOrigin || isFont) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
