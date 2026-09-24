const CACHE_NAME = "sky-inventory-v2";
const urlsToCache = [
  "/",
  "/Index_3.html",
  "/manifest.json"
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  // FIX: Ignore manifest.json and netlify functions - don't cache them
  if (event.request.url.includes('manifest.json') || 
      event.request.url.includes('.netlify') ||
      event.request.url.includes('supabase')) {
    return; // let browser handle it normally
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).catch(() => {
        return caches.match('/');
      });
    })
  );
});
