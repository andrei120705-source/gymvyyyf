const CACHE_NAME = 'project-atlant-pro-v3';
const DYNAMIC_CACHE_NAME = 'project-atlant-pro-dynamic-v3';

// Static resources for Cache First strategy
const STATIC_ASSETS = [
    './',
    './index.html',
    './Gymveo.html',
    './manifest.json',
    './icon.png',
    './icon-72x72.png',
    './icon-96x96.png',
    './icon-128x128.png',
    './icon-144x144.png',
    './icon-152x152.png',
    './icon-192x192.png',
    './icon-384x384.png',
    './icon-512x512.png',
    './tailwind.js',
    './vue.global.prod.js',
    './chart.js',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/vue@3/dist/vue.global.prod.js',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(keys
                .filter(key => key !== CACHE_NAME && key !== DYNAMIC_CACHE_NAME)
                .map(key => caches.delete(key))
            );
        })%5n    );
    return self.clients.claim();
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Video support (cache videos if possible)
    if (event.request.destination === 'video' || url.pathname.endsWith('.mp4')) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) return cachedResponse;
                return fetch(event.request).then(networkResponse => {
                    if (networkResponse.status === 200 || networkResponse.status === 206) {
                        const responseClone = networkResponse.clone();
                        caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return networkResponse;
                }).catch(() => {
                });
        })
    );
    return;
});

// Check if request is for static asset, CDN, or Google Fonts
const isStatic = STATIC_ASSETS.some(asset => {
    const cleanAsset = asset.replace(/^.//, '');
    const cleanPath = url.pathname.replace(/^//, '');
    return cleanAsset === cleanPath || (cleanPath === '' && cleanAsset === '');
});

if (url.origin !== location.origin || isStatic) {
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) return cachedResponse;
            return fetch(event.request).then(networkResponse => {
                return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
            }).catch(() => {
            });
        })
    );
} else {
    // Network First for everything else
    event.respondWith(
        fetch(event.request).then(networkResponse => {
            return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                cache.put(event.request, networkResponse.clone());
                return networkResponse;
            });
        }).catch(() => caches.match(event.request))
    );
}
});

// Background Sync API
self.addEventListener('sync', event => {
    if (event.tag === 'sync-workout-data') {
        event.waitUntil(syncData());
    }
});

async function syncData() {
    const clients = await self.clients.matchAll();
    clients.forEach(client => client.postMessage({ type: 'SYNC_COMPLETE' }));
}

// Push Notifications
self.addEventListener('push', event => {
    let body = 'Время тренировки!';
    if (event.data) {
        body = event.data.text();
    }
    
    const options = {
        body,
        icon: './icon-192x192.png',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: '2'
        }
    };
    
    event.waitUntil(
        self.registration.showNotification('Проект Атлант Дневник Тренировок', options)
    );
});
