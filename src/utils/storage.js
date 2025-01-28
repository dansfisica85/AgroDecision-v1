export const StorageService = {
    saveLocation(location) {
        localStorage.setItem('selectedLocation', JSON.stringify(location));
    },

    getLocation() {
        try {
            return JSON.parse(localStorage.getItem('selectedLocation'));
        } catch {
            return null;
        }
    },

    saveToHistory(simulationData) {
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
};