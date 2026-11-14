/* অফলাইনে অ্যাপ খুলতে সাহায্য করে। ডাটা এখানে নয়, ফোনের লোকাল স্টোরেজে থাকে। */
const CACHE = 'rin-v5';
const SHELL = ['./', 'index.html', 'config.js', 'style.css', 'util.js', 'store.js', 'contract.js',
  'google.js', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const cdn = /cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url.hostname);
  if (!sameOrigin && !cdn) return; // গুগল API/লগিন সরাসরি নেটওয়ার্কে যাবে
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((hit) => {
        const net = fetch(req).then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => hit || (req.mode === 'navigate' ? cache.match('index.html') : undefined));
        return hit || net;
      })
    )
  );
});
