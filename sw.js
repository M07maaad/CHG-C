const CACHE_NAME = 'chg-toolkit-cache-v1';
// This list should include all critical files for the app to work offline
const urlsToCache = [
  '/',
  'index.html',
  'index.js',
  'manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgGVNd8uPcpbKOagpnwi5e8ai6v82sMiSRdWD0ZEgqIayvesaHtPrec7QGQSx-TXtbWb9D5SdZrcXuHCIAvPbHRGqUQV7MKxR_VyjvTs37suGOlDaqS1RuVuN2EsMNm50GDCG_N-ugnwwutUb9OfyJbkGz9k06YvTi0ynwW9jJaBNhIsEkPJ5NOzExt3xzN/s1600/10cb804e-ab18-4d8a-8ce0-600bbe8ab10d.png'
];

// Install event: cache all critical assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Fetch event: serve from cache first
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        // Not in cache - fetch from network
        return fetch(event.request);
      }
    )
  );
});

// Activate event: clean up old caches
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
    })
  );
  return self.clients.claim();
});

// --- *** NEW NOTIFICATION LOGIC *** ---
// Listen for messages from the main page (index.js)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'scheduleNotification') {
    const { title, body, delayInMs, icon } = event.data.payload;

    console.log(`[SW] Received notification request. Scheduling in ${delayInMs}ms`);

    // Use setTimeout to delay the notification
    // This is more reliable in a Service Worker than on the main page
    setTimeout(() => {
      console.log('[SW] Triggering notification:', title);
      // Show the notification using the Service Worker's registration
      self.registration.showNotification(title, {
        body: body,
        icon: icon,
        badge: icon, // Icon for Android notification tray
      });
    }, delayInMs);
  }
});

// Handle notification click (e.g., to open/focus the app)
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  // This attempts to focus an existing tab or open a new one
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientsArr => {
      const hadWindowToFocus = clientsArr.some(windowClient =>
        windowClient.url === self.location.origin + '/'
          ? (windowClient.focus(), true)
          : null
      );
      
      if (!hadWindowToFocus) {
        clients.openWindow(self.location.origin)
          .then(windowClient => (windowClient ? windowClient.focus() : null));
      }
    })
  );
});

