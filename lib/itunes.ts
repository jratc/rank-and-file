import { RankedItem, SearchProvider } from './types';

export const itunesProvider = {
    async searchAlbums(query: string, context?: any): Promise<RankedItem[]> {
        // Allow empty query if we have context (pre-fetch)
        if (!query && !context?.subject && !context?.genre && !context?.artist) return [];

        try {
            const searchTerm = query || context?.subject || context?.artist || context?.genre || '';
            const intent = context?.intent || 'album';
            const limit = context?.limit || 50; // Default to 50, client can request more

            // Construct API parameters
            const params = new URLSearchParams({
                media: 'music',
                limit: String(limit),
            });

            // LOGIC FOR "NOT BY BEYONCE" (Strict Artist Mode)
            // If we have an explicit artist context and no manual query (or query matches artist), 
            // use 'attribute=artistTerm' to filter strictly by artist.
            if (context?.artist && (!query || query.toLowerCase() === context.artist.toLowerCase())) {
                params.set('term', context.artist);
                params.set('attribute', 'artistTerm');
                params.set('entity', intent === 'song' ? 'musicTrack' : 'album');
            }
            // LOGIC FOR GENRE (Weak Filter)
            // iTunes doesn't have a direct "genre" parameter for search, but usually searching the genre name works.
            // We can search for the genre term.
            else if (context?.genre && (!query || query.toLowerCase() === context.genre.toLowerCase())) {
                params.set('term', context.genre);
                // We don't verify genre ID here, just rely on relevance
                params.set('entity', intent === 'song' ? 'musicTrack' : 'album');
            }
            // STANDARD SEARCH
            else {
                let finalQuery = searchTerm;
                // For music, appending artist context is useful (e.g. "Halo" + "Beyonce" -> "Halo Beyonce")
                // But generic subject context should NOT be appended to typed queries
                if (query && context?.artist && !query.toLowerCase().includes(context.artist.toLowerCase())) {
                    finalQuery = `${query} ${context.artist}`;
                }
                // Don't append generic subject — it pollutes results

                params.set('term', finalQuery);
                params.set('entity', intent === 'song' ? 'musicTrack' : 'album');
            }

            const response = await fetch(`https://itunes.apple.com/search?${params.toString()}`, {
                cache: 'force-cache', // Cache standard searches
                next: { revalidate: 3600 }
            });

            if (!response.ok) throw new Error(`iTunes API Error: ${response.status}`);

            const data = await response.json();

            // FALLBACK: If strict artist search yields nothing, try general search
            if (data.resultCount === 0 && params.get('attribute') === 'artistTerm') {
                console.log('Strict artist search failed, falling back to general...');
                params.delete('attribute');
                const fbResponse = await fetch(`https://itunes.apple.com/search?${params.toString()}`);
                const fbData = await fbResponse.json();
                data.results = fbData.results;
            }

            // If still 0, try general
            if ((data.results?.length || 0) === 0) {
                // ... existing fallback ...
                const generalParams = new URLSearchParams({
                    term: searchTerm,
                    media: 'music',
                    limit: String(limit)
                });
                const generalResponse = await fetch(`https://itunes.apple.com/search?${generalParams.toString()}`);
                const generalData = await generalResponse.json();
                data.results = generalData.results;
            }

            // Post-filtering for Genre if context asked for it?
            // iTunes results include `primaryGenreName`. 
            // If context.genre is "Jazz", we *could* filter, but iTunes search for "Jazz" is usually good.
            // Let's filter ONLY if we have a strict genre intent and results are mixed? 
            // For now, let's trust the search rank.

            const uniqueItems = new Map<string, RankedItem>();

            (data.results || []).forEach((item: any) => {
                const id = String(item.trackId || item.collectionId);
                // Filter out if primaryGenreName doesn't match? (Too strict, "Pop/Rock" vs "Rock")

                if (!uniqueItems.has(id)) {
                    uniqueItems.set(id, {
                        id,
                        name: item.trackName || item.collectionName,
                        subtitle: item.artistName + (item.primaryGenreName ? ` • ${item.primaryGenreName}` : ''), // Show Genre in subtitle
                        imageUrl: item.artworkUrl100?.replace('100x100', '600x600'),
                        externalUrl: item.trackViewUrl || item.collectionViewUrl,
                        provider: 'itunes',
                        // If it's a song, include album name?
                        // item.collectionName
                        category: 'music',
                        rawMetadata: item,
                    });
                }
            });

            return Array.from(uniqueItems.values());

        } catch (error) {
            console.error('iTunes Search Exception:', error);
            return [];
        }
    },

    async getDiscography(artistName: string): Promise<RankedItem[]> {
        if (!artistName) return [];
        console.log(`[iTunes] Fetching discography for: ${artistName}`);

        try {
            // 1. Search for Artist to get ID and exact name
            const artistResp = await fetch(
                `https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=musicArtist&limit=1`
            );

            if (!artistResp.ok) return [];
            const artistData = await artistResp.json();
            const artist = artistData.results?.[0];

            if (!artist || !artist.artistId) {
                console.log(`[iTunes] Artist not found: ${artistName}`);
                return [];
            }

            console.log(`[iTunes] Found artist: ${artist.artistName} (${artist.artistId})`);

            // 2. Lookup Albums by Artist ID
            // entity=album, attribute=artistTerm is not needed when using lookup by amgArtistId or id
            // We use 'lookup' endpoint with 'id'
            const lookupResp = await fetch(
                `https://itunes.apple.com/lookup?id=${artist.artistId}&entity=album&limit=50&sort=recent`
            );

            if (!lookupResp.ok) return [];
            const lookupData = await lookupResp.json();

            // Results[0] is the artist, subsequent are albums
            const albums = (lookupData.results || [])
                .filter((item: any) => item.wrapperType === 'collection')
                .filter((item: any) => {
                    const name = item.collectionName || '';
                    // Exclude Singles and EPs
                    if (name.includes(' - Single') || name.includes(' - EP')) return false;
                    // Some singles don't have the suffix but might optionally have collectionType 'Single' if provided?
                    // iTunes `lookup` with entity=album usually returns albums, but sometimes EPs.
                    // We can also check track count? usually < 4-6 is EP/Single.
                    if (item.trackCount && item.trackCount < 5) return false;
                    return true;
                });

            // Deduplicate (iTunes sometimes sends duplicates / deluxe versions)
            const uniqueAlbums = new Map<string, RankedItem>();

            albums.forEach((album: any) => {
                // Key by name to de-dupe "Deluxe" vs regular if names are very similar? 
                // For now, simple ID deduping (which iTunes might duplicate anyway)
                // Let's filter out "Clean" versions if "Explicit" exists? unique logic is hard.
                // Let's just use collectionId.
                const year = album.releaseDate ? album.releaseDate.split('-')[0] : '';

                if (!uniqueAlbums.has(album.collectionId)) {
                    uniqueAlbums.set(album.collectionId, {
                        id: String(album.collectionId),
                        name: album.collectionName,
                        subtitle: `${year} • ${album.primaryGenreName}`,
                        imageUrl: album.artworkUrl100?.replace('100x100', '600x600'),
                        externalUrl: album.collectionViewUrl,
                        provider: 'itunes',
                        category: 'music',
                        rawMetadata: album
                    });
                }
            });

            return Array.from(uniqueAlbums.values())
                .sort((a, b) => b.rawMetadata.releaseDate?.localeCompare(a.rawMetadata.releaseDate)); // Sort by date desc

        } catch (error) {
            console.error('[iTunes] getDiscography failed:', error);
            return [];
        }
    },

    async getTopSongs(artistName: string): Promise<RankedItem[]> {
        if (!artistName) return [];
        console.log(`[iTunes] Fetching top songs for: ${artistName}`);

        try {
            // 1. Search for Artist to get ID
            const artistResp = await fetch(
                `https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=musicArtist&limit=1`
            );

            if (!artistResp.ok) return [];
            const artistData = await artistResp.json();
            const artist = artistData.results?.[0];

            if (!artist || !artist.artistId) {
                console.log(`[iTunes] Artist not found: ${artistName}`);
                return [];
            }

            // 2. Lookup Top Songs by Artist ID
            // "entity=song" returns tracks. Limiting to 25 to be graceful.
            const lookupResp = await fetch(
                `https://itunes.apple.com/lookup?id=${artist.artistId}&entity=song&limit=25`
            );

            if (!lookupResp.ok) return [];
            const lookupData = await lookupResp.json();

            // Results[0] is the artist, subsequent are songs
            const songs = (lookupData.results || [])
                .filter((item: any) => item.wrapperType === 'track' && item.kind === 'song');

            return songs.map((song: any) => ({
                id: String(song.trackId),
                name: song.trackName,
                subtitle: `${song.collectionName || ''} • ${song.artistName}`,
                imageUrl: song.artworkUrl100?.replace('100x100', '600x600'),
                externalUrl: song.trackViewUrl,
                provider: 'itunes',
                category: 'music',
                rawMetadata: song
            }));

        } catch (error) {
            console.error('[iTunes] getTopSongs failed:', error);
            return [];
        }
    }
};
