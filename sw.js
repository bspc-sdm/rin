/* অফলাইনে অ্যাপ খুলতে সাহায্য করে। ডাটা এখানে নয়, ফোনের লোকাল স্টোরেজে থাকে। */
const CACHE = 'rin-v11';
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
  if (sameOrigin) {
    // নিজের ফাইল: আগে নেটওয়ার্ক (সর্বশেষ সংস্করণ), না পেলে ক্যাশ — তাই আপডেট সাথে সাথে আসে
    e.respondWith(
      fetch(req, { cache: 'no-cache' }).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined)))
    );
    return;
  }
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }))
    )
  );
});
