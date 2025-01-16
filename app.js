// Variáveis globais
let map, marker;

// Inicialização do mapa
function initMap() {
    map = L.map('map', {
        zoomControl: false  // Desativa o controle de zoom padrão
    }).setView([-15.7801, -47.9292], 5);
    
    // Adiciona o controle de zoom no canto esquerdo
    L.control.zoom({
        position: 'topleft'
    }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    
    const initialPopup = L.popup()
        .setLatLng([-15.7801, -47.9292])
        .setContent('<div class="intro-popup">Selecione um local no mapa para começar</div>')
        .openOn(map);

    // Adiciona funcionalidade de busca
    const searchInput = document.getElementById('addressSearch');
    const searchResults = document.getElementById('searchResults');
    let searchTimeout;

    searchInput.addEventListener('input', function(e) {
        clearTimeout(searchTimeout);
        searchResults.innerHTML = '';
        
        if (e.target.value.length < 3) return;
        
        searchTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(e.target.value)}`);
                const data = await response.json();
                
                searchResults.innerHTML = data.slice(0, 5).map(result => `
                    <div class="search-result-item" onclick="selectLocation(${result.lat}, ${result.lon}, '${result.display_name}')">
                        ${result.display_name}
                    </div>
                `).join('');
            } catch (error) {
                console.error('Erro na busca:', error);
            }
        }, 500);
    });

    // Fecha resultados quando clicar fora
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.map-search-container')) {
            searchResults.innerHTML = '';
        }
    });
        
    map.on('click', async function(e) {
        if (marker) {
            marker.remove();
        }
        
        marker = L.marker(e.latlng).addTo(map);
        map.closePopup(initialPopup);
        
        const climateData = await getNASAData(e.latlng.lat, e.latlng.lng);
        window.climateData = climateData;
        saveLocation(e.latlng);
    });
}

// Função para selecionar localização da busca
function selectLocation(lat, lon, displayName) {
    const latlng = { lat: parseFloat(lat), lng: parseFloat(lon) };
    
    if (marker) {
        marker.remove();
    }
    
    marker = L.marker(latlng).addTo(map);
    map.setView(latlng, 13);
    
    document.getElementById('searchResults').innerHTML = '';
    document.getElementById('addressSearch').value = displayName;
    
    saveLocation(latlng);
    getNASAData(latlng.lat, latlng.lng);
}

// Função para salvar localização selecionada
function saveLocation(latlng) {
    localStorage.setItem('selectedLocation', JSON.stringify({
        lat: latlng.lat,
        lng: latlng.lng,
        timestamp: new Date().toISOString()
    }));
}

// Função para obter dados climáticos da NASA
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
        showError('Não foi possível carregar os dados climáticos');
        return null;
    }
}

// Funções de navegação e interface
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('open');
}

function showScreen(screenName) {
    const content = document.getElementById('content');
    const map = document.getElementById('map');

    if (screenName === 'home') {
        content.style.display = 'none';
        map.style.display = 'block';
        if (map && window.map) {
            window.map.invalidateSize();
        }
    } else {
        content.style.display = 'block';
        map.style.display = 'none';
        
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
    }

    toggleSidebar();
}

// Funções de simulação
function loadSimulationScreen() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="simulation-container">
            <h2>Simulação de Colheita</h2>
            <form id="simulationForm" onsubmit="handleSimulation(event)">
                <div class="form-grid">
                    <div class="input-group">
                        <label for="crop">Cultura</label>
                        <select class="modern-input" id="crop" required>
                            <option value="">Selecione a cultura</option>
                            <option value="soybean">Soja</option>
                            <option value="corn">Milho</option>
                            <option value="wheat">Trigo</option>
                            <option value="cotton">Algodão</option>
                            <option value="rice">Arroz</option>
                            <option value="beans">Feijão</option>
                            <option value="cassava">Mandioca</option>
                            <option value="potato">Batata</option>
                        </select>
                    </div>

                    <div class="input-group">
                        <label for="area">Área (hectares)</label>
                        <input type="number" class="modern-input" id="area" required min="0" step="0.1">
                    </div>

                    <div class="input-group">
                        <label for="irrigation">Sistema de Irrigação</label>
                        <select class="modern-input" id="irrigation" required>
                            <option value="">Selecione o sistema</option>
                            <option value="cerqueiro">Cerqueiro (Baseado em dados climáticos)</option>
                        </select>
                        <small class="input-help">Sistema cerqueiro utiliza dados climáticos da NASA para otimizar a irrigação baseado em temperatura, precipitação e umidade</small>
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
                    Simular Simular Colheita
                </button>
            </form>

            <div id="simulationResults" class="results-container"></div>
        </div>
    `;
}

async function handleSimulation(event) {
    event.preventDefault();
    
    // Mostrar animação de carregamento
    showLoadingAnimation();

    const form = event.target;
    const data = {
        crop: form.crop.value,
        area: parseFloat(form.area.value),
        irrigation: form.irrigation.value,
        soil: form.soil.value,
        plantingDate: form.plantingDate.value
    };

    // Simular processamento
    await new Promise(resolve => setTimeout(resolve, 1500));

    const results = calculateCropMetrics(data);
    
    // Salvar no histórico
    await saveToHistory({
        ...data,
        results,
        timestamp: new Date().toISOString()
    });

    hideLoadingAnimation();
    showSimulationResults(results, data);
}

function showLoadingAnimation() {
    const loading = document.createElement('div');
    loading.className = 'loading-animation';
    loading.innerHTML = `
        <div class="spinner"></div>
        <p>Calculando resultados...</p>
    `;
    document.body.appendChild(loading);
}

function hideLoadingAnimation() {
    const loading = document.querySelector('.loading-animation');
    if (loading) loading.remove();
}

function calculateCropMetrics(data) {
    // Dados base de produtividade (ton/hectare)
    const baseYield = {
        soybean: 3.5,
        corn: 6.0,
        wheat: 3.2,
        cotton: 4.5,
        rice: 4.8,
        beans: 2.5,
        cassava: 20.0,
        potato: 25.0
    };

    // Fatores de eficiência de irrigação baseados em dados climáticos
    const irrigationEfficiency = {
        cerqueiro: calculateIrrigationEfficiency(window.climateData)
    };

    // Fatores de qualidade do solo
    const soilQuality = {
        clay: 1.1,
        sandy: 0.8,
        loam: 1.3
    };

    // Cálculo da produtividade
    const yieldPerHectare = baseYield[data.crop] * 
        irrigationEfficiency[data.irrigation] * 
        soilQuality[data.soil];
    
    const totalYield = yieldPerHectare * data.area;

    // Necessidade hídrica base (mm)
    const waterUsage = {
        soybean: 550,
        corn: 700,
        wheat: 450,
        cotton: 800,
        rice: 1200,
        beans: 400,
        cassava: 800,
        potato: 500
    };

    const waterRequired = data.area * waterUsage[data.crop] * 
        (1 / irrigationEfficiency[data.irrigation]);

    // Ciclo da cultura (dias)
    const cycles = {
        soybean: 120,
        corn: 135,
        wheat: 110,
        cotton: 170,
        rice: 120,
        beans: 90,
        cassava: 300,
        potato: 100
    };

    // Cálculo da data de colheita
    const harvestDate = new Date(data.plantingDate);
    harvestDate.setDate(harvestDate.getDate() + cycles[data.crop]);

    // Cálculos detalhados para exibição
    const calculations = {
        yieldCalc: {
            baseYield: baseYield[data.crop],
            irrigationFactor: irrigationEfficiency[data.irrigation],
            soilFactor: soilQuality[data.soil],
            area: data.area
        },
        waterCalc: {
            baseUsage: waterUsage[data.crop],
            irrigationFactor: irrigationEfficiency[data.irrigation],
            area: data.area
        },
        cycleCalc: {
            duration: cycles[data.crop],
            plantingDate: data.plantingDate
        }
    };

    return {
        yield: totalYield.toFixed(2),
        water: waterRequired.toFixed(2),
        cycle: cycles[data.crop],
        harvestDate: harvestDate.toISOString().split('T')[0],
        calculations
    };
}

function formatarData(data) {
    return new Date(data).toLocaleDateString('pt-BR');
}

// Função para calcular eficiência de irrigação baseada em dados climáticos
function calculateIrrigationEfficiency(climateData) {
    if (!climateData || !climateData.properties || !climateData.properties.parameter) {
        return 1.0; // valor padrão se não houver dados
    }

    const data = climateData.properties.parameter;
    const temp = data.T2M; // temperatura média
    const precip = data.PRECTOT; // precipitação total
    const humidity = data.RH2M; // umidade relativa

    // Calcular médias
    const avgTemp = Object.values(temp).reduce((a, b) => a + b, 0) / Object.keys(temp).length;
    const avgPrecip = Object.values(precip).reduce((a, b) => a + b, 0) / Object.keys(precip).length;
    const avgHumidity = Object.values(humidity).reduce((a, b) => a + b, 0) / Object.keys(humidity).length;

    // Fatores de ajuste baseados em condições ideais
    const tempFactor = avgTemp >= 20 && avgTemp <= 30 ? 1.2 : 0.8;
    const precipFactor = avgPrecip >= 50 ? 1.3 : 0.7;
    const humidityFactor = avgHumidity >= 60 ? 1.1 : 0.9;

    return (tempFactor + precipFactor + humidityFactor) / 3;
}

function showSimulationResults(results, inputData) {
    const resultsContainer = document.getElementById('simulationResults');
    const probabilities = calculateProbabilities(window.climateData, inputData);
    
    resultsContainer.innerHTML = `
        <h3>Resultados da Simulação</h3>
        <div class="results-grid">
            <div class="result-card" onclick="showCalculationDetails('yield', ${JSON.stringify(results)}, ${JSON.stringify(inputData)})">
                <div class="result-icon">📊</div>
                <h4>Produtividade Estimada</h4>
                <div class="result-value">${results.yield} ton</div>
                <div class="result-probability">Probabilidade de Sucesso: ${probabilities.yield}%</div>
                <small>Clique para ver os cálculos</small>
            </div>

            <div class="result-card" onclick="showCalculationDetails('water', ${JSON.stringify(results)}, ${JSON.stringify(inputData)})">
                <div class="result-icon">💧</div>
                <h4>Necessidade Hídrica</h4>
                <div class="result-value">${results.water} mm</div>
                <div class="result-probability">Probabilidade de Disponibilidade: ${probabilities.water}%</div>
                <small>Clique para ver os cálculos</small>
            </div>

            <div class="result-card" onclick="showCalculationDetails('cycle', ${JSON.stringify(results)}, ${JSON.stringify(inputData)})">
                <div class="result-icon">📅</div>
                <h4>Ciclo e Colheita</h4>
                <div class="result-value">${results.cycle} dias</div>
                <div class="result-subvalue">Colheita prevista: ${formatarData(results.harvestDate)}</div>
                <div class="result-probability">Condições Climáticas Favoráveis: ${probabilities.climate}%</div>
                <small>Clique para ver os cálculos</small>
            </div>
        </div>
    `;
}

// Função para calcular probabilidades baseadas nos dados climáticos
function calculateProbabilities(climateData, inputData) {
    if (!climateData || !climateData.properties || !climateData.properties.parameter) {
        return {
            yield: 50,
            water: 50,
            climate: 50
        };
    }

    const data = climateData.properties.parameter;
    const temp = data.T2M;
    const precip = data.PRECTOT;
    const humidity = data.RH2M;

    // Calcular médias e desvios
    const avgTemp = Object.values(temp).reduce((a, b) => a + b, 0) / Object.keys(temp).length;
    const avgPrecip = Object.values(precip).reduce((a, b) => a + b, 0) / Object.keys(precip).length;
    const avgHumidity = Object.values(humidity).reduce((a, b) => a + b, 0) / Object.keys(humidity).length;

    // Probabilidade de produtividade baseada em condições ideais
    const yieldProb = calculateYieldProbability(avgTemp, avgPrecip, avgHumidity, inputData.crop);
    
    // Probabilidade de disponibilidade hídrica
    const waterProb = calculateWaterProbability(avgPrecip, inputData.crop);
    
    // Probabilidade de condições climáticas favoráveis
    const climateProb = calculateClimateProbability(avgTemp, avgHumidity, inputData.crop);

    return {
        yield: Math.round(yieldProb * 100),
        water: Math.round(waterProb * 100),
        climate: Math.round(climateProb * 100)
    };
}

function calculateYieldProbability(temp, precip, humidity, crop) {
    // Condições ideais por cultura
    const idealConditions = {
        soybean: { temp: 25, precip: 500, humidity: 70 },
        corn: { temp: 27, precip: 600, humidity: 65 },
        wheat: { temp: 20, precip: 400, humidity: 60 },
        cotton: { temp: 28, precip: 700, humidity: 65 },
        rice: { temp: 25, precip: 1000, humidity: 75 },
        beans: { temp: 22, precip: 350, humidity: 65 },
        cassava: { temp: 24, precip: 700, humidity: 70 },
        potato: { temp: 18, precip: 450, humidity: 75 }
    };

    const ideal = idealConditions[crop];
    
    // Calcular desvios das condições ideais
    const tempDev = 1 - Math.abs(temp - ideal.temp) / ideal.temp;
    const precipDev = 1 - Math.abs(precip - ideal.precip) / ideal.precip;
    const humidityDev = 1 - Math.abs(humidity - ideal.humidity) / ideal.humidity;

    return (tempDev + precipDev + humidityDev) / 3;
}

function calculateWaterProbability(precip, crop) {
    const minPrecip = {
        soybean: 450,
        corn: 500,
        wheat: 350,
        cotton: 600,
        rice: 1000,
        beans: 300,
        cassava: 600,
        potato: 400
    };

    return Math.min(1, precip / minPrecip[crop]);
}

function calculateClimateProbability(temp, humidity, crop) {
    const idealTemp = {
        soybean: [20, 30],
        corn: [22, 32],
        wheat: [15, 25],
        cotton: [23, 33],
        rice: [20, 30],
        beans: [17, 27],
        cassava: [19, 29],
        potato: [15, 25]
    };

    const tempRange = idealTemp[crop];
    const tempProb = temp >= tempRange[0] && temp <= tempRange[1] ? 
        1 : 1 - Math.min(Math.abs(temp - tempRange[0]), Math.abs(temp - tempRange[1])) / 10;

    const humidityProb = humidity >= 60 && humidity <= 80 ? 
        1 : 1 - Math.abs(humidity - 70) / 70;

    return (tempProb + humidityProb) / 2;
}

function showCalculationDetails(type, results, inputData) {
    let title, content;

    switch(type) {
        case 'yield':
            title = 'Cálculo da Produtividade';
            content = `
                <div class="calculation-step">
                    <p><strong>Produtividade Base:</strong> ${results.calculations.yieldCalc.baseYield} ton/ha</p>
                    <p><strong>Fator de Irrigação:</strong> ${results.calculations.yieldCalc.irrigationFactor}</p>
                    <p><strong>Fator do Solo:</strong> ${results.calculations.yieldCalc.soilFactor}</p>
                    <p><strong>Área:</strong> ${results.calculations.yieldCalc.area} ha</p>
                    <hr>
                    <p><strong>Cálculo:</strong></p>
                    <p>${results.calculations.yieldCalc.baseYield} × ${results.calculations.yieldCalc.irrigationFactor} × ${results.calculations.yieldCalc.soilFactor} × ${results.calculations.yieldCalc.area} = ${results.yield} ton</p>
                </div>
            `;
            break;
        case 'water':
            title = 'Cálculo da Necessidade Hídrica';
            content = `
                <div class="calculation-step">
                    <p><strong>Necessidade Base:</strong> ${results.calculations.waterCalc.baseUsage} mm</p>
                    <p><strong>Fator de Irrigação:</strong> ${results.calculations.waterCalc.irrigationFactor}</p>
                    <p><strong>Área:</strong> ${results.calculations.waterCalc.area} ha</p>
                    <hr>
                    <p><strong>Cálculo:</strong></p>
                    <p>${results.calculations.waterCalc.baseUsage} × ${results.calculations.waterCalc.area} ÷ ${results.calculations.waterCalc.irrigationFactor} = ${results.water} mm</p>
                </div>
            `;
            break;
        case 'cycle':
            title = 'Cálculo do Ciclo e Data de Colheita';
            content = `
                <div class="calculation-step">
                    <p><strong>Duração do Ciclo:</strong> ${results.calculations.cycleCalc.duration} dias</p>
                    <p><strong>Data de Plantio:</strong> ${formatarData(results.calculations.cycleCalc.plantingDate)}</p>
                    <p><strong>Data de Colheita:</strong> ${formatarData(results.harvestDate)}</p>
                    <hr>
                    <p><strong>Cálculo:</strong></p>
                    <p>Data de Plantio + ${results.calculations.cycleCalc.duration} dias = ${formatarData(results.harvestDate)}</p>
                    </div>
                `;
                break;
        }
    
        Swal.fire({
            title: title,
            html: content,
            confirmButtonText: 'Fechar',
            confirmButtonColor: '#4CAF50',
            width: '600px'
        });
    }
    
    // Funções de histórico
    async function saveToHistory(simulation) {
        const history = JSON.parse(localStorage.getItem('simulationHistory') || '[]');
        history.unshift({
            id: Date.now(),
            ...simulation
        });
        localStorage.setItem('simulationHistory', JSON.stringify(history.slice(0, 50)));
    }
    
    function loadHistoryScreen() {
        const content = document.getElementById('content');
        const history = JSON.parse(localStorage.getItem('simulationHistory') || '[]');
    
        if (history.length === 0) {
            content.innerHTML = `
                <div class="history-container">
                    <h2>Histórico de Simulações</h2>
                    <p class="empty-history">Nenhuma simulação encontrada</p>
                </div>
            `;
            return;
        }
    
        content.innerHTML = `
            <div class="history-container">
                <h2>Histórico de Simulações</h2>
                <div class="history-grid">
                    ${history.map(sim => `
                        <div class="history-card">
                            <div class="history-header">
                                <span>${getCropName(sim.crop)}</span>
                                <span>${formatarData(sim.timestamp)}</span>
                            </div>
                            <div class="detail-row">
                                <span>Área:</span>
                                <span>${sim.area} hectares</span>
                            </div>
                            <div class="detail-row">
                                <span>Produtividade:</span>
                                <span>${sim.results.yield} ton</span>
                            </div>
                            <div class="detail-row">
                                <span>Data do Plantio:</span>
                                <span>${formatarData(sim.plantingDate)}</span>
                            </div>
                            <div class="detail-row">
                                <span>Data da Colheita:</span>
                                <span>${formatarData(sim.results.harvestDate)}</span>
                            </div>
                            <button 
                                onclick='showCalculationDetails("complete", ${JSON.stringify(sim.results)}, ${JSON.stringify(sim)})'
                                class="modern-button"
                            >
                                Ver Detalhes dos Cálculos
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Funções de notícias
    async function loadNewsScreen() {
        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="news-container">
                <h2>Notícias Agrícolas</h2>
                <div id="newsContent" class="news-grid">
                    <div class="loading-animation">
                        <div class="spinner"></div>
                        <p>Carregando notícias...</p>
                    </div>
                </div>
            </div>
        `;
    
        if (!marker) {
            document.getElementById('newsContent').innerHTML = 
                '<p class="empty-news">Selecione uma localização no mapa primeiro</p>';
            return;
        }
    
        try {
            const response = await fetch(
                `https://newsapi.org/v2/everything?q=agricultura+rural&language=pt&apiKey=YOUR_API_KEY`
            );
            const data = await response.json();
    
            if (data.articles.length === 0) {
                document.getElementById('newsContent').innerHTML = 
                    '<p class="empty-news">Nenhuma notícia encontrada para esta região</p>';
                return;
            }
    
            document.getElementById('newsContent').innerHTML = data.articles
                .slice(0, 6)
                .map(article => `
                    <div class="news-card">
                        <div class="news-date">${formatarData(article.publishedAt)}</div>
                        <h3>${article.title}</h3>
                        <p>${article.description}</p>
                        <a href="${article.url}" target="_blank" class="news-link">Ler mais</a>
                    </div>
                `).join('');
    
        } catch (error) {
            console.error('Erro ao carregar notícias:', error);
            document.getElementById('newsContent').innerHTML = 
                '<p class="error-message">Erro ao carregar notícias. Tente novamente mais tarde.</p>';
        }
    }
    
    // Funções utilitárias
    function getCropName(crop) {
        const names = {
            soybean: 'Soja',
            corn: 'Milho',
            wheat: 'Trigo',
            cotton: 'Algodão',
            rice: 'Arroz',
            beans: 'Feijão',
            cassava: 'Mandioca',
            potato: 'Batata'
        };
        return names[crop] || crop;
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
    
    // Inicialização
    window.onload = function() {
        initMap();
        
        // Registrar service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('ServiceWorker registrado com sucesso');
                })
                .catch(err => {
                    console.error('Erro ao registrar ServiceWorker:', err);
                });
        }
    };