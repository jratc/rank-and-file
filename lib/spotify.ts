import { RankedItem, SearchProvider } from './types';

let cachedToken: string | null = null;
let tokenExpiration: number = 0;

async function getAccessToken() {
    if (cachedToken && Date.now() < tokenExpiration) {
        return cachedToken;
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('Missing Spotify credentials');
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
        },
        body: 'grant_type=client_credentials',
        cache: 'no-store',
    });

    const data = await response.json();

    if (!response.ok) {
        console.error('Spotify Auth Error Response:', data);
        throw new Error('Failed to get access token: ' + (data.error_description || data.error));
    }

    console.log('Got new Spotify Access Token. Scope:', data.scope, 'Type:', data.token_type);

    cachedToken = data.access_token;
    tokenExpiration = Date.now() + (data.expires_in * 1000) - 60000; // Buffer 1 min
    return cachedToken;
}

export const spotifyProvider = {
    async searchAlbums(query: string): Promise<RankedItem[]> {
        console.log(`Searching for albums: ${query}`);
        if (!query) return [];

        try {
            const token = await getAccessToken();

            const params = new URLSearchParams({
                q: query,
                type: 'album',
                limit: '20'
            });

            const response = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                cache: 'no-store'
            });

            if (!response.ok) {
                if (response.status === 403) {
                    console.error('Spotify 403 Forbidden');
                    cachedToken = null;
                    tokenExpiration = 0;
                }
                const errorText = await response.text();
                console.error('Spotify Search API Error:', response.status, errorText);
                throw new Error(`Spotify API Error: ${response.status}`);
            }

            const data = await response.json();
            return (data.albums?.items || []).map((item: any) => ({
                id: item.id,
                name: item.name,
                subtitle: item.artists.map((a: any) => a.name).join(', '),
                imageUrl: item.images[0]?.url || '',
                externalUrl: item.external_urls.spotify,
                provider: 'spotify',
                category: 'music',
                rawMetadata: item,
            }));

        } catch (error) {
            console.error('Spotify Search Exception:', error);
            return [];
        }
    },

    async searchTracks(query: string): Promise<RankedItem[]> {
        console.log(`Searching for tracks: ${query}`);
        if (!query) return [];

        try {
            const token = await getAccessToken();

            const params = new URLSearchParams({
                q: query,
                type: 'track',
                limit: '20'
            });

            const response = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                cache: 'no-store'
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Spotify Track Search API Error:', response.status, errorText);
                throw new Error(`Spotify API Error: ${response.status}`);
            }

            const data = await response.json();
            return (data.tracks?.items || []).map((item: any) => ({
                id: item.id,
                name: item.name,
                subtitle: `${item.artists.map((a: any) => a.name).join(', ')} • ${item.album.name}`,
                imageUrl: item.album.images[0]?.url || '',
                externalUrl: item.external_urls.spotify,
                provider: 'spotify',
                category: 'music',
                rawMetadata: item,
            }));

        } catch (error) {
            console.error('Spotify Track Search Exception:', error);
            return [];
        }
    },
};
