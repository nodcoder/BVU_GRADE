/* Service Worker: giúp app hoạt động offline sau khi đã mở 1 lần có mạng. */
const CACHE_NAME = "omr-offline-v1";

// App shell (các file local)
const APP_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./answer_sheet_A4.html",
  "./answer_sheet_generator.html",
  "./huongdan_1trang.html",
  "./checklist_truoc_khi_thi.html"
];

// Thư viện ngoài (sẽ cache dạng opaque nếu CORS)
const EXTERNAL_ASSETS = [
  "https://docs.opencv.org/4.x/opencv.js",
  "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_ASSETS);
    // external: có thể fail (tuỳ mạng/CORS) -> bỏ qua lỗi, dùng runtime caching
    for (const url of EXTERNAL_ASSETS){
      try { await cache.add(url); } catch {}
    }
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE_NAME) ? caches.delete(k) : Promise.resolve()));
    self.clients.claim();
  })());
});

// Chiến lược:
// - local assets: cache-first
// - external libs: stale-while-revalidate
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // chỉ handle GET
  if (req.method !== "GET") return;

  const isLocal = (url.origin === self.location.origin);
  const isExternalLib = EXTERNAL_ASSETS.includes(req.url);

  if (isLocal){
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req, {ignoreSearch:true});
      if (cached) return cached;
      const res = await fetch(req);
      cache.put(req, res.clone());
      return res;
    })());
    return;
  }

  if (isExternalLib){
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      const fetchPromise = fetch(req).then((res) => {
        cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })());
    return;
  }
});
