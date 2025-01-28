import { MapService } from './services/MapService';
import { ClimateService } from './services/ClimateService';
import { NewsService } from './services/NewsService';
import { StorageService } from './utils/storage';
import { showError, showLoadingAnimation, hideLoadingAnimation } from './utils/notifications';
import { mapConfig } from './config/constants';

class AgroDecision {
    constructor() {
        this.currentScreen = 'home';
        this.map = null;
        this.marker = null;
        this.climateData = null;
        this.selectedLocation = null;
        this.screens = {
            home: document.getElementById('homeScreen'),
            simulation: document.getElementById('simulationScreen'),
            news: document.getElementById('newsScreen'),
            history: document.getElementById('historyScreen')
        };
    }

    static getInstance() {
        if (!AgroDecision.instance) {
            AgroDecision.instance = new AgroDecision();
        }
        return AgroDecision.instance;
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
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const screen = e.currentTarget.dataset.screen;
                this.showScreen(screen);
            });
        });

        const menuBtn = document.getElementById('menuBtn');
        if (menuBtn) {
            menuBtn.addEventListener('click', () => {
                document.querySelector('.sidebar').classList.toggle('open');
            });
        }

        const simulationForm = document.getElementById('simulationForm');
        if (simulationForm) {
            simulationForm.addEventListener('submit', (e) => this.handleSimulation(e));
        }
    }

    showScreen(screenId) {
        // Ocultar todas as telas
        Object.values(this.screens).forEach(screen => {
            if (screen) screen.style.display = 'none';
        });

        // Remover classe active de todos os botões
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        // Mostrar tela selecionada
        const screen = this.screens[screenId];
        if (screen) {
            screen.style.display = 'block';
            document.querySelector(`[data-screen="${screenId}"]`)?.classList.add('active');
        }

        // Atualizar estado
        this.currentScreen = screenId;

        // Inicializações específicas
        if (screenId === 'home' && this.map) {
            setTimeout(() => this.map.invalidateSize(), 100);
        }
    }

    showInitialPopup() {
        // Exibir popup inicial com instruções
        L.popup()
            .setLatLng(this.map.getCenter())
            .setContent('Selecione um ponto no mapa para iniciar a simulação.')
            .openOn(this.map);
    }

    setupMapHandlers() {
        this.map.on('click', async (e) => {
            const { lat, lng } = e.latlng;
            
            // Remove marcador anterior se existir
            if (this.marker) {
                this.map.removeLayer(this.marker);
            }
            
            // Adiciona novo marcador
            this.marker = L.marker([lat, lng]).addTo(this.map);
            
            try {
                showLoadingAnimation();
                // Busca dados climáticos
                this.climateData = await ClimateService.getNASAData(lat, lng);
                this.selectedLocation = { lat, lng };
                
                // Salva localização
                StorageService.saveLocation(lat, lng);
                
                hideLoadingAnimation();
            } catch (error) {
                console.error('Erro ao buscar dados climáticos:', error);
                showError('Erro ao buscar dados do clima');
                hideLoadingAnimation();
            }
        });
    }

    loadSavedLocation() {
        const savedLocation = StorageService.getSavedLocation();
        if (savedLocation) {
            const { lat, lng } = savedLocation;
            this.map.setView([lat, lng], mapConfig.initialView.zoom);
            this.marker = L.marker([lat, lng]).addTo(this.map);
        }
    }

    getFormData() {
        const form = document.getElementById('simulationForm');
        const formData = new FormData(form);
        return Object.fromEntries(formData.entries());
    }

    validateFormData(formData) {
        if (!formData.crop || !formData.area || !formData.startDate) {
            throw new Error('Todos os campos são obrigatórios.');
        }
    }

    calculateCropMetrics(formData) {
        // Lógica para calcular métricas da cultura
        const harvestDate = new Date(formData.startDate);
        harvestDate.setMonth(harvestDate.getMonth() + 6); // Exemplo: 6 meses para colheita
        return {
            harvestDate: harvestDate.toISOString().split('T')[0],
            estimatedYield: formData.area * 2.5 // Exemplo: 2.5 toneladas por hectare
        };
    }

    async calculateHarvestProbabilities(formData, harvestDate) {
        // Lógica para calcular probabilidades de colheita
        return {
            success: 0.8, // Exemplo: 80% de sucesso
            failure: 0.2  // Exemplo: 20% de falha
        };
    }

    showSimulationResults(baseResults, harvestProbabilities) {
        const resultsContainer = document.getElementById('simulationResults');
        resultsContainer.innerHTML = `
            <h3>Resultados da Simulação</h3>
            <p>Data de Colheita: ${baseResults.harvestDate}</p>
            <p>Produção Estimada: ${baseResults.estimatedYield} toneladas</p>
            <p>Probabilidade de Sucesso: ${harvestProbabilities.success * 100}%</p>
            <p>Probabilidade de Falha: ${harvestProbabilities.failure * 100}%</p>
        `;
    }

    async handleSimulation(event) {
        event.preventDefault();
        
        if (!this.selectedLocation || !this.climateData) {
            document.getElementById('locationWarning').style.display = 'flex';
            return;
        }

        showLoadingAnimation();

        try {
            const formData = new FormData(event.target);
            const data = {
                crop: formData.get('crop'),
                area: formData.get('area'),
                startDate: formData.get('startDate'),
                location: this.selectedLocation,
                climateData: this.climateData
            };

            const results = await this.calculateSimulationResults(data);
            this.showSimulationResults(results);
            
            // Salvar no histórico
            await StorageService.saveToHistory({
                ...data,
                results,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Erro na simulação:', error);
            showError(error.message || 'Erro ao processar simulação');
        } finally {
            hideLoadingAnimation();
        }
    }

    async calculateSimulationResults(data) {
        // Análise dos dados climáticos
        const { climateData } = data;
        
        // Calcula médias de temperatura e precipitação
        const temperatures = Object.values(climateData.T2M);
        const precipitation = Object.values(climateData.PRECTOT);
        
        const avgTemp = temperatures.reduce((a, b) => a + b) / temperatures.length;
        const totalPrecip = precipitation.reduce((a, b) => a + b);
        
        // Definição de faixas ideais por cultura
        const idealRanges = {
            soja: { tempMin: 20, tempMax: 30, precipMin: 450, precipMax: 800 },
            milho: { tempMin: 18, tempMax: 32, precipMin: 500, precipMax: 800 },
            trigo: { tempMin: 15, tempMax: 24, precipMin: 400, precipMax: 600 }
        };
        
        const ideal = idealRanges[data.crop];
        
        // Cálculo da probabilidade
        let tempScore = 1 - Math.abs(avgTemp - (ideal.tempMax + ideal.tempMin) / 2) / 
                           ((ideal.tempMax - ideal.tempMin) / 2);
        
        let precipScore = 1 - Math.abs(totalPrecip - (ideal.precipMax + ideal.precipMin) / 2) / 
                            ((ideal.precipMax - ideal.precipMin) / 2);
        
        // Normalização dos scores entre 0 e 1
        tempScore = Math.max(0, Math.min(1, tempScore));
        precipScore = Math.max(0, Math.min(1, precipScore));
        
        // Média ponderada dos scores
        const probability = (tempScore * 0.6 + precipScore * 0.4) * 100;
        
        return {
            probability: Math.round(probability),
            avgTemperature: avgTemp.toFixed(1),
            totalPrecipitation: totalPrecip.toFixed(1),
            harvestDate: this.calculateHarvestDate(data.startDate, data.crop)
        };
    }

    calculateHarvestDate(startDate, crop) {
        const cycleLength = {
            soja: 120,
            milho: 150,
            trigo: 130
        };
        
        const date = new Date(startDate);
        date.setDate(date.getDate() + cycleLength[crop]);
        return date.toISOString().split('T')[0];
    }

    showSimulationResults(results) {
        const container = document.getElementById('simulationResults');
        container.innerHTML = `
            <div class="results-card">
                <h3>Resultados da Simulação</h3>
                <div class="result-item">
                    <span>Probabilidade de Sucesso:</span>
                    <strong>${results.probability}%</strong>
                </div>
                <div class="result-item">
                    <span>Temperatura Média:</span>
                    <strong>${results.avgTemperature}°C</strong>
                </div>
                <div class="result-item">
                    <span>Precipitação Total:</span>
                    <strong>${results.totalPrecipitation}mm</strong>
                </div>
                <div class="result-item">
                    <span>Data Prevista para Colheita:</span>
                    <strong>${results.harvestDate}</strong>
                </div>
            </div>
        `;
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    const app = AgroDecision.getInstance();
    app.initialize();
});

// Exportar instância
window.app = AgroDecision.getInstance();