// --- (1) CACHE CONFIGURATION ---
// IMPORTANT: Change this name every time you update the app
const CACHE_NAME = 'chg-toolkit-cache-v3'; 

// This list MUST include every critical file for the app to work offline
const urlsToCache = [
  '/', // The base page
  'index.html',
  'style.css', // The new CSS file
  'index.js',
  'manifest.json',
  
  // --- CDNs ---
  // Supabase
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  // Tailwind (imported by style.css, caching it is safer)
  'https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css',
  // Google Font
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display.swap',
  
  // --- Core Images (from HTML & Manifest) ---
  // 192px icon
  'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhFzwIoH5I9Dg_dwbN_Kc4B2KdJiTjIVJIc45xnOQ28R2dw75hGSE97vmQpYfXKO1r0qAceEw2kpp78Y_aTgD6YCZfpZiMC8bStPrEDYzOUSUV96h9kYYcS5PD_nAltwlYEL1umN-Z6KjXfyIaFEU-OP4-Ldo6r1V9ZZwfp3AG1YDJYGoOsgWKNcoT3igc4/s1600/bc19f2e5-04b9-441b-a4f4-ccf4fe8e8d31.png',
  // 512px icon
  'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhFzwIoH5I9Dg_dwbN_Kc4B2KdJiTjIVJIc45xnOQ28R2dw75hGSE97vmQpYfXKO1r0qAceEw2kpp78Y_aTgD6YCZfpZiMC8bStPrEDYzOUSUV96h9kYYcS5PD_nAltwlYEL1umN-Z6KjXfyIaFEU-OP4-Ldo6r1V9ZZwfp3AG1YDJYGoOsgWKNcoT3igc4/s1600/bc19f2e5-04b9-441b-a4f4-ccf4fe8e8d31.png'
];

// --- (2) PWA LIFECYCLE: INSTALL ---
// Install event: cache all critical assets
self.addEventListener('install', event => {
  console.log('[SW] Install event started. Caching assets...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cache opened. Adding files...');
        // We use addAll which fails if any single file fails
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('[SW] Failed to cache assets during install:', error);
      })
  );
  // Force the new service worker to activate immediately
  self.skipWaiting();
});

// --- (3) PWA LIFECYCLE: ACTIVATE ---
// Activate event: clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activate event started. Cleaning old caches...');
  const cacheWhitelist = [CACHE_NAME]; // Only keep the current cache
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // If it's not our current cache, delete it
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Take control of all open clients immediately
  return self.clients.claim();
});

// --- (4) PWA LIFECYCLE: FETCH ---
// Fetch event: serve from cache first (Cache-First strategy)
self.addEventListener('fetch', event => {
  // We only want to cache GET requests
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response from cache
        if (response) {
          return response;
        }
        
        // Not in cache - fetch from network
        return fetch(event.request).then(
          networkResponse => {
            // Check if we received a valid response
            // We don't cache Supabase API calls
            if(!networkResponse || networkResponse.status !== 200 || 
               event.request.url.includes('supabase.co')) {
              return networkResponse;
            }

            // IMPORTANT: Clone the response. A response is a stream
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        ).catch(error => {
          // Network fetch failed
          console.error('[SW] Network fetch failed:', event.request.url, error);
          // You could return an offline fallback page here if you had one
        });
      }
    )
  );
});

// --- (5) NOTIFICATION LOGIC ---

// Listen for messages from the main page (index.js)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'scheduleNotification') {
    const { title, body, delayInMs, icon } = event.data.payload;

    console.log(`[SW] Received notification request. Scheduling in ${delayInMs}ms`);

    // Use setTimeout to delay the notification
    // This is more reliable in a Service Worker
    setTimeout(() => {
      console.log('[SW] Triggering notification:', title);
      // Show the notification using the Service Worker's registration
      self.registration.showNotification(title, {
        body: body,
        icon: icon,
        badge: icon, // Icon for Android notification tray
        vibrate: [200, 100, 200] // Vibrate pattern
      });
    }, delayInMs);
  }
});

// Handle notification click (e.g., to open/focus the app)
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  // This attempts to focus an existing app window or open a new one
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientsArr => {
      // Check if there's already a window open
      const hadWindowToFocus = clientsArr.some(windowClient =>
        windowClient.url === self.location.origin + '/'
          ? (windowClient.focus(), true)
          : null
      );
      
      // If not, open a new window
      if (!hadWindowToFocus) {
        clients.openWindow(self.location.origin)
          .then(windowClient => (windowClient ? windowClient.focus() : null));
      }
    })
  );
});
