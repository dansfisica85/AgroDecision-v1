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
            <div class="location-warning" id="locationWarning" style="display: none;">
                <p>⚠️ Selecione uma localização no mapa antes de simular</p>
            </div>
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
                            <option value="sugarcane">Cana-de-açúcar</option>
                            <option value="coffee">Café</option>
                            <option value="orange">Laranja</option>
                            <option value="grape">Uva</option>
                            <option value="apple">Maçã</option>
                            <option value="banana">Banana</option>
                            <option value="mango">Manga</option>
                            <option value="papaya">Mamão</option>
                            <option value="pineapple">Abacaxi</option>
                            <option value="watermelon">Melancia</option>
                            <option value="melon">Melão</option>
                            <option value="tomato">Tomate</option>
                            <option value="onion">Cebola</option>
                            <option value="carrot">Cenoura</option>
                            <option value="lettuce">Alface</option>
                            <option value="cabbage">Repolho</option>
                            <option value="pepper">Pimentão</option>
                            <option value="cucumber">Pepino</option>
                            <option value="garlic">Alho</option>
                            <option value="peanut">Amendoim</option>
                            <option value="sunflower">Girassol</option>
                            <option value="tobacco">Tabaco</option>
                            <option value="eucalyptus">Eucalipto</option>
                            <option value="pine">Pinus</option>
                            <option value="rubber">Seringueira</option>
                            <option value="palm">Palmeira</option>
                            <option value="coconut">Coco</option>
                            <option value="avocado">Abacate</option>
                            <option value="lemon">Limão</option>
                            <option value="tangerine">Tangerina</option>
                            <option value="passion_fruit">Maracujá</option>
                            <option value="guava">Goiaba</option>
                            <option value="fig">Figo</option>
                            <option value="peach">Pêssego</option>
                            <option value="plum">Ameixa</option>
                            <option value="pear">Pera</option>
                            <option value="strawberry">Morango</option>
                            <option value="blackberry">Amora</option>
                            <option value="raspberry">Framboesa</option>
                            <option value="blueberry">Mirtilo</option>
                            <option value="acai">Açaí</option>
                            <option value="cashew">Caju</option>
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
    
    try {
        // Verificar se uma localização foi selecionada
        if (!window.climateData) {
            showError('Por favor, selecione uma localização no mapa antes de simular');
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
        if (!data.crop || !data.area || !data.irrigation || !data.soil || !data.plantingDate) {
            throw new Error('Todos os campos são obrigatórios');
        }

        // Simular processamento
        await new Promise(resolve => setTimeout(resolve, 1500));

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

function showLoadingAnimation() {
    const loading = document.createElement('div');
    loading.className = 'loading-animation';
    loading.id = 'loadingAnimation';
    loading.innerHTML = `
        <div class="loading-overlay"></div>
        <div class="loading-content">
            <div class="spinner"></div>
            <p>Calculando resultados...</p>
        </div>
    `;
    document.body.appendChild(loading);
}

function hideLoadingAnimation() {
    const loading = document.getElementById('loadingAnimation');
    if (loading) {
        loading.classList.add('fade-out');
        setTimeout(() => loading.remove(), 500);
    }
}

function calculateCropMetrics(data) {
    // Validação de entrada
    if (!data || !data.crop || !data.area || !data.irrigation || !data.soil || !data.plantingDate) {
        console.error('Dados de entrada inválidos para cálculo de métricas');
        return {
            yield: '0.00',
            water: '0.00',
            cycle: 0,
            harvestDate: new Date().toISOString().split('T')[0],
            calculations: {
                yieldCalc: { baseYield: 0, irrigationFactor: 0, soilFactor: 0, area: 0 },
                waterCalc: { baseUsage: 0, irrigationFactor: 0, area: 0 },
                cycleCalc: { duration: 0, plantingDate: new Date().toISOString().split('T')[0] }
            }
        };
    }

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

    // Verificar se a cultura é suportada
    if (!baseYield[data.crop]) {
        console.error('Cultura não suportada:', data.crop);
        return null;
    }

    // Fatores de eficiência de irrigação baseados em dados climáticos
    const irrigationEfficiency = {
        cerqueiro: calculateIrrigationEfficiency(window.climateData)
    };

    // Verificar se o sistema de irrigação é suportado
    if (!irrigationEfficiency[data.irrigation]) {
        console.error('Sistema de irrigação não suportado:', data.irrigation);
        return null;
    }

    // Fatores de qualidade do solo
    const soilQuality = {
        clay: 1.1,  // Solo argiloso - boa retenção de nutrientes
        sandy: 0.8, // Solo arenoso - menor retenção
        loam: 1.3   // Solo franco - ideal para maioria das culturas
    };

    // Verificar se o tipo de solo é suportado
    if (!soilQuality[data.soil]) {
        console.error('Tipo de solo não suportado:', data.soil);
        return null;
    }

    // Cálculo da produtividade com validação
    const yieldPerHectare = baseYield[data.crop] * 
        irrigationEfficiency[data.irrigation] * 
        soilQuality[data.soil];
    
    // Garantir que a área é um número positivo
    const validArea = Math.max(0, Number(data.area));
    const totalYield = yieldPerHectare * validArea;

    // Necessidade hídrica base (mm) com validação
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

    // Calcular necessidade hídrica com proteção contra divisão por zero
    const waterRequired = validArea * waterUsage[data.crop] * 
        (1 / Math.max(0.1, irrigationEfficiency[data.irrigation]));

    // Ciclo da cultura (dias) com validação
    const cycles = {
        soybean: 120,     // Soja
        corn: 135,        // Milho
        wheat: 110,       // Trigo
        cotton: 170,      // Algodão
        rice: 120,        // Arroz
        beans: 90,        // Feijão
        cassava: 300,     // Mandioca
        potato: 100,      // Batata
        sugarcane: 365,   // Cana-de-açúcar (ciclo de 12 meses)
        coffee: 730,      // Café (primeiro ciclo)
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
        eucalyptus: 2190, // Eucalipto (ciclo inicial - 6 anos)
        pine: 2555,       // Pinus (ciclo inicial - 7 anos)
        rubber: 2190,     // Seringueira (produção inicial)
        palm: 1095,       // Palmeira (produção inicial - 3 anos)
        coconut: 1825,    // Coco (produção inicial - 5 anos)
        avocado: 1095,    // Abacate (produção inicial - 3 anos)
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
        acai: 1460,       // Açaí (produção inicial - 4 anos)
        cashew: 730       // Caju (produção inicial - 2 anos)
    };

    // Validar e calcular data de colheita
    let harvestDate;
    try {
        harvestDate = new Date(data.plantingDate);
        if (isNaN(harvestDate.getTime())) throw new Error('Data de plantio inválida');
        harvestDate.setDate(harvestDate.getDate() + cycles[data.crop]);
    } catch (error) {
        console.error('Erro ao calcular data de colheita:', error);
        harvestDate = new Date();
    }

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
        return 0.7; // Eficiência padrão conservadora
    }

    const data = climateData.properties.parameter;
    const temp = data.T2M;
    const precip = data.PRECTOT;
    const humidity = data.RH2M;

    // Calcular médias com validação
    const calcAverage = (values) => {
        const nums = Object.values(values).filter(v => typeof v === 'number' && !isNaN(v));
        return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    };

    const avgTemp = calcAverage(temp);
    const avgPrecip = calcAverage(precip);
    const avgHumidity = calcAverage(humidity);

    if (avgTemp === null || avgPrecip === null || avgHumidity === null) {
        return 0.7; // Valor padrão se dados inválidos
    }

    // Função sigmoide para suavizar transições
    const sigmoid = (x, center, steepness) => 1 / (1 + Math.exp(-steepness * (x - center)));

    // Fatores de eficiência com curvas não-lineares
    const tempEff = sigmoid(avgTemp, 25, 0.2) * (avgTemp <= 35 ? 1 : Math.exp(-(avgTemp - 35) / 5));
    const precipEff = Math.exp(-Math.pow(avgPrecip - 50, 2) / 5000);
    const humidityEff = sigmoid(avgHumidity, 65, 0.1);

    // Pesos para cada fator
    const efficiency = (tempEff * 0.4 + precipEff * 0.3 + humidityEff * 0.3);

    // Garantir limites realistas
    return Math.min(0.95, Math.max(0.4, efficiency));
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
    // Validação de entrada
    if (!temp || !precip || !humidity || !crop) {
        return 0.5; // Probabilidade neutra para dados inválidos
    }

    const idealConditions = {
        soybean: { temp: [20, 30], precip: [450, 700], humidity: [60, 80] },
        corn: { temp: [22, 32], precip: [500, 800], humidity: [55, 75] },
        wheat: { temp: [15, 25], precip: [350, 450], humidity: [50, 70] },
        cotton: { temp: [23, 33], precip: [600, 800], humidity: [55, 75] },
        rice: { temp: [20, 30], precip: [800, 1200], humidity: [65, 85] },
        beans: { temp: [17, 27], precip: [300, 400], humidity: [55, 75] },
        cassava: { temp: [19, 29], precip: [600, 800], humidity: [60, 80] },
        potato: { temp: [15, 25], precip: [400, 500], humidity: [65, 85] },
        sugarcane: { temp: [22, 35], precip: [1200, 1800], humidity: [70, 85] },
        coffee: { temp: [18, 26], precip: [1200, 2000], humidity: [60, 80] },
        orange: { temp: [20, 30], precip: [800, 1000], humidity: [65, 80] },
        grape: { temp: [15, 25], precip: [600, 800], humidity: [60, 75] },
        apple: { temp: [10, 20], precip: [700, 900], humidity: [60, 75] },
        banana: { temp: [22, 32], precip: [1500, 2100], humidity: [75, 90] },
        mango: { temp: [24, 34], precip: [800, 1200], humidity: [65, 80] },
        papaya: { temp: [22, 32], precip: [1200, 2000], humidity: [70, 85] },
        pineapple: { temp: [22, 32], precip: [1000, 1400], humidity: [70, 85] },
        watermelon: { temp: [22, 32], precip: [400, 600], humidity: [60, 75] },
        melon: { temp: [22, 32], precip: [350, 550], humidity: [60, 75] },
        tomato: { temp: [18, 28], precip: [500, 700], humidity: [60, 80] },
        onion: { temp: [15, 25], precip: [350, 550], humidity: [60, 75] },
        carrot: { temp: [15, 25], precip: [300, 500], humidity: [60, 75] },
        lettuce: { temp: [15, 20], precip: [200, 300], humidity: [60, 80] },
        cabbage: { temp: [15, 25], precip: [300, 450], humidity: [60, 80] },
        pepper: { temp: [20, 30], precip: [500, 700], humidity: [60, 80] },
        cucumber: { temp: [20, 30], precip: [350, 550], humidity: [60, 80] },
        garlic: { temp: [15, 25], precip: [300, 400], humidity: [60, 75] },
        peanut: { temp: [22, 32], precip: [400, 600], humidity: [60, 75] },
        sunflower: { temp: [20, 30], precip: [500, 700], humidity: [60, 75] },
        tobacco: { temp: [20, 30], precip: [400, 600], humidity: [65, 80] },
        eucalyptus: { temp: [15, 35], precip: [800, 1600], humidity: [60, 80] },
        pine: { temp: [10, 25], precip: [800, 1200], humidity: [60, 80] },
        rubber: { temp: [22, 32], precip: [1200, 1800], humidity: [70, 85] },
        palm: { temp: [22, 32], precip: [1000, 1600], humidity: [70, 85] },
        coconut: { temp: [22, 32], precip: [1000, 1600], humidity: [70, 85] },
        avocado: { temp: [20, 30], precip: [800, 1000], humidity: [65, 80] },
        lemon: { temp: [20, 30], precip: [800, 1000], humidity: [65, 80] },
        tangerine: { temp: [20, 30], precip: [800, 1000], humidity: [65, 80] },
        passion_fruit: { temp: [20, 30], precip: [600, 1000], humidity: [65, 80] },
        guava: { temp: [20, 30], precip: [600, 1000], humidity: [65, 80] },
        fig: { temp: [20, 30], precip: [600, 800], humidity: [60, 75] },
        peach: { temp: [15, 25], precip: [600, 800], humidity: [60, 75] },
        plum: { temp: [15, 25], precip: [600, 800], humidity: [60, 75] },
        pear: { temp: [15, 25], precip: [600, 800], humidity: [60, 75] },
        strawberry: { temp: [15, 25], precip: [400, 600], humidity: [65, 80] },
        blackberry: { temp: [15, 25], precip: [500, 700], humidity: [65, 80] },
        raspberry: { temp: [15, 25], precip: [500, 700], humidity: [65, 80] },
        blueberry: { temp: [15, 25], precip: [450, 650], humidity: [65, 80] },
        acai: { temp: [22, 32], precip: [1000, 1600], humidity: [70, 85] },
        cashew: { temp: [22, 32], precip: [600, 1000], humidity: [65, 80] }
    };

    const ideal = idealConditions[crop];
    if (!ideal) return 0.5;

    // Função gaussiana para calcular adequação
    const gaussian = (x, min, max) => {
        const mean = (min + max) / 2;
        const std = (max - min) / 4;
        return Math.exp(-Math.pow(x - mean, 2) / (2 * Math.pow(std, 2)));
    };

    // Calcular probabilidades individuais
    const tempProb = gaussian(temp, ideal.temp[0], ideal.temp[1]);
    const precipProb = gaussian(precip, ideal.precip[0], ideal.precip[1]);
    const humidityProb = gaussian(humidity, ideal.humidity[0], ideal.humidity[1]);

    // Pesos diferentes para cada fator
    const weightedProb = (tempProb * 0.4) + (precipProb * 0.35) + (humidityProb * 0.25);

    // Garantir limites realistas
    return Math.min(0.95, Math.max(0.05, weightedProb));
}

function calculateWaterProbability(precip, crop) {
    // Validação de entrada
    if (!precip || !crop) {
        return 0.5; // Probabilidade neutra para dados inválidos
    }

    const waterRequirements = {
        soybean: { min: 450, optimal: 550, max: 800 },
        corn: { min: 500, optimal: 650, max: 900 },
        wheat: { min: 350, optimal: 450, max: 600 },
        cotton: { min: 600, optimal: 750, max: 1000 },
        rice: { min: 1000, optimal: 1200, max: 1500 },
        beans: { min: 300, optimal: 400, max: 550 },
        cassava: { min: 600, optimal: 750, max: 1000 },
        potato: { min: 400, optimal: 500, max: 700 },
        sugarcane: { min: 1200, optimal: 1500, max: 1800 },
        coffee: { min: 1200, optimal: 1600, max: 2000 },
        orange: { min: 800, optimal: 900, max: 1000 },
        grape: { min: 600, optimal: 700, max: 800 },
        apple: { min: 700, optimal: 800, max: 900 },
        banana: { min: 1500, optimal: 1800, max: 2100 },
        mango: { min: 800, optimal: 1000, max: 1200 },
        papaya: { min: 1200, optimal: 1600, max: 2000 },
        pineapple: { min: 1000, optimal: 1200, max: 1400 },
        watermelon: { min: 400, optimal: 500, max: 600 },
        melon: { min: 350, optimal: 450, max: 550 },
        tomato: { min: 500, optimal: 600, max: 700 },
        onion: { min: 350, optimal: 450, max: 550 },
        carrot: { min: 300, optimal: 400, max: 500 },
        lettuce: { min: 200, optimal: 250, max: 300 },
        cabbage: { min: 300, optimal: 380, max: 450 },
        pepper: { min: 500, optimal: 600, max: 700 },
        cucumber: { min: 350, optimal: 450, max: 550 },
        garlic: { min: 300, optimal: 350, max: 400 },
        peanut: { min: 400, optimal: 500, max: 600 },
        sunflower: { min: 500, optimal: 600, max: 700 },
        tobacco: { min: 400, optimal: 500, max: 600 },
        eucalyptus: { min: 800, optimal: 1200, max: 1600 },
        pine: { min: 800, optimal: 1000, max: 1200 },
        rubber: { min: 1200, optimal: 1500, max: 1800 },
        palm: { min: 1000, optimal: 1300, max: 1600 },
        coconut: { min: 1000, optimal: 1300, max: 1600 },
        avocado: { min: 800, optimal: 900, max: 1000 },
        lemon: { min: 800, optimal: 900, max: 1000 },
        tangerine: { min: 800, optimal: 900, max: 1000 },
        passion_fruit: { min: 600, optimal: 800, max: 1000 },
        guava: { min: 600, optimal: 800, max: 1000 },
        fig: { min: 600, optimal: 700, max: 800 },
        peach: { min: 600, optimal: 700, max: 800 },
        plum: { min: 600, optimal: 700, max: 800 },
        pear: { min: 600, optimal: 700, max: 800 },
        strawberry: { min: 400, optimal: 500, max: 600 },
        blackberry: { min: 500, optimal: 600, max: 700 },
        raspberry: { min: 500, optimal: 600, max: 700 },
        blueberry: { min: 450, optimal: 550, max: 650 },
        acai: { min: 1000, optimal: 1200, max: 1600 },
        cashew: { min: 600, optimal: 800, max: 1000 }
    };

    const req = waterRequirements[crop];
    if (!req) return 0.5;

    // Função de probabilidade baseada em curva sigmoide
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

function calculateClimateProbability(temp, humidity, crop) {
    // Validação de entrada
    if (!temp || !humidity || !crop || typeof temp !== 'number' || typeof humidity !== 'number') {
        return 0.5; // Probabilidade neutra para dados inválidos
    }

    const idealConditions = {
        soybean: { temp: { min: 20, optimal: 25, max: 30 }, humidity: { min: 60, optimal: 70, max: 80 } },
        corn: { temp: { min: 22, optimal: 27, max: 32 }, humidity: { min: 55, optimal: 65, max: 75 } },
        wheat: { temp: { min: 15, optimal: 20, max: 25 }, humidity: { min: 50, optimal: 60, max: 70 } },
        cotton: { temp: { min: 23, optimal: 28, max: 33 }, humidity: { min: 55, optimal: 65, max: 75 } },
        rice: { temp: { min: 20, optimal: 25, max: 30 }, humidity: { min: 65, optimal: 75, max: 85 } },
        beans: { temp: { min: 17, optimal: 22, max: 27 }, humidity: { min: 55, optimal: 65, max: 75 } },
        cassava: { temp: { min: 19, optimal: 24, max: 29 }, humidity: { min: 60, optimal: 70, max: 80 } },
        potato: { temp: { min: 15, optimal: 20, max: 25 }, humidity: { min: 65, optimal: 75, max: 85 } },
        sugarcane: { temp: { min: 22, optimal: 28, max: 35 }, humidity: { min: 70, optimal: 77, max: 85 } },
        coffee: { temp: { min: 18, optimal: 22, max: 26 }, humidity: { min: 60, optimal: 70, max: 80 } },
        orange: { temp: { min: 20, optimal: 25, max: 30 }, humidity: { min: 65, optimal: 72, max: 80 } },
        grape: { temp: { min: 15, optimal: 20, max: 25 }, humidity: { min: 60, optimal: 67, max: 75 } },
        apple: { temp: { min: 10, optimal: 15, max: 20 }, humidity: { min: 60, optimal: 67, max: 75 } },
        banana: { temp: { min: 22, optimal: 27, max: 32 }, humidity: { min: 75, optimal: 82, max: 90 } },
        mango: { temp: { min: 24, optimal: 29, max: 34 }, humidity: { min: 65, optimal: 72, max: 80 } },
        papaya: { temp: { min: 22, optimal: 27, max: 32 }, humidity: { min: 70, optimal: 77, max: 85 } },
        pineapple: { temp: { min: 22, optimal: 27, max: 32 }, humidity: { min: 70, optimal: 77, max: 85 } },
        watermelon: { temp: { min: 22, optimal: 27, max: 32 }, humidity: { min: 60, optimal: 67, max: 75 } },
        melon: { temp: { min: 22, optimal: 27, max: 32 }, humidity: { min: 60, optimal: 67, max: 75 } },
        tomato: { temp: { min: 18, optimal: 23, max: 28 }, humidity: { min: 60, optimal: 70, max: 80 } },
        onion: { temp: { min: 15, optimal: 20, max: 25 }, humidity: { min: 60, optimal: 67, max: 75 } },
        carrot: { temp: { min: 15, optimal: 20, max: 25 }, humidity: { min: 60, optimal: 67, max: 75 } },
        lettuce: { temp: { min: 15, optimal: 17, max: 20 }, humidity: { min: 60, optimal: 70, max: 80 } },
        cabbage: { temp: { min: 15, optimal: 20, max: 25 }, humidity: { min: 60, optimal: 70, max: 80 } },
        pepper: { temp: { min: 20, optimal: 25, max: 30 }, humidity: { min: 60, optimal: 70, max: 80 } },
        cucumber: { temp: { min: 20, optimal: 25, max: 30 }, humidity: { min: 60, optimal: 70, max: 80 } },
        garlic: { temp: { min: 15, optimal: 20, max: 25 }, humidity: { min: 60, optimal: 67, max: 75 } },
        peanut: { temp: { min: 22, optimal: 27, max: 32 }, humidity: { min: 60, optimal: 67, max: 75 } },
        sunflower: { temp: { min: 20, optimal: 25, max: 30 }, humidity: { min: 60, optimal: 67, max: 75 } },
        tobacco: { temp: { min: 20, optimal: 25, max: 30 }, humidity: { min: 65, optimal: 72, max: 80 } },
        eucalyptus: { temp: { min: 15, optimal: 25, max: 35 }, humidity: { min: 60, optimal: 70, max: 80 } },
        pine: { temp: { min: 10, optimal: 17, max: 25 }, humidity: { min: 60, optimal: 70, max: 80 } },
        rubber: { temp: { min: 22, optimal: 27, max: 32 }, humidity: { min: 70, optimal: 77, max: 85 } },
        palm: { temp: { min: 22, optimal: 27, max: 32 }, humidity: { min: 70, optimal: 77, max: 85 } },
        coconut: { temp: { min: 22, optimal: 27, max: 32 }, humidity: { min: 70, optimal: 77, max: 85 } },
        avocado: { temp: { min: 20, optimal: 25, max: 30 }, humidity: { min: 65, optimal: 72, max: 80 } },
        lemon: { temp: { min: 20, optimal: 25, max: 30 }, humidity: { min: 65, optimal: 72, max: 80 } },
        tangerine: { temp: { min: 20, optimal: 25, max: 30 }, humidity: { min: 65, optimal: 72, max: 80 } },
        passion_fruit: { temp: { min: 20, optimal: 25, max: 30 }, humidity: { min: 65, optimal: 72, max: 80 } },
        guava: { temp: { min: 20, optimal: 25, max: 30 }, humidity: { min: 65, optimal: 72, max: 80 } },
        fig: { temp: { min: 20, optimal: 25, max: 30 }, humidity: { min: 60, optimal: 67, max: 75 } },
        peach: { temp: { min: 15, optimal: 20, max: 25 }, humidity: { min: 60, optimal: 67, max: 75 } },
        plum: { temp: { min: 15, optimal: 20, max: 25 }, humidity: { min: 60, optimal: 67, max: 75 } },
        pear: { temp: { min: 15, optimal: 20, max: 25 }, humidity: { min: 60, optimal: 67, max: 75 } },
        strawberry: { temp: { min: 15, optimal: 20, max: 25 }, humidity: { min: 65, optimal: 72, max: 80 } },
        blackberry: { temp: { min: 15, optimal: 20, max: 25 }, humidity: { min: 65, optimal: 72, max: 80 } },
        raspberry: { temp: { min: 15, optimal: 20, max: 25 }, humidity: { min: 65, optimal: 72, max: 80 } },
        blueberry: { temp: { min: 15, optimal: 20, max: 25 }, humidity: { min: 65, optimal: 72, max: 80 } },
        acai: { temp: { min: 22, optimal: 27, max: 32 }, humidity: { min: 70, optimal: 77, max: 85 } },
        cashew: { temp: { min: 22, optimal: 27, max: 32 }, humidity: { min: 65, optimal: 72, max: 80 } }
    };

    const ideal = idealConditions[crop];
    if (!ideal) return 0.5;

    // Função sigmoide para calcular probabilidade
    const sigmoid = (x, min, optimal, max) => {
        if (x < min) return Math.exp(-Math.pow(min - x, 2) / (2 * Math.pow(min - optimal, 2)));
        if (x > max) return Math.exp(-Math.pow(x - max, 2) / (2 * Math.pow(max - optimal, 2)));
        return 1;
    };

    // Calcular probabilidades individuais
    const tempProb = sigmoid(temp, ideal.temp.min, ideal.temp.optimal, ideal.temp.max);
    const humidityProb = sigmoid(humidity, ideal.humidity.min, ideal.humidity.optimal, ideal.humidity.max);

    // Combinar probabilidades com pesos
    const combinedProb = (tempProb * 0.6) + (humidityProb * 0.4); // Temperatura tem peso maior

    // Garantir limites realistas
    return Math.min(0.95, Math.max(0.05, combinedProb));
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

        // Verificar hash da URL e mostrar tela apropriada
        const hash = window.location.hash.slice(1); // Remove o # do início
        if (hash) {
            showScreen(hash);
        }
    };

    // Adicionar listener para mudanças no hash
    window.addEventListener('hashchange', function() {
        const hash = window.location.hash.slice(1);
        if (hash) {
            showScreen(hash);
        } else {
            showScreen('home');
        }
    });