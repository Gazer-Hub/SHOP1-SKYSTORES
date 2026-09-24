self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.use('sky-inventory-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        // Add your main CSS and JS files here if needed
      ]);
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
