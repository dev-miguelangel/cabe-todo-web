// Service worker de Cabe Todo: guarda la app para usarla sin conexión.
//
// - Al instalar guarda todos los archivos de la versión (lista y versión las escribe scripts/build.mjs).
// - Responde desde la caché (rápido y sin conexión); las páginas, con la de la caché aunque lleven ?task=….
// - Una versión nueva espera a que la app diga "actualizar" (SKIP_WAITING) para no cambiar a mitad de uso.
// - Toque en un aviso: abre o enfoca la app.
//
// En desarrollo (public/ sin compilar) no hay lista: la app no registra el service worker en localhost.

const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = `cabe-todo-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('cabe-todo-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

/** Páginas guardadas con su URL limpia (Vercel redirige /doc.html → /doc): / y /doc, sin ?task=…. */
function pageKey(url) {
  const path = url.pathname.replace(/\.html$/, '').replace(/\/index$/, '/');
  return path || '/';
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cached = await caches.match(pageKey(url), { cacheName: CACHE });
      if (cached) return cached;
      try {
        return await fetch(request);
      } catch {
        return caches.match('/', { cacheName: CACHE });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(url.pathname, { cacheName: CACHE });
    return cached || fetch(request);
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const app = all.find((c) => new URL(c.url).origin === self.location.origin);
    if (app) return app.focus();
    return self.clients.openWindow('/');
  })());
});
