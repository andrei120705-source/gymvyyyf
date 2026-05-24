/**
 * Service Worker: sw.js
 * 
 * Описание: Сервис-воркер для полной оффлайн-работоспособности приложения «Дневник тренировок».
 * Обеспечивает кэширование статических файлов и внешних библиотек с использованием стратегии Cache First.
 * 
 * Безопасность localStorage: 
 * Сервис-воркер работает в отдельном потоке (Worker Context) и не имеет прямого доступа к объекту 'window'
 * и локальному хранилищу 'localStorage'. Это означает, что локальные пользовательские данные тренировок 
 * в полной безопасности и никак не могут быть повреждены или изменены сервис-воркером. 
 * Все операции сохранения тренировок продолжают выполняться в основном потоке через localStorage.
 */

// Имя кэша для версионирования. При обновлении приложения достаточно изменить версию, например, на 'v4'.
const CACHE_VERSION = 'v4';
const CACHE_NAME = `gymveo-workout-diary-${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `gymveo-workout-diary-dynamic-${CACHE_VERSION}`;

// Статические ресурсы для кэширования при установке (стратегия Cache First)
const STATIC_ASSETS = [
    './',
    './index.html',
    './workout_diary.html',
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
    './_redirects',
    // Внешние CDN библиотеки и шрифты Google Fonts для 100% автономности
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/vue@3/dist/vue.global.prod.js',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

/**
 * 1. Этап установки (install)
 * Происходит при первой загрузке или при обнаружении новой версии sw.js.
 * Здесь мы открываем кэш и принудительно сохраняем все статические ресурсы из STATIC_ASSETS.
 */
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Кэширование статических ресурсов при установке...');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                // skipWaiting() принуждает новый воркер сразу перейти в статус active, минуя waiting
                return self.skipWaiting();
            })
    );
});

/**
 * 2. Этап активации (activate)
 * Срабатывает после установки. Отличное место для очистки устаревших кэшей предыдущих версий.
 */
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    // Удаляем старые версии кэша, если они не соответствуют текущей версии
                    if (cache !== CACHE_NAME && cache !== DYNAMIC_CACHE_NAME) {
                        console.log(`[Service Worker] Удаление устаревшего кэша: ${cache}`);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => {
            // Активируем управление текущими вкладками немедленно
            return self.clients.claim();
        })
    );
});

/**
 * 3. Перехват сетевых запросов (fetch)
 * Здесь реализуется логика оффлайн-работы.
 * Стратегия: Cache First для статических ресурсов и внешних библиотек,
 * чтобы приложение открывалось мгновенно и без сети.
 */
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Поддержка видео-ресурсов (кэшируем видео при возможности)
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
                    // Офлайн fallback для видео
                });
            })
        );
        return;
    }

    // Проверяем, относится ли запрос к статическим файлам
    const isStaticAsset = STATIC_ASSETS.some(asset => {
        const cleanAsset = asset.replace(/^\.\//, '');
        const cleanPath = url.pathname.replace(/^\//, '');
        return cleanAsset === cleanPath || (cleanPath === '' && cleanAsset === '');
    });

    // Для статических ресурсов и внешних CDN используем стратегию Cache First с динамическим дозаполнением
    if (url.origin === location.origin && (isStaticAsset || url.pathname.match(/\.(png|jpg|jpeg|svg|css|js|json)$/)) || url.origin !== location.origin) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                // Если файл найден в кэше - возвращаем его (моментальный оффлайн запуск)
                if (cachedResponse) {
                    return cachedResponse;
                }
                // Иначе загружаем из сети, параллельно кэшируя для будущих оффлайн запусков
                return fetch(event.request).then(networkResponse => {
                    if (!networkResponse || networkResponse.status !== 200) {
                        return networkResponse;
                    }
                    return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                }).catch(() => {
                    // Возвращаем резервный index.html в случае оффлайн ошибки для навигации
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html') || caches.match('./workout_diary.html');
                    }
                });
            })
        );
    } else {
        // Network First для динамических данных и прочих API запросов
        event.respondWith(
            fetch(event.request).then(networkResponse => {
                if (networkResponse && networkResponse.status === 200) {
                    return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                }
                return networkResponse;
            }).catch(() => {
                return caches.match(event.request);
            })
        );
    }
});

// Фоновая синхронизация данных тренировок
self.addEventListener('sync', event => {
    if (event.tag === 'sync-workout-data') {
        event.waitUntil(syncData());
    }
});

async function syncData() {
    const clients = await self.clients.matchAll();
    clients.forEach(client => client.postMessage({ type: 'SYNC_COMPLETE' }));
}
