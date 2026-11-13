// Сервис-воркер «Мои шаблоны». ВЕРСИЯ ниже должна совпадать с APP_VERSION в index.html (меняется при каждом выпуске).
const VERSION = '2026-11-13.3';
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
// Самолечение: если браузер очистил кэш (нехватка места, «очистить данные»), а воркер остался, при первом же заходе с сетью файлы докачиваются.
// Иначе приложение открывалось бы только онлайн, а офлайн давало бы ERR_FAILED.
let healing = null;
function heal() {
  if (healing) return healing;
  healing = caches.open(CACHE).then(c => c.match('./index.html').then(hit => hit ? null :
    Promise.all(FILES.map(u => fetch(new Request(u, { cache: 'reload' })).then(r => r.ok ? c.put(u, r) : null))))).catch(() => {}).then(() => { healing = null; });
  return healing;
}
// Работаем из кэша своей версии (быстро и без сети); если файла нет — идём в сеть
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') e.waitUntil(heal());
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req))
      .catch(() => (req.mode === 'navigate' ? caches.match('./index.html').then(r => r || Response.error()) : Response.error()))
  );
});
