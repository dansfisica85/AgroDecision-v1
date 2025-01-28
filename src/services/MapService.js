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