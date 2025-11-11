/*
  SERVICE WORKER (sw.js)
  This file handles offline caching and push notifications.
*/

// ** NEW: Cache version v6 to force update after ALL fixes **
const CACHE_NAME = 'chg-toolkit-cache-v7';
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
  console.log('[SW] Install event (v6)');
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
  console.log('[SW] Activate event (v6)');
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

// --- NOTIFICATION LOGIC (FIXED) ---

// 4. Message Event: Listen for notification jobs from index.js
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'scheduleNotification') {
    const { title, body, delayInMs, icon } = event.data.payload;
    const triggerTime = Date.now() + delayInMs;
    console.log(`[SW] Notification job received. Scheduling "${title}" for ${new Date(triggerTime)}`);

    // *** FIX: Use Notification Triggers API (the reliable, modern way) ***
    if ('showTrigger' in Notification.prototype) {
      try {
        self.registration.showNotification(title, {
          body: body,
          icon: icon,
          badge: icon,
          vibrate: [200, 100, 200],
          showTrigger: new TimestampTrigger(triggerTime) // The new reliable API
        });
        console.log(`[SW] Notification scheduled successfully with showTrigger.`);
      } catch (e) {
        console.error('[SW] showTrigger failed. Falling back to setTimeout (unreliable).', e);
        // Fallback to the unreliable setTimeout if showTrigger fails (e.g., Firefox)
        fallbackTimeout(title, body, delayInMs, icon);
      }
    } else {
      // Fallback for browsers without showTrigger (like Firefox)
      console.warn('[SW] showTrigger not supported, using setTimeout fallback (unreliable).');
      fallbackTimeout(title, body, delayInMs, icon);
    }
  }
});

// Fallback function for browsers that don't support TimestampTrigger
function fallbackTimeout(title, body, delayInMs, icon) {
   setTimeout(() => {
      self.registration.showNotification(title, { 
        body: body, 
        icon: icon, 
        badge: icon, 
        vibrate: [200, 100, 200] 
      });
      console.log(`[SW] Fallback notification shown (via setTimeout): "${title}"`);
    }, delayInMs);
}

// 5. Notification Click Event: What happens when user clicks the notification
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked.');
  event.notification.close(); // Close the notification

  // Focus the PWA if it's already open, or open it if it's not
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
