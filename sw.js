// Сервис-воркер «Мои шаблоны». ВЕРСИЯ ниже должна совпадать с APP_VERSION в index.html (меняется при каждом выпуске).
const VERSION = '2026-10-30.2';
const CACHE = 'shablony-' + VERSION;
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

// Новая версия скачивается в свой кэш, но НЕ включается сама: приложение показывает «Доступна новая версия — Обновить»
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(u =>
    fetch(new Request(u, { cache: 'reload' })).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return c.put(u, r); })))));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('shablony-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// кнопка «Обновить» в приложении
self.addEventListener('message', e => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });
// Работаем из кэша своей версии (быстро и без сети); если файла нет — идём в сеть
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req))
      .catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
  );
});
