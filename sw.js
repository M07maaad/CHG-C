/*
  SERVICE WORKER (sw.js)
  - Removed old 'message' listener (for TimestampTrigger)
  - Added new 'push' listener to receive PUSH notifications from the server (Vercel).
*/

// ** NEW: Cache version v10 (Full Push Notification System) **
const CACHE_NAME = 'chg-toolkit-cache-v10';
const urlsToCache = [
  '/', // Caches the root
  'index.html',
  'style.css',
  'index.js',
  'manifest.json',
  'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhFzwIoH5I9Dg_dwbN_Kc4B2KdJiTjIVJIc45xnOQ28R2dw75hGSE97vmQpYfXKO1r0qAceEw2kpp78Y_aTgD6YCZfpZiMC8bStPrEDYzOUSUV96h9kYYcS5PD_nAltwlYEL1umN-Z6KjXfyIaFEU-OP4-Ldo6r1V9ZZwfp3AG1YDJYGoOsgWKNcoT3igc4/s192/bc19f2e5-04b9-441b-a4f4-ccf4fe8e8d31.png' // Logo
];

// 1. Install Event: Cache all essential app files
self.addEventListener('install', event => {
  console.log('[SW] Install event (v10)');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW] All files cached. Activating...');
        // Force the waiting service worker to become the active service worker.
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[SW] Cache addAll failed:', err);
      })
  );
});

// 2. Activate Event: Clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activate event (v10)');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          // Find all caches that are NOT our new cache and delete them
          return cacheName.startsWith('chg-toolkit-cache-') &&
                 cacheName !== CACHE_NAME;
        }).map(cacheName => {
          console.log('[SW] Deleting old cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      // Tell the active service worker to take control of the page immediately.
      return self.clients.claim();
    })
  );
});

// 3. Fetch Event: Serve from cache first (Offline-first)
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
      .catch(error => {
        console.error('[SW] Fetch failed:', error);
      })
  );
});


// --- *** NEW: PUSH NOTIFICATION LOGIC *** ---

// 4. Push Event: Listen for a PUSH notification from the server.
// (This is what wakes up the SW on iOS and Android)
self.addEventListener('push', event => {
  console.log('[SW] Push Notification received.');

  let data = { title: 'CHG Toolkit', body: 'You have a new notification.' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      // If data is not JSON, just show it as text
      data.body = event.data.text();
    }
  }

  const title = data.title;
  const options = {
    body: data.body,
    icon: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhFzwIoH5I9Dg_dwbN_Kc4B2KdJiTjIVJIc45xnOQ28R2dw75hGSE97vmQpYfXKO1r0qAceEw2kpp78Y_aTgD6YCZfpZiMC8bStPrEDYzOUSUV96h9kYYcS5PD_nAltwlYEL1umN-Z6KjXfyIaFEU-OP4-Ldo6r1V9ZZwfp3AG1YDJYGoOsgWKNcoT3igc4/s192/bc19f2e5-04b9-441b-a4f4-ccf4fe8e8d31.png',
    badge: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhFzwIoH5I9Dg_dwbN_Kc4B2KdJiTjIVJIc45xnOQ28R2dw75hGSE97vmQpYfXKO1r0qAceEw2kpp78Y_aTgD6YCZfpZiMC8bStPrEDYzOUSUV96h9kYYcS5PD_nAltwlYEL1umN-Z6KjXfyIaFEU-OP4-Ldo6r1V9ZZwfp3AG1YDJYGoOsgWKNcoT3igc4/s192/bc19f2e5-04b9-441b-a4f4-ccf4fe8e8d31.png',
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});


// 5. Notification Click Event (Unchanged)
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked.');
  event.notification.close(); 

  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then(clientList => {
        for (let i = 0; i < clientList.length; i++) {
          let client = clientList[i];
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});
