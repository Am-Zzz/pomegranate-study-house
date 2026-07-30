// 石榴学习屋 Service Worker —— 让 APP 离线也能打开（更像原生应用）
const CACHE = "shiliu-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./touch-icon.png",
  "./pwa-icon-192.png",
  "./maskable-icon.png",
  "./assets/icon-512.png",
  "./assets/girl-icon-rounded.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
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
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((resp) => {
          // 顺手把新成功响应缓存起来（仅同源静态资源）
          if (resp && resp.ok && new URL(event.request.url).origin === self.location.origin) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(event.request, copy));
          }
          return resp;
        })
        .catch(() => cached);
    })
  );
});
