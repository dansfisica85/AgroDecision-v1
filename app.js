// Variáveis Globais
let map, marker;
window.climateData = null;

// Configurações
const CONFIG = {
    NASA_API: {
        URL: 'https://power.larc.nasa.gov/api/temporal/daily/point',
        KEY: 'cD4nquJnpJQYhZgX4HwYuYsA1gUNWB07Bfa5Bg8T'
    },
    GNEWS_API: {
        URL: 'https://gnews.io/api/v4/search',
        KEY: '2438f075a8af22eed32fb958a2ed30f3'
    },
    MAP_CENTER: [-15.7801, -47.9292], // Centro do Brasil
    MAP_ZOOM: 5,
    DATE_FORMAT: { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
    }
};

// Dados base de produtividade (ton/hectare) e condições ideais
const CROP_DATA = {
    'Soja': {
        evapotranspiration: { min: 500, max: 700 },
        solarRadiation: { min: 18, max: 22 },
        precipitation: { min: 450, max: 700 },
        humidity: { min: 60, max: 80 },
        temperature: { min: 20, max: 30 }
    },
    'Milho': {
        evapotranspiration: { min: 450, max: 650 },
        solarRadiation: { min: 20, max: 24 },
        precipitation: { min: 500, max: 800 },
        humidity: { min: 60, max: 80 },
        temperature: { min: 21, max: 29 }
    },
    'Cana-de-açúcar': {
        evapotranspiration: { min: 1500, max: 2000 },
        solarRadiation: { min: 18, max: 24 },
        precipitation: { min: 1200, max: 1800 },
        humidity: { min: 70, max: 80 },
        temperature: { min: 24, max: 30 }
    },
    // Adicione as outras culturas aqui conforme fornecido
};

// Fatores de solo
const SOIL_FACTORS = {
    clay: { factor: 1.1, name: 'Argiloso' },
    sandy: { factor: 0.8, name: 'Arenoso' },
    loam: { factor: 1.3, name: 'Franco' }
};

// Funções de Inicialização
async function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

async function checkDependencies() {
    try {
        if (!window.L) {
            await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
        }
        if (!window.Chart) {
            await loadScript('https://cdn.jsdelivr.net/npm/chart.js');
        }
    } catch (error) {
        console.error('Erro ao carregar dependências:', error);
        throw new Error('Falha ao carregar scripts necessários');
    }
}

// Carregamento inicial
window.onload = async function() {
    try {
        showLoadingAnimation();
        await checkDependencies();
        await initMap();
        
        // Verificar rota inicial
        const hash = window.location.hash.slice(1);
        if (hash) {
            showScreen(hash);
        }

        // Configurar navegação
        window.addEventListener('hashchange', () => {
            const newHash = window.location.hash.slice(1);
            if (newHash) {
                showScreen(newHash);
            } else {
                showScreen('home');
            }
        });

    } catch (error) {
        console.error('Erro na inicialização:', error);
        showError('Erro ao inicializar a aplicação');
    } finally {
        hideLoadingAnimation();
    }
};

// Inicialização do Mapa
async function initMap() {
    try {
        map = L.map('map', {
            zoomControl: false,
            minZoom: 4,
            maxZoom: 18
        }).setView(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM);
        
        // Adicionar controles de zoom
        L.control.zoom({
            position: 'topleft'
        }).addTo(map);

        // Adicionar camada base do mapa
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Mostrar popup inicial
        showInitialPopup();
        
        // Configurar busca e eventos
        setupSearch();
        setupMapEvents();
        
        // Carregar localização salva
        loadSavedLocation();

    } catch (error) {
        console.error('Erro ao inicializar mapa:', error);
        showError('Erro ao carregar o mapa. Por favor, recarregue a página.');
    }
}

// Popup Inicial
function showInitialPopup() {
    const initialPopup = L.popup()
        .setLatLng(CONFIG.MAP_CENTER)
        .setContent(`
            <div class="intro-popup">
                <h3>Bem-vindo ao AgroDecision!</h3>
                <p>Selecione uma localização no mapa para começar sua simulação</p>
            </div>
        `)
        .openOn(map);
}

// Configuração da Busca
function setupSearch() {
    const searchInput = document.getElementById('addressSearch');
    const searchResults = document.getElementById('searchResults');
    let searchTimeout;

    searchInput.addEventListener('input', function(e) {
        clearTimeout(searchTimeout);
        searchResults.innerHTML = '';
        
        if (e.target.value.length < 3) return;
        
        searchTimeout = setTimeout(() => {
            searchLocation(e.target.value, searchResults);
        }, 500);
    });

    // Fechar resultados quando clicar fora
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.map-search-container')) {
            searchResults.innerHTML = '';
        }
    });
}

// Busca de Localização
async function searchLocation(query, resultsContainer) {
    try {
        showLoadingAnimation();
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=br`
        );
        
        if (!response.ok) throw new Error('Erro na busca');
        
        const data = await response.json();
        
        resultsContainer.innerHTML = data
            .slice(0, 5)
            .map(result => `
                <div class="search-result-item" 
                     onclick="selectLocation(${result.lat}, ${result.lon}, '${result.display_name.replace(/'/g, "\\'")}')"
                >
                    ${result.display_name}
                </div>
            `).join('');
    } catch (error) {
        console.error('Erro na busca:', error);
        resultsContainer.innerHTML = '<div class="search-error">Erro ao buscar localização</div>';
    } finally {
        hideLoadingAnimation();
    }
}

// Eventos do Mapa
function setupMapEvents() {
    map.on('click', async function(e) {
        try {
            showLoadingAnimation();
            await handleLocationSelect(e.latlng);
        } catch (error) {
            console.error('Erro ao processar localização:', error);
            showError('Erro ao selecionar localização');
        } finally {
            hideLoadingAnimation();
        }
    });
}

// Seleção de Localização
async function handleLocationSelect(latlng) {
    if (marker) marker.remove();
    
    marker = L.marker(latlng).addTo(map);
    
    // Buscar dados climáticos
    const climateData = await getNASAData(latlng.lat, latlng.lng);
    if (climateData) {
        window.climateData = climateData;
        saveLocation(latlng);
        
        // Atualizar interface
        updateLocationWarning();
    }
}

// Salvar e Carregar Localização
function saveLocation(latlng) {
    try {
        localStorage.setItem('selectedLocation', JSON.stringify({
            lat: latlng.lat,
            lng: latlng.lng,
            timestamp: new Date().toISOString()
        }));
    } catch (error) {
        console.error('Erro ao salvar localização:', error);
    }
}

function loadSavedLocation() {
    try {
        const savedLocation = localStorage.getItem('selectedLocation');
        if (savedLocation) {
            const location = JSON.parse(savedLocation);
            if (location && location.lat && location.lng) {
                selectLocation(location.lat, location.lng, 'Local Anterior');
            }
        }
    } catch (error) {
        console.error('Erro ao carregar localização salva:', error);
    }
}

// Seleção de Localização da Busca
async function selectLocation(lat, lon, displayName) {
    const latlng = { lat: parseFloat(lat), lng: parseFloat(lon) };
    
    if (marker) marker.remove();
    
    marker = L.marker(latlng).addTo(map);
    map.setView(latlng, 13);
    
    // Limpar resultados da busca
    document.getElementById('searchResults').innerHTML = '';
    document.getElementById('addressSearch').value = displayName;
    
    // Buscar dados e salvar localização
    const climateData = await getNASAData(latlng.lat, latlng.lng);
    if (climateData) {
        window.climateData = climateData;
        saveLocation(latlng);
        updateLocationWarning();
    }
}

// Atualizar Aviso de Localização
function updateLocationWarning() {
    const warning = document.getElementById('locationWarning');
    if (warning) {
        warning.style.display = window.climateData ? 'none' : 'flex';
    }
}

// Busca de Dados da NASA
async function getNASAData(lat, lng) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - 1);
    
    const formatDate = (date) => {
        return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    };

    const params = new URLSearchParams({
        parameters: 'T2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN,RH2M',
        community: 'RE',
        longitude: lng.toFixed(4),
        latitude: lat.toFixed(4),
        start: formatDate(startDate),
        end: formatDate(endDate),
        format: 'JSON',
        api_key: CONFIG.NASA_API.KEY
    });

    try {
        const response = await fetch(`${CONFIG.NASA_API.URL}?${params}`);
        if (!response.ok) throw new Error('Erro na requisição à API da NASA');
        
        const data = await response.json();
        processClimateData(data);
        return data;
    } catch (error) {
        console.error('Erro ao buscar dados climáticos:', error);
        showError('Não foi possível obter dados climáticos para esta localização');
        return null;
    }
}

// Processamento de Dados Climáticos
function processClimateData(data) {
    if (!data?.properties?.parameter) return null;

    const params = data.properties.parameter;
    const processed = {
        temperature: {
            avg: calculateAverage(Object.values(params.T2M)),
            min: Math.min(...Object.values(params.T2M)),
            max: Math.max(...Object.values(params.T2M))
        },
        humidity: {
            avg: calculateAverage(Object.values(params.RH2M)),
            min: Math.min(...Object.values(params.RH2M)),
            max: Math.max(...Object.values(params.RH2M))
        },
        precipitation: {
            total: Object.values(params.PRECTOTCORR).reduce((a, b) => a + b, 0),
            daily: calculateAverage(Object.values(params.PRECTOTCORR))
        },
        solarRadiation: {
            avg: calculateAverage(Object.values(params.ALLSKY_SFC_SW_DWN)),
            min: Math.min(...Object.values(params.ALLSKY_SFC_SW_DWN)),
            max: Math.max(...Object.values(params.ALLSKY_SFC_SW_DWN))
        }
    };

    return processed;
}

// Análise Climática por Período
function analyzeClimateForPeriod(startDate, endDate) {
    if (!window.climateData?.properties?.parameter) return null;

    const params = window.climateData.properties.parameter;
    const relevantData = filterDataByDateRange(params, startDate, endDate);

    return {
        temperature: analyzeTemperature(relevantData.T2M),
        humidity: analyzeHumidity(relevantData.RH2M),
        precipitation: analyzePrecipitation(relevantData.PRECTOTCORR),
        solarRadiation: analyzeSolarRadiation(relevantData.ALLSKY_SFC_SW_DWN)
    };
}

// Funções de Análise Específicas
function analyzeTemperature(tempData) {
    const values = Object.values(tempData);
    return {
        avg: calculateAverage(values),
        min: Math.min(...values),
        max: Math.max(...values),
        variance: calculateVariance(values),
        extremeDays: countExtremeDays(values)
    };
}

function analyzeHumidity(humidityData) {
    const values = Object.values(humidityData);
    return {
        avg: calculateAverage(values),
        min: Math.min(...values),
        max: Math.max(...values),
        stability: calculateStabilityIndex(values)
    };
}

function analyzePrecipitation(precipData) {
    const values = Object.values(precipData);
    return {
        total: values.reduce((a, b) => a + b, 0),
        average: calculateAverage(values),
        daysWithRain: values.filter(v => v > 0).length,
        distribution: calculateDistribution(values)
    };
}

function analyzeSolarRadiation(solarData) {
    const values = Object.values(solarData);
    return {
        avg: calculateAverage(values),
        min: Math.min(...values),
        max: Math.max(...values),
        variance: calculateVariance(values)
    };
}

// Funções de Cálculo
function calculateAverage(values) {
    return values.reduce((a, b) => a + b, 0) / values.length;
}

function calculateVariance(values) {
    const avg = calculateAverage(values);
    return values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / values.length;
}

function calculateStabilityIndex(values) {
    const variance = calculateVariance(values);
    const avg = calculateAverage(values);
    return 1 - (Math.sqrt(variance) / avg);
}

function calculateDistribution(values) {
    const total = values.reduce((a, b) => a + b, 0);
    const sorted = [...values].sort((a, b) => a - b);
    
    return {
        q1: sorted[Math.floor(sorted.length * 0.25)],
        median: sorted[Math.floor(sorted.length * 0.5)],
        q3: sorted[Math.floor(sorted.length * 0.75)],
        intensity: total / Math.max(values.filter(v => v > 0).length, 1)
    };
}

function countExtremeDays(values) {
    const avg = calculateAverage(values);
    const std = Math.sqrt(calculateVariance(values));
    return {
        hot: values.filter(v => v > avg + 2 * std).length,
        cold: values.filter(v => v < avg - 2 * std).length
    };
}

// Funções de Filtragem
function filterDataByDateRange(data, startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const filtered = {};
    for (const param in data) {
        filtered[param] = {};
        for (const date in data[param]) {
            const currentDate = new Date(date);
            if (currentDate >= start && currentDate <= end) {
                filtered[param][date] = data[param][date];
            }
        }
    }
    return filtered;
}

// Funções de Status
function getClimateStatus(conditions, crop) {
    const cropData = CROP_DATA[crop];
    if (!cropData) return 'unknown';

    const tempStatus = getTemperatureStatus(conditions.temperature.avg, cropData.temperature);
    const humidityStatus = getHumidityStatus(conditions.humidity.avg, cropData.humidity);
    const precipStatus = getPrecipitationStatus(conditions.precipitation.total, cropData.precipitation);
    const solarStatus = getSolarRadiationStatus(conditions.solarRadiation.avg, cropData.solarRadiation);

    // Combinar status individuais para status geral
    const statuses = [tempStatus, humidityStatus, precipStatus, solarStatus];
    const idealCount = statuses.filter(s => s === 'ideal').length;

    if (idealCount >= 3) return 'favorable';
    if (idealCount >= 2) return 'moderate';
    return 'unfavorable';
}

// Simulação de Colheita
async function handleSimulation(event) {
    event.preventDefault();
    
    try {
        if (!window.climateData) {
            document.getElementById('locationWarning').style.display = 'flex';
            return;
        }

        showLoadingAnimation();

        // Coletar dados do formulário
        const formData = {
            crop: document.getElementById('crop').value,
            area: parseFloat(document.getElementById('area').value),
            irrigation: document.getElementById('irrigation').value,
            soil: document.getElementById('soil').value,
            plantingDate: document.getElementById('plantingDate').value
        };

        // Validar dados
        validateFormData(formData);

        // Calcular resultados
        const results = calculateCropMetrics(formData);
        
        // Calcular probabilidades
        const probabilities = await calculateHarvestProbabilities(
            formData,
            new Date(results.harvestDate)
        );

        // Exibir resultados
        showSimulationResults(results, probabilities);

        // Salvar no histórico
        await saveToHistory({
            ...formData,
            results,
            probabilities,
            location: {
                lat: marker.getLatLng().lat,
                lng: marker.getLatLng().lng
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Erro na simulação:', error);
        showError(error.message || 'Erro ao processar simulação');
    } finally {
        hideLoadingAnimation();
    }
}

// Cálculo de Métricas da Cultura
function calculateCropMetrics(formData) {
    const crop = CROP_DATA[formData.crop];
    if (!crop) throw new Error('Cultura não suportada');

    // Calcular eficiência de irrigação
    const irrigationEfficiency = calculateIrrigationEfficiency(window.climateData);

    // Validar tipo de solo
    if (!SOIL_FACTORS[formData.soil]) {
        throw new Error('Tipo de solo não suportado');
    }

    // Cálculos base
    const soilFactor = SOIL_FACTORS[formData.soil].factor;
    const yieldPerHectare = crop.baseYield * irrigationEfficiency * soilFactor;
    const totalYield = yieldPerHectare * formData.area;

    // Calcular necessidade hídrica
    const waterRequired = (crop.waterNeed * formData.area) / irrigationEfficiency;

    // Calcular data de colheita
    const harvestDate = new Date(formData.plantingDate);
    harvestDate.setDate(harvestDate.getDate() + crop.cropCycle);

    return {
        yield: totalYield.toFixed(2),
        water: waterRequired.toFixed(2),
        cycle: crop.cropCycle,
        harvestDate: harvestDate.toISOString().split('T')[0],
        yieldPerHectare: yieldPerHectare.toFixed(2),
        irrigationEfficiency: irrigationEfficiency.toFixed(2),
        soilFactor: soilFactor
    };
}

// Cálculo de Probabilidades
async function calculateHarvestProbabilities(formData, baseHarvestDate) {
    const probabilities = [];
    const daysRange = 3; // +/- 3 dias
    const crop = CROP_DATA[formData.crop];

    for (let i = -daysRange; i <= daysRange; i++) {
        const currentDate = new Date(baseHarvestDate);
        currentDate.setDate(currentDate.getDate() + i);
        
        const conditions = analyzeHistoricalConditions(
            currentDate,
            formData.crop,
            window.climateData
        );

        const probability = calculateSuccessProbability(conditions, crop);
        
        probabilities.push({
            date: currentDate.toISOString().split('T')[0],
            probability,
            conditions
        });
    }

    return probabilities;
}

// Análise de Condições Históricas
function analyzeHistoricalConditions(date, cropType, climateData) {
    const month = date.getMonth();
    const historicalData = getHistoricalDataForMonth(month, climateData);
    const crop = CROP_DATA[cropType];

    return {
        temperature: {
            value: historicalData.temperature,
            ideal: crop.temperature,
            status: getTemperatureStatus(historicalData.temperature, crop.temperature)
        },
        humidity: {
            value: historicalData.humidity,
            ideal: crop.humidity,
            status: getHumidityStatus(historicalData.humidity, crop.humidity)
        },
        precipitation: {
            value: historicalData.precipitation,
            status: getPrecipitationStatus(historicalData.precipitation)
        },
        solarRadiation: {
            value: historicalData.solarRadiation,
            ideal: crop.solarRadiation,
            status: getSolarRadiationStatus(historicalData.solarRadiation, crop.solarRadiation)
        }
    };
}

// Cálculo de Probabilidade de Sucesso
function calculateSuccessProbability(conditions, crop) {
    const weights = {
        temperature: 0.4,
        humidity: 0.3,
        precipitation: 0.2,
        solarRadiation: 0.1
    };

    const tempScore = calculateTemperatureScore(conditions.temperature, crop);
    const humidityScore = calculateHumidityScore(conditions.humidity, crop);
    const precipScore = calculatePrecipitationScore(conditions.precipitation, crop);
    const solarScore = calculateSolarRadiationScore(conditions.solarRadiation, crop);

    const weightedScore = 
        (tempScore * weights.temperature) +
        (humidityScore * weights.humidity) +
        (precipScore * weights.precipitation) +
        (solarScore * weights.solarRadiation);

    // Converter para porcentagem e limitar entre 5% e 95%
    return Math.min(95, Math.max(5, weightedScore * 100));
}

// Funções de Pontuação
function calculateTemperatureScore(temp, crop) {
    const { min, max } = crop.temperature;
    const value = temp.value;

    if (value >= min && value <= max) return 1;
    
    const deviation = Math.min(
        Math.abs(value - min),
        Math.abs(value - max)
    );

    return Math.max(0, 1 - (deviation / 10));
}

function calculateHumidityScore(humidity, crop) {
    const { min, max } = crop.humidity;
    const value = humidity.value;

    if (value >= min && value <= max) return 1;
    
    const deviation = Math.min(
        Math.abs(value - min),
        Math.abs(value - max)
    );

    return Math.max(0, 1 - (deviation / 20));
}

function calculatePrecipitationScore(precip, crop) {
    const ideal = crop.waterNeed / crop.cropCycle; // Necessidade diária
    const value = precip.value;

    const deviation = Math.abs(value - ideal);
    return Math.max(0, 1 - (deviation / ideal));
}

function calculateSolarRadiationScore(solar, crop) {
    const { min, max } = crop.solarRadiation;
    const value = solar.value;

    if (value >= min && value <= max) return 1;
    
    const deviation = Math.min(
        Math.abs(value - min),
        Math.abs(value - max)
    );

    return Math.max(0, 1 - (deviation / 5));
}

// Gerenciamento de Telas
function showScreen(screenName) {
    const content = document.getElementById('content');
    const map = document.getElementById('map-container');

    if (screenName === 'home') {
        content.style.display = 'none';
        map.style.display = 'block';
        map.invalidateSize();
    } else {
        content.style.display = 'block';
        map.style.display = 'none';
        
        showLoadingAnimation();
        
        switch(screenName) {
            case 'simulation':
                loadSimulationScreen();
                break;
            case 'news':
                loadNewsScreen();
                break;
            case 'history':
                loadHistoryScreen();
                break;
        }

        hideLoadingAnimation();
    }

    // Fechar sidebar
    toggleSidebar();
}

// Tela de Simulação
function loadSimulationScreen() {
    const content = document.getElementById('content');
    const hasLocation = window.climateData !== undefined;

    content.innerHTML = `
        <div class="simulation-container">
            <h2>Simulação de Colheita</h2>
            
            <div class="location-warning" id="locationWarning" 
                 style="display: ${hasLocation ? 'none' : 'flex'}">
                <p>⚠️ Selecione uma localização no mapa antes de simular</p>
            </div>

            <form id="simulationForm" onsubmit="handleSimulation(event)">
                <div class="form-grid">
                    <div class="input-group">
                        <label for="crop">Cultura</label>
                        <select class="modern-input" id="crop" required>
                            <option value="">Selecione a cultura</option>
                            ${generateCropOptions()}
                        </select>
                    </div>

                    <div class="input-group">
                        <label for="area">Área (hectares)</label>
                        <input type="number" class="modern-input" id="area" 
                               required min="0.1" step="0.1" value="1.0">
                    </div>

                    <div class="input-group">
                        <label for="irrigation">Sistema de Irrigação</label>
                        <select class="modern-input" id="irrigation" required>
                            <option value="">Selecione o sistema</option>
                            <option value="cerqueiro">Sistema Cerqueiro (Climático)</option>
                        </select>
                    </div>

                    <div class="input-group">
                        <label for="soil">Tipo de Solo</label>
                        <select class="modern-input" id="soil" required>
                            <option value="">Selecione o tipo de solo</option>
                            ${generateSoilOptions()}
                        </select>
                    </div>

                    <div class="input-group">
                        <label for="plantingDate">Data do Plantio</label>
                        <input type="date" class="modern-input" id="plantingDate" required>
                    </div>
                </div>

                <button type="submit" class="modern-button">
                    Simular Colheita
                </button>
            </form>

            <div id="simulationResults" class="results-container"></div>
        </div>
    `;

    // Configurar data mínima como hoje
    const plantingDateInput = document.getElementById('plantingDate');
    const today = new Date().toISOString().split('T')[0];
    plantingDateInput.min = today;
    plantingDateInput.value = today;
}

// Exibição dos Resultados
function showSimulationResults(results, probabilities) {
    const container = document.getElementById('simulationResults');
    
    container.innerHTML = `
        <h3>Resultados da Simulação</h3>
        
        <div class="results-grid">
            <div class="result-card">
                <div class="result-icon">📊</div>
                <h4>Produtividade Estimada</h4>
                <div class="result-value">${results.yield} ton</div>
                <div class="result-detail">${results.yieldPerHectare} ton/ha</div>
            </div>

            <div class="result-card">
                <div class="result-icon">💧</div>
                <h4>Necessidade Hídrica</h4>
                <div class="result-value">${results.water} mm</div>
                <div class="result-detail">
                    Eficiência: ${(results.irrigationEfficiency * 100).toFixed(1)}%
                </div>
            </div>

            <div class="result-card">
                <div class="result-icon">📅</div>
                <h4>Ciclo de Cultivo</h4>
                <div class="result-value">${results.cycle} dias</div>
                <div class="result-detail">
                    Colheita: ${formatDate(results.harvestDate)}
                </div>
            </div>
        </div>

        ${createProbabilitiesTimeline(probabilities)}
        ${createDetailedAnalysis(results, probabilities)}
    `;

    // Inicializar gráficos
    initializeResultCharts(results, probabilities);
    
    // Animar entrada dos resultados
    animateResults();
}

// Timeline de Probabilidades
function createProbabilitiesTimeline(probabilities) {
    return `
        <div class="probability-timeline">
            <h4>Janela de Colheita</h4>
            <div class="timeline-container">
                ${probabilities.map((prob, index) => `
                    <div class="timeline-item ${getProbabilityClass(prob.probability)}"
                         style="animation-delay: ${0.1 * index}s">
                        <div class="date">${formatDate(prob.date)}</div>
                        <div class="probability-bar">
                            <div class="bar-fill" style="height: ${prob.probability}%">
                                <span>${Math.round(prob.probability)}%</span>
                            </div>
                        </div>
                        <div class="conditions">
                            ${createConditionIcons(prob.conditions)}
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="timeline-legend">
                ${createTimelineLegend()}
            </div>
        </div>
    `;
}

// Funções de Suporte para Interface
function generateCropOptions() {
    return Object.entries(CROP_DATA)
        .sort((a, b) => a[1].cropName.localeCompare(b[1].cropName))
        .map(([value, data]) => `
            <option value="${value}">${data.cropName}</option>
        `).join('');
}

function generateSoilOptions() {
    return Object.entries(SOIL_FACTORS)
        .map(([value, data]) => `
            <option value="${value}">${data.name}</option>
        `).join('');
}

function createConditionIcons(conditions) {
    const icons = {
        temperature: {
            ideal: '🌡️',
            high: '🔥',
            low: '❄️'
        },
        humidity: {
            ideal: '💧',
            high: '💦',
            low: '🏜️'
        },
        precipitation: {
            ideal: '☔',
            high: '⛈️',
            low: '☀️'
        },
        solarRadiation: {
            ideal: '☀️',
            high: '🌞',
            low: '🌥️'
        }
    };

    return `
        <span title="Temperatura: ${conditions.temperature.status}">
            ${icons.temperature[conditions.temperature.status]}
        </span>
        <span title="Umidade: ${conditions.humidity.status}">
            ${icons.humidity[conditions.humidity.status]}
        </span>
        <span title="Precipitação: ${conditions.precipitation.status}">
            ${icons.precipitation[conditions.precipitation.status]}
        </span>
        <span title="Radiação Solar: ${conditions.solarRadiation.status}">
            ${icons.solarRadiation[conditions.solarRadiation.status]}
        </span>
    `;
}

// Interface Functions
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('open');
}

function showLoadingAnimation() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoadingAnimation() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function showError(message) {
    Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: message,
        confirmButtonColor: '#4CAF50'
    });
}

// Histórico
async function saveToHistory(data) {
    try {
        const history = JSON.parse(localStorage.getItem('simulationHistory') || '[]');
        history.unshift({
            id: Date.now(),
            ...data
        });
        
        // Manter apenas últimas 50 simulações
        if (history.length > 50) history.length = 50;
        
        localStorage.setItem('simulationHistory', JSON.stringify(history));
    } catch (error) {
        console.error('Erro ao salvar no histórico:', error);
    }
}

async function loadHistoryScreen() {
    const content = document.getElementById('content');
    try {
        const history = JSON.parse(localStorage.getItem('simulationHistory') || '[]');
        
        content.innerHTML = `
            <div class="history-container">
                <h2>Histórico de Simulações</h2>
                <div class="history-grid">
                    ${history.map(item => createHistoryCard(item)).join('')}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
        content.innerHTML = '<p>Erro ao carregar histórico</p>';
    }
}

function createHistoryCard(item) {
    return `
        <div class="history-card">
            <div class="history-header">
                <h4>${CROP_DATA[item.crop].cropName}</h4>
                <span>${formatDate(item.timestamp)}</span>
            </div>
            <div class="history-details">
                <p><strong>Local:</strong> ${item.location.lat.toFixed(4)}, ${item.location.lng.toFixed(4)}</p>
                <p><strong>Área:</strong> ${item.area} hectares</p>
                <p><strong>Produtividade:</strong> ${item.results.yield} ton</p>
                <p><strong>Data Plantio:</strong> ${formatDate(item.plantingDate)}</p>
                <p><strong>Data Colheita:</strong> ${formatDate(item.results.harvestDate)}</p>
            </div>
        </div>
    `;
}

// Notícias
async function loadNewsScreen() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="news-container"><h2>Notícias do Agro</h2><div class="news-grid" id="newsGrid"></div></div>';
    
    try {
        const news = await fetchAgriNews();
        displayNews(news);
    } catch (error) {
        console.error('Erro ao carregar notícias:', error);
        document.getElementById('newsGrid').innerHTML = '<p>Erro ao carregar notícias</p>';
    }
}

async function fetchAgriNews() {
    const params = new URLSearchParams({
        q: 'agricultura brasil',
        lang: 'pt',
        country: 'br',
        max: 9,
        apikey: CONFIG.GNEWS_API.KEY
    });

    const response = await fetch(`${CONFIG.GNEWS_API.URL}?${params}`);
    if (!response.ok) throw new Error('Erro ao buscar notícias');
    
    const data = await response.json();
    return data.articles;
}

function displayNews(articles) {
    const newsGrid = document.getElementById('newsGrid');
    
    newsGrid.innerHTML = articles.map(article => `
        <div class="news-card">
            <img src="${article.image || '/placeholder.jpg'}" alt="${article.title}" class="news-image">
            <div class="news-content">
                <h3>${article.title}</h3>
                <p>${article.description}</p>
                <a href="${article.url}" target="_blank" rel="noopener noreferrer">Ler mais</a>
            </div>
        </div>
    `).join('');
}

// Funções de Utilidade
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('pt-BR', CONFIG.DATE_FORMAT);
}

function getProbabilityClass(probability) {
    if (probability >= 80) return 'high-probability';
    if (probability >= 60) return 'medium-probability';
    return 'low-probability';
}

function createTimelineLegend() {
    return `
        <div class="legend-item">
            <span class="legend-color high-probability"></span>
            <span>Alta Probabilidade (>80%)</span>
        </div>
        <div class="legend-item">
            <span class="legend-color medium-probability"></span>
            <span>Média Probabilidade (60-80%)</span>
        </div>
        <div class="legend-item">
            <span class="legend-color low-probability"></span>
            <span>Baixa Probabilidade (<60%)</span>
        </div>
    `;
}

// Validações
function validateFormData(data) {
    if (!CROP_DATA[data.crop]) {
        throw new Error('Cultura inválida');
    }
    
    if (data.area <= 0) {
        throw new Error('Área deve ser maior que zero');
    }
    
    if (!SOIL_FACTORS[data.soil]) {
        throw new Error('Tipo de solo inválido');
    }
    
    const plantingDate = new Date(data.plantingDate);
    const today = new Date();
    
    if (plantingDate < today) {
        throw new Error('Data de plantio deve ser futura');
    }
}

// Análises Detalhadas
function createDetailedAnalysis(results, probabilities) {
    const avgProbability = calculateAverage(probabilities.map(p => p.probability));
    const bestDate = probabilities.reduce((a, b) => 
        a.probability > b.probability ? a : b
    );
    
    return `
        <div class="detailed-analysis">
            <h3>Análise Detalhada</h3>
            
            <div class="analysis-grid">
                <div class="analysis-card">
                    <h4>Janela de Colheita</h4>
                    <p>Probabilidade média: ${avgProbability.toFixed(1)}%</p>
                    <p>Melhor data: ${formatDate(bestDate.date)} (${Math.round(bestDate.probability)}%)</p>
                </div>
                
                <div class="analysis-card">
                    <h4>Recomendações</h4>
                    <ul>
                        <li>Monitore as condições climáticas próximo à colheita</li>
                        <li>Prepare equipamentos com antecedência</li>
                        <li>Considere contratar seguro agrícola</li>
                    </ul>
                </div>
            </div>
        </div>
    `;
}

// Animações
function animateResults() {
    const cards = document.querySelectorAll('.result-card');
    cards.forEach((card, index) => {
        card.style.animation = `fadeIn 0.5s ease-out ${index * 0.1}s forwards`;
    });
}

// Inicialização de Gráficos
function initializeResultCharts(results, probabilities) {
    const ctx = document.createElement('canvas');
    ctx.id = 'probabilityChart';
    document.querySelector('.probability-timeline').appendChild(ctx);
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: probabilities.map(p => formatDate(p.date)),
            datasets: [{
                label: 'Probabilidade de Sucesso',
                data: probabilities.map(p => p.probability),
                borderColor: '#4CAF50',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Probabilidade de Sucesso ao Longo do Período'
                }
            }
        }
    });
}