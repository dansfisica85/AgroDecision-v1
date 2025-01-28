import { MapService } from './services/MapService';
import { ClimateService } from './services/ClimateService';
import { NewsService } from './services/NewsService';
import { StorageService } from './utils/storage';
import { showError, showLoadingAnimation, hideLoadingAnimation } from './utils/notifications';
import { mapConfig } from './config/constants';

class AgroDecision {
    constructor() {
        this.map = null;
        this.marker = null;
        this.climateData = null;
        this.initialize();
    }

    async initialize() {
        try {
            await this.initializeMap();
            this.registerServiceWorker();
            this.setupEventListeners();
            this.loadSavedLocation();
        } catch (error) {
            console.error('Erro na inicialização:', error);
            showError('Erro ao inicializar a aplicação');
        }
    }

    async initializeMap() {
        this.map = await MapService.initMap();
        this.showInitialPopup();
        this.setupMapHandlers();
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => console.log('ServiceWorker registrado:', registration))
                .catch(err => console.error('Erro ServiceWorker:', err));
        }
    }

    setupEventListeners() {
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.slice(1);
            this.showScreen(hash || 'home');
        });
    }

    // ... resto dos métodos da classe

    async handleSimulation(event) {
        event.preventDefault();
        showLoadingAnimation();

        try {
            if (!this.climateData) {
                document.getElementById('locationWarning').style.display = 'flex';
                return;
            }

            const formData = this.getFormData();
            this.validateFormData(formData);

            const baseResults = this.calculateCropMetrics(formData);
            const harvestProbabilities = await this.calculateHarvestProbabilities(
                formData,
                new Date(baseResults.harvestDate)
            );

            this.showSimulationResults(baseResults, harvestProbabilities);
            await StorageService.saveToHistory({
                ...formData,
                results: baseResults,
                probabilities: harvestProbabilities,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Erro na simulação:', error);
            showError(error.message || 'Erro ao processar simulação');
        } finally {
            hideLoadingAnimation();
        }
    }
}

// Inicialização
window.addEventListener('DOMContentLoaded', () => {
    window.agroDecision = new AgroDecision();
});