// Configurações e Variáveis Globais
let map, marker;
window.climateData = null;

// Chave da API GNews - Substitua pela sua chave
const GNEWS_API_KEY = 'SUA_CHAVE_AQUI';

// Dados base de produtividade (ton/hectare)
const baseYield = {
    soybean: 3.5,     // Soja
    corn: 6.0,        // Milho
    wheat: 3.2,       // Trigo
    // ... (outros cultivos)
};

// Inicialização do Mapa
async function initMap() {
    try {
        map = L.map('map', {
            zoomControl: false,
            minZoom: 4,
            maxZoom: 18
        }).setView([-15.7801, -47.9292], 5);
        
        L.control.zoom({
            position: 'topleft'
        }).addTo(map);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        
        showInitialPopup();
        setupMapHandlers();
        loadSavedLocation();
    } catch (error) {
        console.error('Erro ao inicializar mapa:', error);
        showError('Erro ao carregar o mapa');
    }
}

// Funções do Mapa
function showInitialPopup() {
    const initialPopup = L.popup()
        .setLatLng([-15.7801, -47.9292])
        .setContent(`
            <div class="intro-popup">
                <h3>Bem-vindo ao AgroDecision</h3>
                <p>Selecione um local no mapa para começar a simulação</p>
            </div>
        `)
        .openOn(map);
}

function setupMapHandlers() {
    map.on('click', handleMapClick);
    setupSearchBox();
}

async function handleMapClick(e) {
    try {
        if (marker) marker.remove();
        marker = L.marker(e.latlng).addTo(map);
        
        showLoadingAnimation();
        const climateData = await getNASAData(e.latlng.lat, e.latlng.lng);
        
        if (climateData) {
            window.climateData = climateData;
            saveLocation(e.latlng);
            document.getElementById('locationWarning')?.style.display = 'none';
        }
    } catch (error) {
        console.error('Erro ao processar clique:', error);
        showError('Erro ao selecionar localização');
    } finally {
        hideLoadingAnimation();
    }
}

// Funções de Busca e Localização
function setupSearchBox() {
    const searchInput = document.getElementById('addressSearch');
    const searchResults = document.getElementById('searchResults');
    let searchTimeout;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        if (e.target.value.length < 3) {
            searchResults.innerHTML = '';
            return;
        }

        searchTimeout = setTimeout(() => performSearch(e.target.value, searchResults), 500);
    });
}

async function performSearch(query, resultsContainer) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=br`
        );
        
        if (!response.ok) throw new Error('Erro na busca');
        
        const data = await response.json();
        
        resultsContainer.innerHTML = data
            .slice(0, 5)
            .map(result => createSearchResultItem(result))
            .join('');
    } catch (error) {
        console.error('Erro na busca:', error);
        resultsContainer.innerHTML = '<div class="search-error">Erro ao buscar endereço</div>';
    }
}

// Funções de Clima e NASA API
async function getNASAData(lat, lng) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - 1);
    
    const formatDate = (date) => {
        return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    };

    const params = new URLSearchParams({
        parameters: 'T2M,PRECTOT,RH2M',
        community: 'AG',
        longitude: lng.toFixed(4),
        latitude: lat.toFixed(4),
        start: formatDate(startDate),
        end: formatDate(endDate),
        format: 'JSON'
    });

    try {
        const response = await fetch(`https://power.larc.nasa.gov/api/temporal/daily/point?${params}`);
        if (!response.ok) throw new Error('Erro na requisição da API da NASA');
        return await response.json();
    } catch (error) {
        console.error('Erro ao buscar dados da NASA:', error);
        showError('Falha ao obter dados climáticos');
        return null;
    }
}

// Funções de Simulação
function loadSimulationScreen() {
    const content = document.getElementById('content');
    const hasLocation = window.climateData !== undefined;

    content.innerHTML = `
        <div class="simulation-container">
            <h2>Simulação de Colheita</h2>
            
            <div class="location-warning" id="locationWarning" style="display: ${hasLocation ? 'none' : 'flex'}">
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
                            <option value="clay">Argiloso</option>
                            <option value="sandy">Arenoso</option>
                            <option value="loam">Franco</option>
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

// Função para gerar opções de culturas
function generateCropOptions() {
    const cropNames = {
        soybean: 'Soja',
        corn: 'Milho',
        wheat: 'Trigo',
        cotton: 'Algodão',
        rice: 'Arroz',
        // ... adicione mais culturas conforme necessário
    };

    return Object.entries(cropNames)
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([value, name]) => `<option value="${value}">${name}</option>`)
        .join('');
}

// Função para manipular a simulação
async function handleSimulation(event) {
    event.preventDefault();
    showLoadingAnimation();

    try {
        if (!window.climateData) {
            document.getElementById('locationWarning').style.display = 'flex';
            return;
        }

        const formData = getFormData();
        validateFormData(formData);

        // Calcular resultados base
        const baseResults = calculateCropMetrics(formData);

        // Calcular probabilidades para diferentes datas
        const harvestProbabilities = await calculateHarvestProbabilities(
            formData,
            new Date(baseResults.harvestDate)
        );

        // Exibir resultados
        showSimulationResults(baseResults, harvestProbabilities);

        // Salvar no histórico
        await saveToHistory({
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
// Carregamento de Notícias
async function loadNewsScreen() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="news-container">
            <h2>Notícias Agrícolas</h2>
            <div id="newsCarousel" class="news-carousel">
                <div id="newsContent" class="news-grid"></div>
                <div class="carousel-controls">
                    <button id="prevPage" class="carousel-button">❮</button>
                    <div id="pageIndicators" class="page-indicators"></div>
                    <button id="nextPage" class="carousel-button">❯</button>
                </div>
            </div>
        </div>
    `;

    showLoadingAnimation();
    try {
        const news = await fetchAgriculturalNews();
        setupNewsCarousel(news);
    } catch (error) {
        console.error('Erro ao carregar notícias:', error);
        showError('Não foi possível carregar as notícias');
    } finally {
        hideLoadingAnimation();
    }
}

async function fetchAgriculturalNews() {
    const response = await fetch(
        `https://gnews.io/api/v4/search?q=agricultura+brasil&lang=pt&country=br&max=20&apikey=${GNEWS_API_KEY}`
    );
    
    if (!response.ok) throw new Error('Falha ao buscar notícias');
    
    const data = await response.json();
    return data.articles || [];
}

function setupNewsCarousel(news) {
    const itemsPerPage = 4;
    let currentPage = 0;
    const totalPages = Math.ceil(news.length / itemsPerPage);

    const content = document.getElementById('newsContent');
    const indicators = document.getElementById('pageIndicators');
    const prevButton = document.getElementById('prevPage');
    const nextButton = document.getElementById('nextPage');

    function updateCarousel() {
        // Atualizar notícias
        const start = currentPage * itemsPerPage;
        const currentNews = news.slice(start, start + itemsPerPage);

        content.innerHTML = currentNews.map(item => `
            <div class="news-card">
                ${item.image ? `
                    <div class="news-image" style="background-image: url('${item.image}')"></div>
                ` : ''}
                <div class="news-content">
                    <div class="news-date">${formatarData(item.publishedAt)}</div>
                    <h3>${item.title}</h3>
                    <p>${item.description}</p>
                    <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="news-link">
                        Ler mais
                    </a>
                </div>
            </div>
        `).join('');

        // Atualizar indicadores
        indicators.innerHTML = Array.from({ length: totalPages }).map((_, index) => `
            <button class="page-indicator ${index === currentPage ? 'active' : ''}" 
                    onclick="changePage(${index})">
            </button>
        `).join('');

        // Atualizar estado dos botões
        prevButton.disabled = currentPage === 0;
        nextButton.disabled = currentPage === totalPages - 1;
    }

    // Funções de navegação
    window.changePage = (page) => {
        currentPage = page;
        updateCarousel();
    };

    prevButton.onclick = () => {
        if (currentPage > 0) {
            currentPage--;
            updateCarousel();
        }
    };

    nextButton.onclick = () => {
        if (currentPage < totalPages - 1) {
            currentPage++;
            updateCarousel();
        }
    };

    // Inicializar carrossel
    updateCarousel();
}

// Cálculo de Probabilidades
async function calculateHarvestProbabilities(formData, baseHarvestDate) {
    const probabilities = [];
    const daysRange = 3; // +/- 3 dias

    for (let i = -daysRange; i <= daysRange; i++) {
        const currentDate = new Date(baseHarvestDate);
        currentDate.setDate(currentDate.getDate() + i);
        
        const dateConditions = await analyzeHistoricalConditions(
            currentDate,
            formData.crop,
            window.climateData
        );

        probabilities.push({
            date: currentDate.toISOString().split('T')[0],
            probability: calculateProbabilityScore(dateConditions, formData.crop),
            conditions: dateConditions
        });
    }

    return probabilities;
}

async function analyzeHistoricalConditions(date, crop, climateData) {
    const month = date.getMonth();
    const historicalData = getHistoricalDataForMonth(month, climateData);
    
    return {
        temperature: analyzeTemperature(historicalData.temperature, crop),
        precipitation: analyzePrecipitation(historicalData.precipitation, crop),
        humidity: analyzeHumidity(historicalData.humidity, crop),
        soilMoisture: calculateSoilMoisture(historicalData)
    };
}

function calculateProbabilityScore(conditions, crop) {
    const weights = {
        temperature: 0.3,
        precipitation: 0.3,
        humidity: 0.2,
        soilMoisture: 0.2
    };

    const scores = {
        temperature: getTemperatureScore(conditions.temperature, crop),
        precipitation: getPrecipitationScore(conditions.precipitation, crop),
        humidity: getHumidityScore(conditions.humidity, crop),
        soilMoisture: getSoilMoistureScore(conditions.soilMoisture, crop)
    };

    return Object.entries(weights).reduce((total, [factor, weight]) => {
        return total + (scores[factor] * weight);
    }, 0);
}
// Funções de Análise Climática
function getHistoricalDataForMonth(month, climateData) {
    if (!climateData?.properties?.parameter) {
        throw new Error('Dados climáticos inválidos');
    }

    const data = climateData.properties.parameter;
    const monthData = {
        temperature: [],
        precipitation: [],
        humidity: []
    };

    // Coletar dados históricos para o mês específico
    Object.keys(data.T2M).forEach(date => {
        const currentMonth = new Date(date).getMonth();
        if (currentMonth === month) {
            monthData.temperature.push(data.T2M[date]);
            monthData.precipitation.push(data.PRECTOT[date]);
            monthData.humidity.push(data.RH2M[date]);
        }
    });

    return monthData;
}

function analyzeTemperature(temperatures, crop) {
    const idealTemps = getIdealTemperatures(crop);
    const avgTemp = calculateAverage(temperatures);
    
    return {
        value: avgTemp,
        status: getTemperatureStatus(avgTemp, idealTemps),
        min: Math.min(...temperatures),
        max: Math.max(...temperatures)
    };
}

function analyzePrecipitation(precipitation, crop) {
    const idealPrecip = getIdealPrecipitation(crop);
    const totalPrecip = precipitation.reduce((sum, val) => sum + val, 0);
    
    return {
        value: totalPrecip,
        status: getPrecipitationStatus(totalPrecip, idealPrecip),
        distribution: calculatePrecipitationDistribution(precipitation)
    };
}

function analyzeHumidity(humidity, crop) {
    const idealHumidity = getIdealHumidity(crop);
    const avgHumidity = calculateAverage(humidity);
    
    return {
        value: avgHumidity,
        status: getHumidityStatus(avgHumidity, idealHumidity),
        variation: calculateHumidityVariation(humidity)
    };
}

function calculateSoilMoisture(historicalData) {
    const { precipitation, temperature, humidity } = historicalData;
    
    // Modelo simplificado de umidade do solo
    const evapotranspiration = calculateEvapotranspiration(temperature, humidity);
    const totalPrecipitation = precipitation.reduce((sum, val) => sum + val, 0);
    
    return {
        value: totalPrecipitation - evapotranspiration,
        status: getSoilMoistureStatus(totalPrecipitation, evapotranspiration)
    };
}

// Funções de Cálculo de Status
function getTemperatureStatus(avg, ideal) {
    if (avg >= ideal.min && avg <= ideal.max) return 'Ideal';
    if (avg < ideal.min) return 'Abaixo do ideal';
    return 'Acima do ideal';
}

function getPrecipitationStatus(total, ideal) {
    const tolerance = 0.2; // 20% de tolerância
    const min = ideal * (1 - tolerance);
    const max = ideal * (1 + tolerance);
    
    if (total >= min && total <= max) return 'Ideal';
    if (total < min) return 'Insuficiente';
    return 'Excessiva';
}

function getHumidityStatus(avg, ideal) {
    const tolerance = 0.1; // 10% de tolerância
    const min = ideal * (1 - tolerance);
    const max = ideal * (1 + tolerance);
    
    if (avg >= min && avg <= max) return 'Ideal';
    if (avg < min) return 'Baixa';
    return 'Alta';
}

function getSoilMoistureStatus(precipitation, evapotranspiration) {
    const balance = precipitation - evapotranspiration;
    
    if (balance >= -10 && balance <= 10) return 'Ideal';
    if (balance < -10) return 'Seco';
    return 'Úmido';
}

// Funções de Cálculo
function calculateAverage(values) {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function calculateEvapotranspiration(temperature, humidity) {
    // Modelo simplificado de Penman-Monteith
    const avgTemp = calculateAverage(temperature);
    const avgHumidity = calculateAverage(humidity);
    
    return (0.0023 * (avgTemp + 17.8) * Math.pow((100 - avgHumidity) / 100, 0.5));
}

function calculatePrecipitationDistribution(precipitation) {
    const total = precipitation.reduce((sum, val) => sum + val, 0);
    const daysWithRain = precipitation.filter(val => val > 0).length;
    
    return {
        total,
        daysWithRain,
        intensity: total / (daysWithRain || 1)
    };
}

function calculateHumidityVariation(humidity) {
    const avg = calculateAverage(humidity);
    const variance = humidity.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / humidity.length;
    
    return {
        standardDeviation: Math.sqrt(variance),
        coefficient: Math.sqrt(variance) / avg
    };
}

// Valores Ideais por Cultura
function getIdealTemperatures(crop) {
    const idealTemps = {
        soybean: { min: 20, max: 30 },
        corn: { min: 22, max: 32 },
        wheat: { min: 15, max: 25 },
        // Adicione mais culturas conforme necessário
    };
    
    return idealTemps[crop] || { min: 18, max: 28 }; // Valores padrão
}

function getIdealPrecipitation(crop) {
    const idealPrecip = {
        soybean: 550,
        corn: 700,
        wheat: 450,
        // Adicione mais culturas conforme necessário
    };
    
    return idealPrecip[crop] || 600; // Valor padrão
}

function getIdealHumidity(crop) {
    const idealHumidity = {
        soybean: 70,
        corn: 65,
        wheat: 60,
        // Adicione mais culturas conforme necessário
    };
    
    return idealHumidity[crop] || 65; // Valor padrão
}
// Funções de Exibição de Resultados
function showSimulationResults(baseResults, probabilities) {
    const resultsContainer = document.getElementById('simulationResults');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = `
        <h3>Resultados da Simulação</h3>
        
        ${createBaseResultsHTML(baseResults)}
        ${createProbabilitiesTimelineHTML(probabilities)}
        ${createDetailedAnalysisHTML(baseResults, probabilities)}
    `;

    // Inicializar gráficos e animações
    initializeResultCharts();
    animateResults();
}

function createBaseResultsHTML(results) {
    return `
        <div class="results-grid">
            <div class="result-card animate-in">
                <div class="result-icon">📊</div>
                <h4>Produtividade Estimada</h4>
                <div class="result-value counter">${results.yield}</div>
                <div class="result-unit">toneladas por hectare</div>
            </div>

            <div class="result-card animate-in" style="animation-delay: 0.2s">
                <div class="result-icon">💧</div>
                <h4>Necessidade Hídrica</h4>
                <div class="result-value counter">${results.water}</div>
                <div class="result-unit">milímetros</div>
            </div>

            <div class="result-card animate-in" style="animation-delay: 0.4s">
                <div class="result-icon">📅</div>
                <h4>Ciclo de Cultivo</h4>
                <div class="result-value counter">${results.cycle}</div>
                <div class="result-unit">dias</div>
            </div>
        </div>
    `;
}

function createProbabilitiesTimelineHTML(probabilities) {
    return `
        <div class="harvest-timeline animate-in" style="animation-delay: 0.6s">
            <h4>Janela de Colheita</h4>
            <div class="timeline-container">
                ${probabilities.map((prob, index) => `
                    <div class="timeline-item ${getProbabilityClass(prob.probability)}"
                         style="animation-delay: ${0.8 + (index * 0.1)}s">
                        <div class="date">${formatarData(prob.date)}</div>
                        <div class="probability-bar">
                            <div class="bar-fill" style="height: ${prob.probability}%"></div>
                            <span>${Math.round(prob.probability)}%</span>
                        </div>
                        <div class="conditions">
                            ${createConditionsIcons(prob.conditions)}
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

function createDetailedAnalysisHTML(baseResults, probabilities) {
    return `
        <div class="detailed-analysis animate-in" style="animation-delay: 1s">
            <h4>Análise Detalhada</h4>
            <div class="analysis-grid">
                <div class="analysis-card">
                    <h5>Condições Climáticas</h5>
                    <div id="climateChart" class="chart-container"></div>
                </div>
                <div class="analysis-card">
                    <h5>Distribuição de Probabilidade</h5>
                    <div id="probabilityChart" class="chart-container"></div>
                </div>
            </div>
            <button onclick="showFullAnalysis()" class="modern-button">
                Ver Análise Completa
            </button>
        </div>
    `;
}

// Funções de Suporte para Exibição
function getProbabilityClass(probability) {
    if (probability >= 75) return 'excellent';
    if (probability >= 60) return 'good';
    if (probability >= 40) return 'moderate';
    return 'low';
}

function createConditionsIcons(conditions) {
    const icons = {
        temperature: {
            Ideal: '🌡️',
            'Abaixo do ideal': '❄️',
            'Acima do ideal': '🔥'
        },
        humidity: {
            Ideal: '💧',
            Baixa: '📉',
            Alta: '📈'
        },
        precipitation: {
            Ideal: '☔',
            Insuficiente: '⚠️',
            Excessiva: '⛈️'
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
    `;
}

function createTimelineLegend() {
    return `
        <div class="legend-item">
            <span class="legend-color excellent"></span>
            <span>Excelente (75-100%)</span>
        </div>
        <div class="legend-item">
            <span class="legend-color good"></span>
            <span>Bom (60-74%)</span>
        </div>
        <div class="legend-item">
            <span class="legend-color moderate"></span>
            <span>Moderado (40-59%)</span>
        </div>
        <div class="legend-item">
            <span class="legend-color low"></span>
            <span>Baixo (0-39%)</span>
        </div>
    `;
}

// Funções de Animação
function animateResults() {
    // Animar contadores
    const counters = document.querySelectorAll('.counter');
    counters.forEach(counter => {
        const target = parseFloat(counter.innerText);
        const duration = 1500;
        const steps = 60;
        const increment = target / steps;
        let current = 0;

        const updateCounter = () => {
            current += increment;
            if (current >= target) {
                counter.innerText = target.toFixed(2);
                return;
            }
            counter.innerText = current.toFixed(2);
            requestAnimationFrame(updateCounter);
        };

        updateCounter();
    });

    // Animar barras de probabilidade
    const bars = document.querySelectorAll('.probability-bar .bar-fill');
    bars.forEach(bar => {
        const height = bar.style.height;
        bar.style.height = '0%';
        setTimeout(() => {
            bar.style.height = height;
        }, 100);
    });
}
// Funções de Gráficos e Visualização
function initializeResultCharts() {
    createClimateChart();
    createProbabilityChart();
}

function createClimateChart() {
    const ctx = document.getElementById('climateChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: getDatesArray(),
            datasets: [
                {
                    label: 'Temperatura (°C)',
                    data: getTemperatureData(),
                    borderColor: '#ff6b6b',
                    tension: 0.4
                },
                {
                    label: 'Umidade (%)',
                    data: getHumidityData(),
                    borderColor: '#4dabf7',
                    tension: 0.4
                },
                {
                    label: 'Precipitação (mm)',
                    data: getPrecipitationData(),
                    borderColor: '#51cf66',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function createProbabilityChart() {
    const ctx = document.getElementById('probabilityChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: getProbabilityDates(),
            datasets: [{
                label: 'Probabilidade de Sucesso (%)',
                data: getProbabilityValues(),
                backgroundColor: getProbabilityColors(),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

// Funções de Análise Detalhada
function showFullAnalysis() {
    Swal.fire({
        title: 'Análise Detalhada',
        html: createFullAnalysisHTML(),
        width: '80%',
        padding: '2em',
        confirmButtonText: 'Fechar',
        confirmButtonColor: '#4CAF50',
        showClass: {
            popup: 'animate__animated animate__fadeIn'
        }
    });
}

function createFullAnalysisHTML() {
    return `
        <div class="full-analysis">
            <div class="analysis-section">
                <h4>Análise de Condições Climáticas</h4>
                ${createClimateAnalysisHTML()}
            </div>
            
            <div class="analysis-section">
                <h4>Análise de Solo e Irrigação</h4>
                ${createSoilIrrigationAnalysisHTML()}
            </div>
            
            <div class="analysis-section">
                <h4>Recomendações</h4>
                ${createRecommendationsHTML()}
            </div>
            
            <div class="analysis-section">
                <h4>Alertas e Observações</h4>
                ${createAlertsHTML()}
            </div>
        </div>
    `;
}

function createClimateAnalysisHTML() {
    return `
        <div class="climate-analysis">
            <div class="analysis-grid">
                <div class="analysis-item">
                    <h5>Temperatura</h5>
                    ${createTemperatureAnalysisHTML()}
                </div>
                <div class="analysis-item">
                    <h5>Precipitação</h5>
                    ${createPrecipitationAnalysisHTML()}
                </div>
                <div class="analysis-item">
                    <h5>Umidade</h5>
                    ${createHumidityAnalysisHTML()}
                </div>
            </div>
        </div>
    `;
}

function createSoilIrrigationAnalysisHTML() {
    return `
        <div class="soil-irrigation-analysis">
            <div class="analysis-grid">
                <div class="analysis-item">
                    <h5>Condições do Solo</h5>
                    ${createSoilConditionsHTML()}
                </div>
                <div class="analysis-item">
                    <h5>Necessidades de Irrigação</h5>
                    ${createIrrigationNeedsHTML()}
                </div>
            </div>
        </div>
    `;
}

function createRecommendationsHTML() {
    const recommendations = generateRecommendations();
    return `
        <div class="recommendations">
            <ul class="recommendation-list">
                ${recommendations.map(rec => `
                    <li class="recommendation-item">
                        <span class="recommendation-icon">${rec.icon}</span>
                        <div class="recommendation-content">
                            <h6>${rec.title}</h6>
                            <p>${rec.description}</p>
                        </div>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;
}

function createAlertsHTML() {
    const alerts = generateAlerts();
    return `
        <div class="alerts">
            ${alerts.map(alert => `
                <div class="alert-item ${alert.type}">
                    <span class="alert-icon">${alert.icon}</span>
                    <div class="alert-content">
                        <h6>${alert.title}</h6>
                        <p>${alert.message}</p>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Funções de Geração de Dados
function generateRecommendations() {
    // Implementar lógica de recomendações baseada nos dados
    return [
        {
            icon: '🌱',
            title: 'Preparação do Solo',
            description: 'Recomendação específica para preparação do solo...'
        },
        {
            icon: '💧',
            title: 'Gestão da Irrigação',
            description: 'Recomendação específica para irrigação...'
        },
        // Adicionar mais recomendações conforme necessário
    ];
}

function generateAlerts() {
    // Implementar lógica de alertas baseada nos dados
    return [
        {
            type: 'warning',
            icon: '⚠️',
            title: 'Risco de Geada',
            message: 'Possibilidade de geada nos próximos dias...'
        },
        {
            type: 'info',
            icon: 'ℹ️',
            title: 'Período de Plantio',
            message: 'Período ideal para plantio se aproximando...'
        },
        // Adicionar mais alertas conforme necessário
    ];
}

// Funções de Suporte
function showLoadingAnimation() {
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.id = 'loadingOverlay';
    
    loadingOverlay.innerHTML = `
        <div class="loading-content">
            <svg class="growing-plant" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                <!-- SVG da planta crescendo aqui -->
            </svg>
            <p>Processando dados...</p>
        </div>
    `;
    
    document.body.appendChild(loadingOverlay);
}

function hideLoadingAnimation() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('fade-out');
        setTimeout(() => {
            loadingOverlay.remove();
        }, 500);
    }
}

function showError(message) {
    Swal.fire({
        title: 'Erro',
        text: message,
        icon: 'error',
        confirmButtonText: 'Fechar',
        confirmButtonColor: '#4CAF50'
    });
}

function formatarData(data) {
    return new Date(data).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Funções de Histórico
async function saveToHistory(simulationData) {
    try {
        const history = JSON.parse(localStorage.getItem('simulationHistory') || '[]');
        history.unshift({
            id: Date.now(),
            ...simulationData
        });
        localStorage.setItem('simulationHistory', JSON.stringify(history.slice(0, 50)));
    } catch (error) {
        console.error('Erro ao salvar no histórico:', error);
    }
}

// Inicialização
window.onload = function() {
    try {
        initMap();
        
        // Registrar service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('ServiceWorker registrado com sucesso:', registration);
                })
                .catch(err => {
                    console.error('Erro ao registrar ServiceWorker:', err);
                });
        }

        // Verificar hash da URL
        const hash = window.location.hash.slice(1);
        if (hash) {
            showScreen(hash);
        }

        // Adicionar listener para mudanças no hash
        window.addEventListener('hashchange', function() {
            const hash = window.location.hash.slice(1);
            if (hash) {
                showScreen(hash);
            } else {
                showScreen('home');
            }
        });

        // Verificar e carregar localização salva
        const savedLocation = localStorage.getItem('selectedLocation');
        if (savedLocation) {
            const location = JSON.parse(savedLocation);
            if (location && location.lat && location.lng) {
                setTimeout(() => {
                    selectLocation(location.lat, location.lng, 'Local Anterior');
                }, 1000);
            }
        }

    } catch (error) {
        console.error('Erro na inicialização:', error);
        showError('Erro ao inicializar a aplicação');
    }
};

// Exportar funções necessárias
window.showScreen = showScreen;
window.handleSimulation = handleSimulation;
window.selectLocation = selectLocation;
window.showCalculationDetails = showCalculationDetails;
window.changePage = changePage;

