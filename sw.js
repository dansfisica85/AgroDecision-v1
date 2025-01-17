const CACHE_NAME = 'agrodecision-v1';
const STATIC_RESOURCES = [
    './',
    'index.html',
    'manifest.json',
    'styles.css',
    'app.js',
    'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js',
    'https://unpkg.com/leaflet@1.7.1/dist/leaflet.css',
    'https://cdn.jsdelivr.net/npm/sweetalert2@11',
    'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
    'icons/icon-72x72.png',
    'icons/icon-96x96.png',
    'icons/icon-128x128.png',
    'icons/icon-144x144.png',
    'icons/icon-152x152.png',
    'icons/icon-192x192.png',
    'icons/icon-384x384.png',
    'icons/icon-512x512.png'
];

const DYNAMIC_CACHE_NAME = 'agrodecision-dynamic-v1';
const MAX_DYNAMIC_CACHE_ITEMS = 50;

// Instalação do Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache aberto');
                return cache.addAll(STATIC_RESOURCES);
            })
            .catch(error => {
                console.error('Erro ao cachear recursos estáticos:', error);
            })
    );
});

// Ativação do Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(cacheName => {
                        return cacheName.startsWith('agrodecision-') &&
                               cacheName !== CACHE_NAME &&
                               cacheName !== DYNAMIC_CACHE_NAME;
                    })
                    .map(cacheName => {
                        return caches.delete(cacheName);
                    })
            );
        })
    );
});

// Interceptação de requisições
self.addEventListener('fetch', event => {
    // Ignorar requisições para APIs externas
    if (event.request.url.includes('power.larc.nasa.gov') ||
        event.request.url.includes('nominatim.openstreetmap.org') ||
        event.request.url.includes('newsapi.org')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }

                return fetch(event.request)
                    .then(response => {
                        // Verificar se a resposta é válida
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clonar a resposta para o cache
                        const responseToCache = response.clone();

                        // Armazenar no cache dinâmico
                        caches.open(DYNAMIC_CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                                
                                // Limitar o tamanho do cache dinâmico
                                limitCacheSize(DYNAMIC_CACHE_NAME, MAX_DYNAMIC_CACHE_ITEMS);
                            });

                        return response;
                    })
                    .catch(error => {
                        // Retornar página offline para solicitações de documento HTML
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('./offline.html');
                        }
                    });
            })
    );
});

// Função para limitar o tamanho do cache
async function limitCacheSize(cacheName, maxItems) {
    try {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        if (keys.length > maxItems) {
            await cache.delete(keys[0]);
            limitCacheSize(cacheName, maxItems);
        }
    } catch (error) {
        console.error('Erro ao limitar cache:', error);
    }
}

// Sincronização em background
self.addEventListener('sync', event => {
    if (event.tag === 'sync-simulations') {
        event.waitUntil(
            syncSimulations()
        );
    }
});

// Função para sincronizar simulações
async function syncSimulations() {
    try {
        const simulations = await getAllSimulationsFromIndexedDB();
        for (const simulation of simulations) {
            if (!simulation.synced) {
                await syncSimulation(simulation);
            }
        }
    } catch (error) {
        console.error('Erro na sincronização:', error);
    }
}

// Notificações push
self.addEventListener('push', event => {
    const options = {
        body: event.data.text(),
        icon: 'icons/icon-192x192.png',
        badge: 'icons/icon-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'Ver detalhes'
            },
            {
                action: 'close',
                title: 'Fechar'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('AgroDecision', options)
    );
});