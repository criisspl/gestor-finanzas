// Service worker: guarda la app para que abra rápido y funcione sin conexión.
// Los datos de cada persona no pasan por aquí (Supabase y demás destinos van siempre por la red).
// El build sustituye el marcador por el identificador de la versión (en desarrollo no se registra).
const CACHE = "gestor-__BUILD_ID__";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(["/", "/manifest.webmanifest", "/icons/icon-192.png"]))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith("gestor-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const req = e.request,
    url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  // Páginas: primero la red (última versión), si no hay conexión, la guardada.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok) {
            const copia = r.clone();
            caches.open(CACHE).then((c) => c.put("/", copia));
          }
          return r;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }
  // Archivos con hash (assets/…), fuentes e iconos: primero la caché.
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((r) => {
          if (r.ok) {
            const copia = r.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
          }
          return r;
        })
    )
  );
});
