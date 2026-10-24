const CACHE_NAME = "fixflow-app-shell-v1";
const APP_SHELL_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.add(APP_SHELL_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("fixflow-app-shell-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

// Cache only static frontend resources sent by the running app. Never cache API data.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "PRECACHE_FRONTEND_RESOURCES") return;

  const urls = [...new Set(event.data.urls || [])].filter((value) => {
    try {
      const url = new URL(value, self.location.origin);
      return url.origin === self.location.origin &&
        !url.pathname.startsWith("/api/") &&
        url.pathname !== "/sw.js" &&
        /\.(js|css|svg|png|jpe?g|webp|ico|woff2?)$/i.test(url.pathname);
    } catch {
      return false;
    }
  });

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => Promise.allSettled(urls.map((url) => cache.add(url)))),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname === "/sw.js"
  ) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(APP_SHELL_URL, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(APP_SHELL_URL)) || Response.error()),
    );
    return;
  }

  if (!/\.(js|css|svg|png|jpe?g|webp|ico|woff2?)$/i.test(url.pathname)) return;

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      } catch {
        return Response.error();
      }
    }),
  );
});
