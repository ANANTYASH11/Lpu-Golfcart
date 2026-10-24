// Service Worker for Offline Tile Caching in CampusRide
const CACHE_NAME = 'campusride-tiles-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Intercept map tiles from OpenStreetMap or Esri Satellite
  if (url.includes('tile.openstreetmap.org') || url.includes('server.arcgisonline.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          // Return cached tile if network fails, or fallback
          return cachedResponse || new Response('', { status: 504, statusText: 'Tile Offline' });
        }
      })
    );
  }
});
