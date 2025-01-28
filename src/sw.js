self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open('agrodecision-cache').then((cache) => {
            return cache.addAll([
                '/',
                '/index.html',
                '/styles.css',
                '/app.js',
                '/services/MapService.js',
                '/services/ClimateService.js',
                '/services/NewsService.js',
                '/utils/storage.js',
                '/utils/notifications.js',
                '/config/constants.js',
                'https://unpkg.com/leaflet@1.7.1/dist/leaflet.css',
                'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js'
            ]);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});

self.addEventListener('push', (event) => {
    const options = {
        body: event.data.text(),
        icon: 'icon.png',
        badge: 'badge.png',
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

// filepath: /c:/Users/davi.silva/Desktop/AgroDecision-v1/src/services/MapService.js
import { mapConfig } from '../config/constants';
import { showError } from '../utils/notifications';

export class MapService {
    static async initMap() {
        try {
            const map = L.map('map', mapConfig.options)
                .setView([mapConfig.initialView.lat, mapConfig.initialView.lng], mapConfig.initialView.zoom);
            
            L.control.zoom({ position: 'topleft' }).addTo(map);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);
            
            return map;
        } catch (error) {
            console.error('Erro ao inicializar mapa:', error);
            showError('Erro ao carregar o mapa');
            throw error;
        }
    }
}

// filepath: /c:/Users/davi.silva/Desktop/AgroDecision-v1/src/services/ClimateService.js
export class ClimateService {
    static async getNASAData(lat, lng) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(endDate.getFullYear() - 1);
        
        const params = new URLSearchParams({
            parameters: 'T2M,PRECTOT,RH2M',
            community: 'AG',
            longitude: lng.toFixed(4),
            latitude: lat.toFixed(4),
            start: this.formatDate(startDate),
            end: this.formatDate(endDate),
            format: 'JSON'
        });

        try {
            const response = await fetch(`https://power.larc.nasa.gov/api/temporal/daily/point?${params}`);
            if (!response.ok) throw new Error('Falha ao buscar dados climáticos');
            const data = await response.json();
            return data.properties.parameter;
        } catch (error) {
            console.error('Erro ao buscar dados climáticos:', error);
            throw error;
        }
    }

    static formatDate(date) {
        return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    }
}

// filepath: /c:/Users/davi.silva/Desktop/AgroDecision-v1/src/services/NewsService.js
import { GNEWS_API_KEY } from '../config/constants';

export class NewsService {
    static async fetchAgriculturalNews() {
        const response = await fetch(
            `https://gnews.io/api/v4/search?q=agricultura+brasil&lang=pt&country=br&max=20&apikey=${GNEWS_API_KEY}`
        );
        
        if (!response.ok) throw new Error('Falha ao buscar notícias');
        
        const data = await response.json();
        return data.articles || [];
    }
}

// filepath: /c:/Users/davi.silva/Desktop/AgroDecision-v1/src/utils/notifications.js
export const showError = (message) => {
    Swal.fire({
        title: 'Erro',
        text: message,
        icon: 'error',
        confirmButtonText: 'Fechar',
        confirmButtonColor: '#4CAF50'
    });
};

export const showLoadingAnimation = () => {
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.id = 'loadingOverlay';
    loadingOverlay.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(loadingOverlay);
};

export const hideLoadingAnimation = () => {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('fade-out');
        setTimeout(() => loadingOverlay.remove(), 500);
    }
};
