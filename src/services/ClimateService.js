export class ClimateService {
    static async getNASAData(lat, lng) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(endDate.getFullYear() - 1);
        
        const params = new URLSearchParams({
            parameters: 'T2M,PRECTOT,RH2M',
            community: 'AG',
            longitude: lng.toFixed(4),
            latitude: lat.toFixed(4),
            start: this.formatDate(startDate),
            end: this.formatDate(endDate),
            format: 'JSON'
        });

        try {
            const response = await fetch(`https://power.larc.nasa.gov/api/temporal/daily/point?${params}`);
            if (!response.ok) throw new Error('Erro na requisição da API da NASA');
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar dados da NASA:', error);
            throw error;
        }
    }

    static formatDate(date) {
        return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    }
}