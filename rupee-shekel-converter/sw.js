/* Service worker for the Rupee<->Shekel converter PWA.
   Caches the app shell so it opens instantly and works offline.
   The live FX API is always fetched from the network (never cached),
   so rates stay fresh; the app's own localStorage handles offline rates. */
var CACHE = "rupee-shekel-v1";
var SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  var url = new URL(req.url);
  // Never cache exchange-rate API calls — always hit the network.
  var isApi = /frankfurter\.dev|frankfurter\.app|er-api\.com/.test(url.hostname);
  if (isApi) return; // let the browser handle it normally

  // App shell: cache-first, fall back to network, then update cache.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(function (cached) {
        var network = fetch(req).then(function (res) {
          if (res && res.status === 200) {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put(req, copy); });
          }
          return res;
        }).catch(function () { return cached; });
        return cached || network;
      })
    );
  }
});
