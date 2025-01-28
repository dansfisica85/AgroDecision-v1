// Variáveis Globais
let map, marker;
let climateData = null; // Substituído window.climateData por variável local

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
        baseYield: 3.5, // Adicionado baseYield
        waterNeed: 500, // Adicionado waterNeed
        cropCycle: 120, // Adicionado cropCycle
        evapotranspiration: { min: 500, max: 700 },
        solarRadiation: { min: 18, max: 22 },
        precipitation: { min: 450, max: 700 },
        humidity: { min: 60, max: 80 },
        temperature: { min: 20, max: 30 }
    },
    'Milho': {
        baseYield: 6.0, // Adicionado baseYield
        waterNeed: 600, // Adicionado waterNeed
        cropCycle: 100, // Adicionado cropCycle
        evapotranspiration: { min: 450, max: 650 },
        solarRadiation: { min: 20, max: 24 },
        precipitation: { min: 500, max: 800 },
        humidity: { min: 60, max: 80 },
        temperature: { min: 21, max: 29 }
    },
    'Cana-de-açúcar': {
        baseYield: 80.0, // Adicionado baseYield
        waterNeed: 1500, // Adicionado waterNeed
        cropCycle: 365, // Adicionado cropCycle
        evapotranspiration: { min: 1500, max: 2000 },
        solarRadiation: { min: 18, max: 24 },
        precipitation: { min: 1200, max: 1800 },
        humidity: { min: 70, max: 80 },
        temperature: { min: 24, max: 30 }
    }
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
        script.onerror = () => reject(new Error(`Erro ao carregar script: ${src}`));
        document.head.appendChild(script);
    });
}

async function checkDependencies() {
    try {
        if (!window.L) await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
        if (!window.Chart) await loadScript('https://cdn.jsdelivr.net/npm/chart.js');
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

        const hash = window.location.hash.slice(1);
        if (hash) showScreen(hash);

        window.addEventListener('hashchange', () => {
            const newHash = window.location.hash.slice(1);
            showScreen(newHash || 'home');
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

        L.control.zoom({ position: 'topleft' }).addTo(map);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        showInitialPopup();
        setupSearch();
        setupMapEvents();
        loadSavedLocation();
    } catch (error) {
        console.error('Erro ao inicializar mapa:', error);
        showError('Erro ao carregar o mapa. Por favor, recarregue a página.');
    }
}

// Popup Inicial
function showInitialPopup() {
    L.popup()
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

    document.addEventListener('click', function(e) {
        if (!e.target.closest('.map-search-container')) {
            searchResults.innerHTML = '';
        }
    });
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

    const data = await getNASAData(latlng.lat, latlng.lng);
    if (data) {
        climateData = data;
        saveLocation(latlng);
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
        showError('Não foi possível salvar a localização. Verifique as configurações do navegador.');
    }
}

function loadSavedLocation() {
    try {
        const savedLocation = localStorage.getItem('selectedLocation');
        if (savedLocation) {
            const location = JSON.parse(savedLocation);
            if (location?.lat && location?.lng) {
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

    document.getElementById('searchResults').innerHTML = '';
    document.getElementById('addressSearch').value = displayName;

    const data = await getNASAData(latlng.lat, latlng.lng);
    if (data) {
        climateData = data;
        saveLocation(latlng);
        updateLocationWarning();
    }
}

// Atualizar Aviso de Localização
function updateLocationWarning() {
    const warning = document.getElementById('locationWarning');
    if (warning) {
        warning.style.display = climateData ? 'none' : 'flex';
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
        if (!data?.properties?.parameter) throw new Error('Dados climáticos inválidos');

        return processClimateData(data);
    } catch (error) {
        console.error('Erro ao buscar dados climáticos:', error);
        showError('Não foi possível obter dados climáticos para esta localização');
        return null;
    }
}

// Processamento de Dados Climáticos
function processClimateData(data) {
    const params = data.properties.parameter;
    return {
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
}

// Funções de Cálculo
function calculateAverage(values) {
    return values.reduce((a, b) => a + b, 0) / values.length;
}

// Funções de Status
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

// Simulação de Colheita
async function handleSimulation(event) {
    event.preventDefault();

    try {
        if (!climateData) {
            document.getElementById('locationWarning').style.display = 'flex';
            return;
        }

        showLoadingAnimation();

        const formData = collectFormData();
        validateFormData(formData);

        const results = calculateCropMetrics(formData);
        const probabilities = await calculateHarvestProbabilities(formData, new Date(results.harvestDate));

        showSimulationResults(results, probabilities);
        await saveToHistory({ ...formData, results, probabilities });
    } catch (error) {
        console.error('Erro na simulação:', error);
        showError(error.message || 'Erro ao processar simulação');
    } finally {
        hideLoadingAnimation();
    }
}

// Coletar dados do formulário
function collectFormData() {
    return {
        crop: document.getElementById('crop').value,
        area: parseFloat(document.getElementById('area').value),
        irrigation: document.getElementById('irrigation').value,
        soil: document.getElementById('soil').value,
        plantingDate: document.getElementById('plantingDate').value
    };
}

// Validar dados do formulário
function validateFormData(data) {
    if (!CROP_DATA[data.crop]) throw new Error('Cultura inválida');
    if (data.area <= 0) throw new Error('Área deve ser maior que zero');
    if (!SOIL_FACTORS[data.soil]) throw new Error('Tipo de solo inválido');

    const plantingDate = new Date(data.plantingDate);
    const today = new Date();
    if (plantingDate < today) throw new Error('Data de plantio deve ser futura');
}

// Cálculo de Métricas da Cultura
function calculateCropMetrics(formData) {
    const crop = CROP_DATA[formData.crop];
    if (!crop) throw new Error('Cultura não suportada');

    const irrigationEfficiency = calculateIrrigationEfficiency(climateData);
    const soilFactor = SOIL_FACTORS[formData.soil].factor;
    const yieldPerHectare = crop.baseYield * irrigationEfficiency * soilFactor;
    const totalYield = yieldPerHectare * formData.area;
    const waterRequired = (crop.waterNeed * formData.area) / irrigationEfficiency;

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

// Cálculo de Eficiência de Irrigação
function calculateIrrigationEfficiency(climateData) {
    // Simulação de eficiência de irrigação baseada na precipitação
    const precipitation = climateData.precipitation.total;
    if (precipitation < 300) return 0.7; // Baixa eficiência em regiões secas
    if (precipitation > 800) return 1.2; // Alta eficiência em regiões úmidas
    return 1.0; // Eficiência padrão
}

// Cálculo de Probabilidades
async function calculateHarvestProbabilities(formData, baseHarvestDate) {
    const probabilities = [];
    const daysRange = 3; // +/- 3 dias
    const crop = CROP_DATA[formData.crop];

    for (let i = -daysRange; i <= daysRange; i++) {
        const currentDate = new Date(baseHarvestDate);
        currentDate.setDate(currentDate.getDate() + i);

        const conditions = analyzeHistoricalConditions(currentDate, formData.crop, climateData);
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

    return Math.min(95, Math.max(5, weightedScore * 100));
}

// Funções de Pontuação
function calculateTemperatureScore(temp, crop) {
    const { min, max } = crop.temperature;
    const value = temp.value;

    if (value >= min && value <= max) return 1;
    const deviation = Math.min(Math.abs(value - min), Math.abs(value - max));
    return Math.max(0, 1 - (deviation / 10));
}

function calculateHumidityScore(humidity, crop) {
    const { min, max } = crop.humidity;
    const value = humidity.value;

    if (value >= min && value <= max) return 1;
    const deviation = Math.min(Math.abs(value - min), Math.abs(value - max));
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
    const deviation = Math.min(Math.abs(value - min), Math.abs(value - max));
    return Math.max(0, 1 - (deviation / 5));
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
                <div class="result-detail">Eficiência: ${(results.irrigationEfficiency * 100).toFixed(1)}%</div>
            </div>
            <div class="result-card">
                <div class="result-icon">📅</div>
                <h4>Ciclo de Cultivo</h4>
                <div class="result-value">${results.cycle} dias</div>
                <div class="result-detail">Colheita: ${formatDate(results.harvestDate)}</div>
            </div>
        </div>
        ${createProbabilitiesTimeline(probabilities)}
        ${createDetailedAnalysis(results, probabilities)}
    `;

    initializeResultCharts(results, probabilities);
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

// Análises Detalhadas
function createDetailedAnalysis(results, probabilities) {
    const avgProbability = calculateAverage(probabilities.map(p => p.probability));
    const bestDate = probabilities.reduce((a, b) => a.probability > b.probability ? a : b);

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
                legend: { position: 'top' },
                title: {
                    display: true,
                    text: 'Probabilidade de Sucesso ao Longo do Período'
                }
            }
        }
    });
}

// Funções de Utilidade
function formatDate(dateString) {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) throw new Error('Data inválida');
    return date.toLocaleDateString('pt-BR', CONFIG.DATE_FORMAT);
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

// Animações
function animateResults() {
    const cards = document.querySelectorAll('.result-card');
    cards.forEach((card, index) => {
        card.style.animation = `fadeIn 0.5s ease-out ${index * 0.1}s forwards`;
    });
}

// Função toggleSidebar (adicionada para resolver o erro)
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('open');
}

// Carregar Tela de Notícias
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

// Buscar Notícias
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

// Exibir Notícias
function displayNews(articles) {
    const newsGrid = document.getElementById('newsGrid');
    newsGrid.innerHTML = articles.map(article => `
        <div class="news-card">
            <img src="${article.image || 'placeholder.jpg'}" alt="${article.title}" class="news-image">
            <div class="news-content">
                <h3>${article.title}</h3>
                <p>${article.description}</p>
                <a href="${article.url}" target="_blank" rel="noopener noreferrer">Ler mais</a>
            </div>
        </div>
    `).join('');
}

// Carregar Tela de Histórico
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

// Criar Card de Histórico
function createHistoryCard(item) {
    return `
        <div class="history-card">
            <div class="history-header">
                <h4>${item.crop}</h4>
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

// Salvar no Histórico
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

// Gerenciamento de Telas
function showScreen(screenId) {
    // Padrão para home se nenhuma tela for especificada
    screenId = screenId || 'home';
    
    // Telas disponíveis e suas funções correspondentes
    const screens = {
        'home': showHomeScreen,
        'simulate': showSimulateScreen,
        'news': loadNewsScreen,
        'history': loadHistoryScreen
    };

    // Atualiza o estado ativo na navegação
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-screen') === screenId) {
            item.classList.add('active');
        }
    });

    // Mostra a tela selecionada
    try {
        if (screens[screenId]) {
            screens[screenId]();
        } else {
            console.error('Tela não encontrada:', screenId);
            screens.home();
        }
    } catch (error) {
        console.error('Erro ao mostrar tela:', error);
        showError('Erro ao carregar a tela');
    }

    // Adiciona event listener ao formulário após criar o HTML
    const form = document.querySelector('form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Coleta os dados do formulário
        const area = document.getElementById('area').value;
        const irrigation = document.getElementById('irrigation').value;
        const soil = document.getElementById('soil').value;
        const plantingDate = document.getElementById('plantingDate').value;

        // Processa a simulação
        const results = calculateSimulation(area, irrigation, soil, plantingDate);
        
        // Exibe os resultados
        displayResults(results);
    });
}

function calculateSimulation(area, irrigation, soil, plantingDate) {
    // Exemplo de cálculo básico - ajuste conforme suas necessidades
    let produtividadeBase = 3000; // kg/ha
    
    // Ajustes baseados no sistema de irrigação
    const irrigationFactors = {
        'none': 1,
        'sprinkler': 1.3,
        'drip': 1.4
    };

    // Ajustes baseados no tipo de solo
    const soilFactors = {
        'clay': 1.2,
        'sandy': 0.9,
        'loam': 1.1
    };

    const produtividadeTotal = produtividadeBase * irrigationFactors[irrigation] * soilFactors[soil];
    const producaoTotal = produtividadeTotal * area;

    return {
        area: area,
        produtividadeEstimada: produtividadeTotal.toFixed(2),
        producaoTotal: producaoTotal.toFixed(2),
        dataPlantio: plantingDate
    };
}

function displayResults(results) {
    const resultsDiv = document.getElementById('simulationResults');
    resultsDiv.innerHTML = `
        <h3>Resultados da Simulação</h3>
        <p>Área: ${results.area} hectares</p>
        <p>Produtividade Estimada: ${results.produtividadeEstimada} kg/ha</p>
        <p>Produção Total Estimada: ${results.producaoTotal} kg</p>
        <p>Data de Plantio: ${new Date(results.dataPlantio).toLocaleDateString('pt-BR')}</p>
    `;
}

// Tela Inicial
function showHomeScreen() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="welcome-container">
            <h1>Bem-vindo ao AgroDecision</h1>
            <p>Selecione uma localização no mapa e comece sua simulação de cultivo.</p>
            <div id="locationWarning" class="warning-message" style="display: none;">
                <i class="fas fa-exclamation-triangle"></i>
                Selecione uma localização no mapa antes de continuar
            </div>
        </div>
        <div id="map" class="map-container"></div>
        <div class="map-search-container">
            <input type="text" id="addressSearch" placeholder="Buscar localização...">
            <div id="searchResults" class="search-results"></div>
        </div>
    `;
    
    // Reinicializa o mapa se necessário
    if (!map) {
        initMap();
    } else {
        // Atualiza o container do mapa
        map.invalidateSize();
    }
}

// Tela de Simulação
function showSimulateScreen() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="simulation-container">
            <h2>Simulação de Cultivo</h2>
            <form id="simulationForm" onsubmit="handleSimulation(event)">
                <div class="form-grid">
                    <div class="form-group">
                        <label for="crop">Cultura</label>
                        <select id="crop" required>
                            <option value="Soja">Soja</option>
                            <option value="Milho">Milho</option>
                            <option value="Cana-de-açúcar">Cana-de-açúcar</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="area">Área (hectares)</label>
                        <input type="number" id="area" min="1" required>
                    </div>
                    <div class="form-group">
                        <label for="irrigation">Sistema de Irrigação</label>
                        <select id="irrigation" required>
                            <option value="none">Sem Irrigação</option>
                            <option value="sprinkler">Aspersão</option>
                            <option value="drip">Gotejamento</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="soil">Tipo de Solo</label>
                        <select id="soil" required>
                            <option value="clay">Argiloso</option>
                            <option value="sandy">Arenoso</option>
                            <option value="loam">Franco</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="plantingDate">Data de Plantio</label>
                        <input type="date" id="plantingDate" required>
                    </div>
                </div>
                <button type="submit" class="btn-primary">Simular</button>
            </form>
            <div id="simulationResults" class="simulation-results"></div>
        </div>
    `;

    // Define a data mínima como hoje
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('plantingDate').min = today;
}

document.addEventListener('DOMContentLoaded', (event) => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('plantingDate').min = today;
});