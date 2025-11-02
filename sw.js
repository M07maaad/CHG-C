const CACHE_NAME = 'chg-toolkit-v1.2';
const urlsToCache = [
  './index.html',
  './index.js',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://kjiujbsyhxpooppmxgxb.supabase.co/rest/v1/calculation_logs?select=*', // Cache Supabase client
  'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgGVNd8uPcpbKOagpnwi5e8ai6v82sMiSRdWD0ZEgqIayvesaHtPrec7QGQSx-TXtbWb9D5SdZrcXuHCIAvPbHRGqUQV7MKxR_VyjvTs37suGOlDaqS1RuVuN2EsMNm50GDCG_N-ugnwwutUb9OfyJbkGz9k06YvTi0ynwW9jJaBNhIsEkPJ5NOzExt3xzN/s1600/10cb804e-ab18-4d8a-8ce0-600bbe8ab10d.png'
];

// 1. Install Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Pre-cache essential assets
        return Promise.all(
          urlsToCache.map(url =>
            fetch(new Request(url, { mode: 'no-cors' })) // Use no-cors for cross-origin resources
              .then(response => cache.put(url, response))
              .catch(err => console.warn(`Failed to cache ${url}: ${err}`))
          )
        );
      })
      .then(() => self.skipWaiting()) // Activate worker immediately
  );
});

// 2. Activate Service Worker and clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all open clients
  );
});

// 3. Intercept fetch requests (Stale-While-Revalidate strategy)
self.addEventListener('fetch', event => {
  // Let browser handle non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // For Supabase API calls (and others), go network first
  if (event.request.url.includes('supabase.co')) {
     event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(event.request);
        })
    );
    return;
  }

  // For all other assets, use Stale-While-Revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(response => {
        // Return from cache immediately if available
        const fetchPromise = fetch(event.request).then(networkResponse => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
        return response || fetchPromise;
      });
    })
  );
});
