import { GNEWS_API_KEY } from '../config/constants';

export class NewsService {
    static async fetchAgriculturalNews() {
        const response = await fetch(
            `https://gnews.io/api/v4/search?q=agricultura+brasil&lang=pt&country=br&max=20&apikey=${GNEWS_API_KEY}`
        );
        
        if (!response.ok) throw new Error('Falha ao buscar notícias');
        
        const data = await response.json();
        return data.articles || [];
    }
}