// Variáveis globais
let map, marker;
window.climateData = null;

// Dados base de produtividade (ton/hectare)
const baseYield = {
    soybean: 3.5,     // Soja
    corn: 6.0,        // Milho
    wheat: 3.2,       // Trigo
    cotton: 4.5,      // Algodão
    rice: 4.8,        // Arroz
    beans: 2.5,       // Feijão
    cassava: 20.0,    // Mandioca
    potato: 25.0,     // Batata
    sugarcane: 75.0,  // Cana-de-açúcar
    coffee: 2.0,      // Café
    orange: 30.0,     // Laranja
    grape: 15.0,      // Uva
    apple: 35.0,      // Maçã
    banana: 40.0,     // Banana
    mango: 25.0,      // Manga
    papaya: 45.0,     // Mamão
    pineapple: 40.0,  // Abacaxi
    watermelon: 35.0, // Melancia
    melon: 25.0,      // Melão
    tomato: 80.0,     // Tomate
    onion: 30.0,      // Cebola
    carrot: 35.0,     // Cenoura
    lettuce: 25.0,    // Alface
    cabbage: 45.0,    // Repolho
    pepper: 30.0,     // Pimentão
    cucumber: 40.0,   // Pepino
    garlic: 12.0,     // Alho
    peanut: 3.0,      // Amendoim
    sunflower: 2.5,   // Girassol
    tobacco: 2.2,     // Tabaco
    eucalyptus: 45.0, // Eucalipto
    pine: 35.0,       // Pinus
    rubber: 2.0,      // Seringueira
    palm: 25.0,       // Palmeira
    coconut: 15.0,    // Coco
    avocado: 20.0,    // Abacate
    lemon: 25.0,      // Limão
    tangerine: 22.0,  // Tangerina
    passion_fruit: 15.0, // Maracujá
    guava: 25.0,      // Goiaba
    fig: 12.0,        // Figo
    peach: 20.0,      // Pêssego
    plum: 15.0,       // Ameixa
    pear: 25.0,       // Pera
    strawberry: 35.0, // Morango
    blackberry: 12.0, // Amora
    raspberry: 10.0,  // Framboesa
    blueberry: 8.0,   // Mirtilo
    acai: 10.0,       // Açaí
    cashew: 1.5       // Caju
};

// Inicialização do mapa
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
        
        const initialPopup = L.popup()
            .setLatLng([-15.7801, -47.9292])
            .setContent('<div class="intro-popup">Selecione um local no mapa para começar</div>')
            .openOn(map);

        // Restaurar localização anterior
        const savedLocation = localStorage.getItem('selectedLocation');
        if (savedLocation) {
            const location = JSON.parse(savedLocation);
            if (location.lat && location.lng) {
                selectLocation(location.lat, location.lng, 'Local Anterior');
            }
        }

        setupSearch();
        setupMapClickHandler();
    } catch (error) {
        console.error('Erro ao inicializar o mapa:', error);
        showError('Erro ao carregar o mapa. Por favor, recarregue a página.');
    }
}

// Configuração da busca
function setupSearch() {
    const searchInput = document.getElementById('addressSearch');
    const searchResults = document.getElementById('searchResults');
    let searchTimeout;

    searchInput.addEventListener('input', function(e) {
        clearTimeout(searchTimeout);
        searchResults.innerHTML = '';
        
        if (e.target.value.length < 3) return;
        
        searchTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(e.target.value)}&countrycodes=br`);
                if (!response.ok) throw new Error('Erro na busca');
                
                const data = await response.json();
                
                searchResults.innerHTML = data.slice(0, 5).map(result => `
                    <div class="search-result-item" onclick="selectLocation(${result.lat}, ${result.lon}, '${result.display_name.replace(/'/g, "&apos;")}')">
                        ${result.display_name}
                    </div>
                `).join('');
            } catch (error) {
                console.error('Erro na busca:', error);
                searchResults.innerHTML = '<div class="search-error">Erro ao buscar endereço</div>';
            }
        }, 500);
    });

    // Fechar resultados quando clicar fora
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.map-search-container')) {
            searchResults.innerHTML = '';
        }
    });
}

// Função para selecionar localização
function selectLocation(lat, lon, displayName) {
    const latlng = { lat: parseFloat(lat), lng: parseFloat(lon) };
    
    if (marker) {
        marker.remove();
    }
    
    marker = L.marker(latlng).addTo(map);
    map.setView(latlng, 13);
    
    if (document.getElementById('searchResults')) {
        document.getElementById('searchResults').innerHTML = '';
    }
    if (document.getElementById('addressSearch')) {
        document.getElementById('addressSearch').value = displayName;
    }
    
    saveLocation(latlng);
    getNASAData(latlng.lat, latlng.lng);
}

// Configuração do clique no mapa
function setupMapClickHandler() {
    map.on('click', async function(e) {
        try {
            if (marker) {
                marker.remove();
            }
            
            marker = L.marker(e.latlng).addTo(map);
            
            const climateData = await getNASAData(e.latlng.lat, e.latlng.lng);
            if (climateData) {
                window.climateData = climateData;
                saveLocation(e.latlng);
            }
        } catch (error) {
            console.error('Erro ao processar clique no mapa:', error);
            showError('Erro ao selecionar localização');
        }
    });
}

// Função para salvar localização
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

// Função para obter dados da NASA
async function getNASAData(lat, lng) {
    showLoadingAnimation();
    try {
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

        const response = await fetch(`https://power.larc.nasa.gov/api/temporal/daily/point?${params}`);
        if (!response.ok) throw new Error('Erro na requisição da API da NASA');
        
        const data = await response.json();
        window.climateData = data;
        return data;
    } catch (error) {
        console.error('Erro ao buscar dados da NASA:', error);
        showError('Não foi possível carregar os dados climáticos');
        return null;
    } finally {
        hideLoadingAnimation();
    }
}

// Funções de navegação
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
        
        // Limpar conteúdo anterior
        content.innerHTML = '<div class="loading-spinner"></div>';
        
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

    // Atualizar URL sem recarregar a página
    window.history.pushState({}, '', `#${screenName}`);
    toggleSidebar();
}

// Funções de simulação
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
                        </select>
                    </div>

                    <div class="input-group">
                        <label for="area">Área (hectares)</label>
                        <input type="number" class="modern-input" id="area" required min="0.1" step="0.1">
                    </div>

                    <div class="input-group">
                        <label for="irrigation">Sistema de Irrigação</label>
                        <select class="modern-input" id="irrigation" required>
                            <option value="">Selecione o sistema</option>
                            <option value="cerqueiro">Cerqueiro (Baseado em dados climáticos)</option>
                        </select>
                        <small class="input-help">Sistema cerqueiro utiliza dados climáticos da NASA para otimizar a irrigação</small>
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

    // Preencher o select de culturas
    const cropSelect = document.getElementById('crop');
    if (cropSelect) {
        const crops = Object.keys(baseYield).sort((a, b) => getCropName(a).localeCompare(getCropName(b)));
        cropSelect.innerHTML = `
            <option value="">Selecione a cultura</option>
            ${crops.map(crop => `<option value="${crop}">${getCropName(crop)}</option>`).join('')}
        `;
    }

    // Definir data mínima como hoje
    const plantingDateInput = document.getElementById('plantingDate');
    if (plantingDateInput) {
        const today = new Date().toISOString().split('T')[0];
        plantingDateInput.min = today;
        plantingDateInput.value = today;
    }
}

async function handleSimulation(event) {
    event.preventDefault();
    
    try {
        // Verificar se uma localização foi selecionada
        if (!window.climateData) {
            const warningElement = document.getElementById('locationWarning');
            if (warningElement) {
                warningElement.style.display = 'flex';
                warningElement.scrollIntoView({ behavior: 'smooth' });
            }
            return;
        }

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

        // Validar dados
        if (!data.crop || !data.area || !data.irrigation || !data.soil || !data.plantingDate) {throw new Error('Todos os campos são obrigatórios');
        }

        // Validar área mínima
        if (data.area < 0.1) {
            throw new Error('A área mínima é de 0.1 hectares');
        }

        // Simular processamento
        await new Promise(resolve => setTimeout(resolve, 1000));

        const results = calculateCropMetrics(data);
        
        if (!results) {
            throw new Error('Erro ao calcular métricas da cultura');
        }

        // Salvar no histórico
        await saveToHistory({
            ...data,
            results,
            timestamp: new Date().toISOString()
        });

        // Mostrar resultados
        const resultsContainer = document.getElementById('simulationResults');
        if (resultsContainer) {
            showSimulationResults(results, data);
            resultsContainer.scrollIntoView({ behavior: 'smooth' });
        }

    } catch (error) {
        console.error('Erro na simulação:', error);
        showError(error.message || 'Erro ao processar a simulação');
    } finally {
        hideLoadingAnimation();
    }
}

// Funções de Loading
function showLoadingAnimation() {
    const loading = document.getElementById('loadingOverlay');
    if (loading) {
        loading.style.display = 'flex';
    } else {
        const loadingElement = document.createElement('div');
        loadingElement.id = 'loadingOverlay';
        loadingElement.className = 'loading-overlay';
        loadingElement.innerHTML = `
            <div class="loading-spinner"></div>
            <p>Calculando resultados...</p>
        `;
        document.body.appendChild(loadingElement);
    }
}

function hideLoadingAnimation() {
    const loading = document.getElementById('loadingOverlay');
    if (loading) {
        loading.style.display = 'none';
    }
}

// Cálculo de métricas da cultura
function calculateCropMetrics(data) {
    try {
        // Validar dados de entrada
        if (!data || !data.crop || !data.area || !data.irrigation || !data.soil || !data.plantingDate) {
            console.error('Dados de entrada inválidos para cálculo de métricas');
            return null;
        }

        // Verificar se a cultura é suportada
        if (!baseYield[data.crop]) {
            console.error('Cultura não suportada:', data.crop);
            return null;
        }

        // Fatores de eficiência de irrigação
        const irrigationEfficiency = {
            cerqueiro: calculateIrrigationEfficiency(window.climateData)
        };

        // Verificar sistema de irrigação
        if (!irrigationEfficiency[data.irrigation]) {
            console.error('Sistema de irrigação não suportado:', data.irrigation);
            return null;
        }

        // Fatores de qualidade do solo
        const soilQuality = {
            clay: 1.1,  // Solo argiloso
            sandy: 0.8, // Solo arenoso
            loam: 1.3   // Solo franco
        };

        // Verificar tipo de solo
        if (!soilQuality[data.soil]) {
            console.error('Tipo de solo não suportado:', data.soil);
            return null;
        }

        // Cálculo da produtividade
        const yieldPerHectare = baseYield[data.crop] * 
            irrigationEfficiency[data.irrigation] * 
            soilQuality[data.soil];
        
        const validArea = Math.max(0.1, Number(data.area));
        const totalYield = yieldPerHectare * validArea;

        // Necessidade hídrica base (mm)
        const waterUsage = {
            soybean: 550,     // Soja
            corn: 700,        // Milho
            wheat: 450,       // Trigo
            cotton: 800,      // Algodão
            rice: 1200,       // Arroz
            beans: 400,       // Feijão
            cassava: 800,     // Mandioca
            potato: 500,      // Batata
            sugarcane: 1500,  // Cana-de-açúcar
            coffee: 1600,     // Café
            orange: 900,      // Laranja
            grape: 700,       // Uva
            apple: 800,       // Maçã
            banana: 1800,     // Banana
            mango: 1000,      // Manga
            papaya: 1600,     // Mamão
            pineapple: 1200,  // Abacaxi
            watermelon: 500,  // Melancia
            melon: 450,       // Melão
            tomato: 600,      // Tomate
            onion: 450,       // Cebola
            carrot: 400,      // Cenoura
            lettuce: 250,     // Alface
            cabbage: 380,     // Repolho
            pepper: 600,      // Pimentão
            cucumber: 450,    // Pepino
            garlic: 350,      // Alho
            peanut: 500,      // Amendoim
            sunflower: 600,   // Girassol
            tobacco: 500,     // Tabaco
            eucalyptus: 1200, // Eucalipto
            pine: 1000,       // Pinus
            rubber: 1500,     // Seringueira
            palm: 1300,       // Palmeira
            coconut: 1300,    // Coco
            avocado: 900,     // Abacate
            lemon: 900,       // Limão
            tangerine: 900,   // Tangerina
            passion_fruit: 800, // Maracujá
            guava: 800,       // Goiaba
            fig: 700,         // Figo
            peach: 750,       // Pêssego
            plum: 700,        // Ameixa
            pear: 750,        // Pera
            strawberry: 500,  // Morango
            blackberry: 600,  // Amora
            raspberry: 600,   // Framboesa
            blueberry: 550,   // Mirtilo
            acai: 1200,       // Açaí
            cashew: 800       // Caju
        };

        // Calcular necessidade hídrica
        const waterEfficiency = Math.max(0.1, irrigationEfficiency[data.irrigation]);
        const waterRequired = validArea * waterUsage[data.crop] * (1 / waterEfficiency);

        // Ciclo da cultura (dias)
        const cycles = {
            soybean: 120,     // Soja
            corn: 135,        // Milho
            wheat: 110,       // Trigo
            cotton: 170,      // Algodão
            rice: 120,        // Arroz
            beans: 90,        // Feijão
            cassava: 300,     // Mandioca
            potato: 100,      // Batata
            sugarcane: 365,   // Cana-de-açúcar
            coffee: 730,      // Café
            orange: 240,      // Laranja
            grape: 150,       // Uva
            apple: 180,       // Maçã
            banana: 300,      // Banana
            mango: 150,       // Manga
            papaya: 240,      // Mamão
            pineapple: 450,   // Abacaxi
            watermelon: 90,   // Melancia
            melon: 80,        // Melão
            tomato: 120,      // Tomate
            onion: 120,       // Cebola
            carrot: 100,      // Cenoura
            lettuce: 45,      // Alface
            cabbage: 90,      // Repolho
            pepper: 120,      // Pimentão
            cucumber: 60,     // Pepino
            garlic: 150,      // Alho
            peanut: 120,      // Amendoim
            sunflower: 120,   // Girassol
            tobacco: 180,     // Tabaco
            eucalyptus: 2190, // Eucalipto
            pine: 2555,       // Pinus
            rubber: 2190,     // Seringueira
            palm: 1095,       // Palmeira
            coconut: 1825,    // Coco
            avocado: 1095,    // Abacate
            lemon: 365,       // Limão
            tangerine: 365,   // Tangerina
            passion_fruit: 270, // Maracujá
            guava: 365,       // Goiaba
            fig: 365,         // Figo
            peach: 180,       // Pêssego
            plum: 180,        // Ameixa
            pear: 180,        // Pera
            strawberry: 90,   // Morango
            blackberry: 120,  // Amora
            raspberry: 120,   // Framboesa
            blueberry: 120,   // Mirtilo
            acai: 1460,       // Açaí
            cashew: 730       // Caju
        };

        // Calcular data de colheita
        let harvestDate = new Date(data.plantingDate);
        harvestDate.setDate(harvestDate.getDate() + cycles[data.crop]);

        // Cálculos detalhados
        const calculations = {
            yieldCalc: {
                baseYield: baseYield[data.crop],
                irrigationFactor: irrigationEfficiency[data.irrigation],
                soilFactor: soilQuality[data.soil],
                area: validArea
            },
            waterCalc: {
                baseUsage: waterUsage[data.crop],
                irrigationFactor: irrigationEfficiency[data.irrigation],
                area: validArea
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

    } catch (error) {
        console.error('Erro ao calcular métricas:', error);
        return null;
    }
}

// Função para calcular eficiência de irrigação
function calculateIrrigationEfficiency(climateData) {
    if (!climateData || !climateData.properties || !climateData.properties.parameter) {
        return 0.7; // Eficiência padrão
    }

    try {
        const data = climateData.properties.parameter;
        const temp = data.T2M;
        const precip = data.PRECTOT;
        const humidity = data.RH2M;

        // Calcular médias
        const calcAverage = (values) => {
            const nums = Object.values(values).filter(v => typeof v === 'number' && !isNaN(v));
            return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
        };

        const avgTemp = calcAverage(temp);
        const avgPrecip = calcAverage(precip);
        const avgHumidity = calcAverage(humidity);

        if (avgTemp === null || avgPrecip === null || avgHumidity === null) {
            return 0.7;
        }

        // Função sigmoide
        const sigmoid = (x, center, steepness) => 1 / (1 + Math.exp(-steepness * (x - center)));

        // Fatores de eficiência
        const tempEff = sigmoid(avgTemp, 25, 0.2) * (avgTemp <= 35 ? 1 : Math.exp(-(avgTemp - 35) / 5));
        const precipEff = Math.exp(-Math.pow(avgPrecip - 50, 2) / 5000);
        const humidityEff = sigmoid(avgHumidity, 65, 0.1);

        // Calcular eficiência final
        const efficiency = (tempEff * 0.4 + precipEff * 0.3 + humidityEff * 0.3);

        return Math.min(0.95, Math.max(0.4, efficiency));
    } catch (error) {
        console.error('Erro ao calcular eficiência de irrigação:', error);
        return 0.7;
    }
}

// Função para exibir resultados
function showSimulationResults(results, inputData) {
    const resultsContainer = document.getElementById('simulationResults');
    if (!resultsContainer) return;

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
// Calcular probabilidades
function calculateProbabilities(climateData, inputData) {
    if (!climateData || !climateData.properties || !climateData.properties.parameter) {
        return {
            yield: 50,
            water: 50,
            climate: 50
        };
    }

    try {
        const data = climateData.properties.parameter;
        const temp = data.T2M;
        const precip = data.PRECTOT;
        const humidity = data.RH2M;

        // Calcular médias
        const avgTemp = Object.values(temp).reduce((a, b) => a + b, 0) / Object.keys(temp).length;
        const avgPrecip = Object.values(precip).reduce((a, b) => a + b, 0) / Object.keys(precip).length;
        const avgHumidity = Object.values(humidity).reduce((a, b) => a + b, 0) / Object.keys(humidity).length;

        const yieldProb = calculateYieldProbability(avgTemp, avgPrecip, avgHumidity, inputData.crop);
        const waterProb = calculateWaterProbability(avgPrecip, inputData.crop);
        const climateProb = calculateClimateProbability(avgTemp, avgHumidity, inputData.crop);

        return {
            yield: Math.round(yieldProb * 100),
            water: Math.round(waterProb * 100),
            climate: Math.round(climateProb * 100)
        };
    } catch (error) {
        console.error('Erro ao calcular probabilidades:', error);
        return {
            yield: 50,
            water: 50,
            climate: 50
        };
    }
}

// Função para probabilidade de produtividade
function calculateYieldProbability(temp, precip, humidity, crop) {
    const idealConditions = {
        soybean: { temp: [20, 30], precip: [450, 700], humidity: [60, 80] },
        corn: { temp: [22, 32], precip: [500, 800], humidity: [55, 75] },
        wheat: { temp: [15, 25], precip: [350, 450], humidity: [50, 70] },
        cotton: { temp: [23, 33], precip: [600, 800], humidity: [55, 75] },
        rice: { temp: [20, 30], precip: [800, 1200], humidity: [65, 85] },
        // ... (continua com todas as culturas)
    };

    if (!idealConditions[crop]) return 0.5;

    const gaussian = (x, min, max) => {
        const mean = (min + max) / 2;
        const std = (max - min) / 4;
        return Math.exp(-Math.pow(x - mean, 2) / (2 * Math.pow(std, 2)));
    };

    const tempProb = gaussian(temp, ...idealConditions[crop].temp);
    const precipProb = gaussian(precip, ...idealConditions[crop].precip);
    const humidityProb = gaussian(humidity, ...idealConditions[crop].humidity);

    const weightedProb = (tempProb * 0.4) + (precipProb * 0.35) + (humidityProb * 0.25);

    return Math.min(0.95, Math.max(0.05, weightedProb));
}

// Função para probabilidade de disponibilidade hídrica
function calculateWaterProbability(precip, crop) {
    const waterRequirements = {
        soybean: { min: 450, optimal: 550, max: 800 },
        corn: { min: 500, optimal: 650, max: 900 },
        wheat: { min: 350, optimal: 450, max: 600 },
        cotton: { min: 600, optimal: 750, max: 1000 },
        rice: { min: 1000, optimal: 1200, max: 1500 },
        // ... (continua com todas as culturas)
    };

    if (!waterRequirements[crop]) return 0.5;

    const req = waterRequirements[crop];
    
    const calcProb = (x, min, optimal, max) => {
        if (x < min) return Math.max(0.05, x / min);
        if (x > max) return Math.max(0.05, 1 - (x - max) / max);
        
        const leftSide = x <= optimal;
        const reference = leftSide ? min : max;
        const target = optimal;
        const value = leftSide ? x : max - (x - optimal);
        const range = Math.abs(target - reference);
        
        return Math.min(0.95, 0.5 + (value / range) * 0.45);
    };

    return calcProb(precip, req.min, req.optimal, req.max);
}

// Função para probabilidade climática
function calculateClimateProbability(temp, humidity, crop) {
    const idealConditions = {
        soybean: { temp: { min: 20, optimal: 25, max: 30 }, humidity: { min: 60, optimal: 70, max: 80 } },
        corn: { temp: { min: 22, optimal: 27, max: 32 }, humidity: { min: 55, optimal: 65, max: 75 } },
        wheat: { temp: { min: 15, optimal: 20, max: 25 }, humidity: { min: 50, optimal: 60, max: 70 } },
        // ... (continua com todas as culturas)
    };

    if (!idealConditions[crop]) return 0.5;

    const ideal = idealConditions[crop];

    const sigmoid = (x, min, optimal, max) => {
        if (x < min) return Math.exp(-Math.pow(min - x, 2) / (2 * Math.pow(min - optimal, 2)));
        if (x > max) return Math.exp(-Math.pow(x - max, 2) / (2 * Math.pow(max - optimal, 2)));
        return 1;
    };

    const tempProb = sigmoid(temp, ideal.temp.min, ideal.temp.optimal, ideal.temp.max);
    const humidityProb = sigmoid(humidity, ideal.humidity.min, ideal.humidity.optimal, ideal.humidity.max);

    const combinedProb = (tempProb * 0.6) + (humidityProb * 0.4);

    return Math.min(0.95, Math.max(0.05, combinedProb));
}

// Função para mostrar detalhes dos cálculos
function showCalculationDetails(type, results, inputData) {
    let title, content;

    switch(type) {
        case 'yield':
            title = 'Cálculo da Produtividade';
            content = `
                <div class="calculation-step">
                    <p><strong>Produtividade Base:</strong> ${results.calculations.yieldCalc.baseYield} ton/ha</p>
                    <p><strong>Fator de Irrigação:</strong> ${results.calculations.yieldCalc.irrigationFactor.toFixed(2)}</p>
                    <p><strong>Fator do Solo:</strong> ${results.calculations.yieldCalc.soilFactor}</p>
                    <p><strong>Área:</strong> ${results.calculations.yieldCalc.area} ha</p>
                    <hr>
                    <p><strong>Cálculo:</strong></p>
                    <p>${results.calculations.yieldCalc.baseYield} × ${results.calculations.yieldCalc.irrigationFactor.toFixed(2)} × ${results.calculations.yieldCalc.soilFactor} × ${results.calculations.yieldCalc.area} = ${results.yield} ton</p>
                </div>
            `;
            break;
        case 'water':
            title = 'Cálculo da Necessidade Hídrica';
            content = `
                <div class="calculation-step">
                    <p><strong>Necessidade Base:</strong> ${results.calculations.waterCalc.baseUsage} mm</p>
                    <p><strong>Fator de Irrigação:</strong> ${results.calculations.waterCalc.irrigationFactor.toFixed(2)}</p>
                    <p><strong>Área:</strong> ${results.calculations.waterCalc.area} ha</p>
                    <hr>
                    <p><strong>Cálculo:</strong></p>
                    <p>${results.calculations.waterCalc.baseUsage} × ${results.calculations.waterCalc.area} ÷ ${results.calculations.waterCalc.irrigationFactor.toFixed(2)} = ${results.water} mm</p>
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
    try {
        const history = JSON.parse(localStorage.getItem('simulationHistory') || '[]');
        history.unshift({
            id: Date.now(),
            ...simulation
        });
        localStorage.setItem('simulationHistory', JSON.stringify(history.slice(0, 50)));
    } catch (error) {
        console.error('Erro ao salvar no histórico:', error);
        showError('Não foi possível salvar no histórico');
    }
}

function loadHistoryScreen() {
    const content = document.getElementById('content');
    try {
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
                                Ver Detalhes
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
        content.innerHTML = `
            <div class="history-container">
                <h2>Histórico de Simulações</h2>
                <p class="error-message">Erro ao carregar histórico</p>
            </div>
        `;
    }
}

// Funções utilitárias
function formatarData(data) {
    try {
        return new Date(data).toLocaleDateString('pt-BR');
    } catch (error) {
        console.error('Erro ao formatar data:', error);
        return data;
    }
}

function getCropName(crop) {
    const names = {
        soybean: 'Soja',
        corn: 'Milho',
        wheat: 'Trigo',
        cotton: 'Algodão',
        rice: 'Arroz',
        beans: 'Feijão',
        cassava: 'Mandioca',
        potato: 'Batata',
        sugarcane: 'Cana-de-açúcar',
        coffee: 'Café',
        orange: 'Laranja',
        grape: 'Uva',
        apple: 'Maçã',
        banana: 'Banana',
        mango: 'Manga',
        papaya: 'Mamão',
        pineapple: 'Abacaxi',
        watermelon: 'Melancia',
        melon: 'Melão',
        tomato: 'Tomate',
        onion: 'Cebola',
        carrot: 'Cenoura',
        lettuce: 'Alface',
        cabbage: 'Repolho',
        pepper: 'Pimentão',
        cucumber: 'Pepino',
        garlic: 'Alho',
        peanut: 'Amendoim',
        sunflower: 'Girassol',
        tobacco: 'Tabaco',
        eucalyptus: 'Eucalipto',
        pine: 'Pinus',
        rubber: 'Seringueira',
        palm: 'Palmeira',
        coconut: 'Coco',
        avocado: 'Abacate',
        lemon: 'Limão',
        tangerine: 'Tangerina',
        passion_fruit: 'Maracujá',
        guava: 'Goiaba',
        fig: 'Figo',
        peach: 'Pêssego',
        plum: 'Ameixa',
        pear: 'Pera',
        strawberry: 'Morango',
        blackberry: 'Amora',
        raspberry: 'Framboesa',
        blueberry: 'Mirtilo',
        acai: 'Açaí',
        cashew: 'Caju'
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
            `https://newsapi.org/v2/everything?q=agricultura+rural+brasil&language=pt&sortBy=publishedAt&apiKey=YOUR_API_KEY`
        );
        
        if (!response.ok) {
            throw new Error('Erro ao buscar notícias');
        }

        const data = await response.json();

        if (!data.articles || data.articles.length === 0) {
            document.getElementById('newsContent').innerHTML = 
                '<p class="empty-news">Nenhuma notícia encontrada</p>';
            return;
        }

        document.getElementById('newsContent').innerHTML = data.articles
            .slice(0, 6)
            .map(article => `
                <div class="news-card">
                    <div class="news-date">${formatarData(article.publishedAt)}</div>
                    <h3>${article.title}</h3>
                    <p>${article.description || 'Sem descrição disponível'}</p>
                    <a href="${article.url}" target="_blank" rel="noopener noreferrer" class="news-link">
                        Ler mais
                    </a>
                </div>
            `).join('');

    } catch (error) {
        console.error('Erro ao carregar notícias:', error);
        document.getElementById('newsContent').innerHTML = 
            '<p class="error-message">Erro ao carregar notícias. Tente novamente mais tarde.</p>';
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
