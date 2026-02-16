import { RankedItem, Category } from './types';

export const moviesProvider = {
    async search(query: string, context?: any): Promise<RankedItem[]> {
        if (!query && !context?.subject && !context?.actor && !context?.director) return [];

        const apiKey = process.env.TMDB_API_KEY;

        // Calculate page number from offset if provided, default to 1
        let page = 1;
        if (context?.offset) {
            page = Math.floor(context.offset / 20) + 1;
        }

        if (apiKey) {
            try {
                // -----------------------------------------------------------
                // ACTOR SEARCH MODE (e.g. "Movies with Bill Murray")
                // -----------------------------------------------------------
                if (context?.actor && (!query || query.trim() === '')) {
                    console.log(`[TMDB] Actor search mode: ${context.actor}`);
                    const personResp = await fetch(
                        `https://api.themoviedb.org/3/search/person?api_key=${apiKey}&query=${encodeURIComponent(context.actor)}`,
                        { next: { revalidate: 86400 } }
                    );

                    if (personResp.ok) {
                        const personData = await personResp.json();
                        const personId = personData.results?.[0]?.id;

                        if (personId) {
                            console.log(`[TMDB] Found person ID: ${personId}, fetching filmography...`);
                            const discoverResp = await fetch(
                                `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_cast=${personId}&sort_by=popularity.desc&page=${page}`,
                                { next: { revalidate: 3600 } }
                            );

                            if (discoverResp.ok) {
                                const discoverData = await discoverResp.json();
                                if (discoverData.results?.length > 0) {
                                    return discoverData.results.map((movie: any) => mapTmdbMovie(movie));
                                }
                            }
                        }
                    }
                    // If actor search fails, fall through to regular search
                }

                // -----------------------------------------------------------
                // DIRECTOR SEARCH MODE (e.g. "Films by Wes Anderson")
                // -----------------------------------------------------------
                if (context?.director && (!query || query.trim() === '')) {
                    console.log(`[TMDB] Director search mode: ${context.director}`);
                    const personResp = await fetch(
                        `https://api.themoviedb.org/3/search/person?api_key=${apiKey}&query=${encodeURIComponent(context.director)}`,
                        { next: { revalidate: 86400 } }
                    );

                    if (personResp.ok) {
                        const personData = await personResp.json();
                        const personId = personData.results?.[0]?.id;

                        if (personId) {
                            console.log(`[TMDB] Found person ID: ${personId}, fetching filmography...`);
                            const discoverResp = await fetch(
                                `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_people=${personId}&sort_by=popularity.desc&page=${page}`,
                                { next: { revalidate: 3600 } }
                            );

                            if (discoverResp.ok) {
                                const discoverData = await discoverResp.json();
                                if (discoverData.results?.length > 0) {
                                    return discoverData.results.map((movie: any) => mapTmdbMovie(movie));
                                }
                            }
                        }
                    }
                }

                // -----------------------------------------------------------
                // GENRE CONTEXT (e.g. "80s Movies", "Sci-Fi Movies")
                // When no query typed, use discover with genre filter
                // -----------------------------------------------------------
                if (!query && context?.genre && !context?.actor && !context?.director) {
                    console.log(`[TMDB] Genre pre-fetch: ${context.genre}`);
                    // Map common genre names to TMDB genre IDs
                    const genreMap: Record<string, number> = {
                        'action': 28, 'adventure': 12, 'animation': 16, 'comedy': 35,
                        'crime': 80, 'documentary': 99, 'drama': 18, 'family': 10751,
                        'fantasy': 14, 'history': 36, 'horror': 27, 'music': 10402,
                        'mystery': 9648, 'romance': 10749, 'sci-fi': 878, 'science fiction': 878,
                        'thriller': 53, 'war': 10752, 'western': 37,
                    };
                    const genreId = genreMap[context.genre.toLowerCase()];
                    if (genreId) {
                        const discoverResp = await fetch(
                            `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=${genreId}&sort_by=popularity.desc&page=${page}`,
                            { next: { revalidate: 3600 } }
                        );
                        if (discoverResp.ok) {
                            const data = await discoverResp.json();
                            if (data.results?.length > 0) {
                                return data.results.map((movie: any) => mapTmdbMovie(movie));
                            }
                        }
                    }
                }

                // -----------------------------------------------------------
                // STANDARD SEARCH (user typed something)
                // CRITICAL: Do NOT append context.subject to the query!
                // If user types "Caddyshack", search for "Caddyshack" exactly.
                // Context should inform pre-fetch, not pollute typed queries.
                // -----------------------------------------------------------
                const searchTerm = query || context?.subject || '';
                if (!searchTerm) return [];

                // For typed queries, use the query as-is
                // For pre-fetch (empty query), use context.subject
                let finalQuery = searchTerm;

                console.log(`[TMDB] Standard search: "${finalQuery}"`);

                // No language restriction — allows foreign-language films to appear
                const response = await fetch(
                    `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(finalQuery)}&page=${page}&include_adult=false`,
                    { next: { revalidate: 3600 } }
                );

                let textResults: any[] = [];
                if (response.ok) {
                    const data = await response.json();
                    textResults = data.results || [];
                }

                // -----------------------------------------------------------
                // DIRECTOR/ACTOR CONTEXT BOOST
                // When user types a query inside a director/actor-context list,
                // also search the person's filmography and merge results.
                // This catches foreign-language films that text search misses.
                // -----------------------------------------------------------
                if (query && (context?.director || context?.actor)) {
                    const personName = context?.director || context?.actor;
                    try {
                        const personResp = await fetch(
                            `https://api.themoviedb.org/3/search/person?api_key=${apiKey}&query=${encodeURIComponent(personName)}`,
                            { next: { revalidate: 86400 } }
                        );
                        if (personResp.ok) {
                            const personData = await personResp.json();
                            const personId = personData.results?.[0]?.id;
                            if (personId) {
                                const discoverParam = context?.director ? 'with_people' : 'with_cast';
                                const discoverResp = await fetch(
                                    `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&${discoverParam}=${personId}&sort_by=popularity.desc&page=1`,
                                    { next: { revalidate: 3600 } }
                                );
                                if (discoverResp.ok) {
                                    const discoverData = await discoverResp.json();
                                    const personMovies = (discoverData.results || []).filter((m: any) =>
                                        m.title?.toLowerCase().includes(query.toLowerCase()) ||
                                        m.original_title?.toLowerCase().includes(query.toLowerCase())
                                    );
                                    // Merge: person-context matches go first, then text results (deduplicated)
                                    const personIds = new Set(personMovies.map((m: any) => m.id));
                                    const dedupedText = textResults.filter((m: any) => !personIds.has(m.id));
                                    textResults = [...personMovies, ...dedupedText];
                                }
                            }
                        }
                    } catch (e) {
                        console.error('[TMDB] Person context boost failed:', e);
                    }
                }

                if (textResults.length > 0) {
                    return textResults.map((movie: any) => mapTmdbMovie(movie));
                }
            } catch (error) {
                console.error('TMDB search failed, falling back to mock', error);
            }
        }

        // Mock Fallback (only on first page or error)
        if (page > 1) return [];

        console.log(`Searching mock movie fallback for: ${query}`);
        const mockResults: RankedItem[] = [
            {
                id: `movie_${(query || 'unknown').replace(/\s+/g, '_')}_1`,
                name: `${query || 'Movie'}`,
                subtitle: '2024 • Global Release',
                imageUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&h=600&fit=crop',
                externalUrl: 'https://www.themoviedb.org',
                provider: 'tmdb',
                category: 'movies',
                metadata: { release_date: '2024-01-01', vote_average: 8.5 }
            }
        ];

        return mockResults;
    },

    async getDirectorFilmography(directorName: string): Promise<RankedItem[]> {
        const apiKey = process.env.TMDB_API_KEY;
        if (!apiKey || !directorName) return [];

        try {
            // 1. Search for Person
            const personResp = await fetch(
                `https://api.themoviedb.org/3/search/person?api_key=${apiKey}&query=${encodeURIComponent(directorName)}`,
                { next: { revalidate: 86400 } }
            );

            if (!personResp.ok) return [];
            const personData = await personResp.json();
            const personId = personData.results?.[0]?.id;

            if (!personId) return [];

            console.log(`[TMDB] Fetching filmography for director: ${directorName} (ID: ${personId})`);

            // 2. Get Movie Credits
            const creditsResp = await fetch(
                `https://api.themoviedb.org/3/person/${personId}/movie_credits?api_key=${apiKey}`,
                { next: { revalidate: 86400 } }
            );

            if (!creditsResp.ok) return [];
            const creditsData = await creditsResp.json();

            // 3. Filter for Director job and Sort by Popularity
            const directedMovies = (creditsData.crew || [])
                .filter((c: any) => c.job === 'Director')
                // Deduplicate by ID
                .filter((v: any, i: number, a: any[]) => a.findIndex((t: any) => t.id === v.id) === i)
                .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0));

            return directedMovies.map((movie: any) => mapTmdbMovie(movie));

        } catch (error) {
            console.error('[TMDB] getDirectorFilmography failed:', error);
            return [];
        }
    },

    async getActorFilmography(actorName: string): Promise<RankedItem[]> {
        const apiKey = process.env.TMDB_API_KEY;
        if (!apiKey || !actorName) return [];

        try {
            // 1. Search for Person
            const personResp = await fetch(
                `https://api.themoviedb.org/3/search/person?api_key=${apiKey}&query=${encodeURIComponent(actorName)}`,
                { next: { revalidate: 86400 } }
            );

            if (!personResp.ok) return [];
            const personData = await personResp.json();
            const personId = personData.results?.[0]?.id;

            if (!personId) return [];

            console.log(`[TMDB] Fetching filmography for actor: ${actorName} (ID: ${personId})`);

            // 2. Get Movie Credits
            // We use /movie_credits to get all cast appearances
            const creditsResp = await fetch(
                `https://api.themoviedb.org/3/person/${personId}/movie_credits?api_key=${apiKey}`,
                { next: { revalidate: 86400 } }
            );

            if (!creditsResp.ok) return [];
            const creditsData = await creditsResp.json();

            // 3. Filter and Sort by Popularity
            const actedMovies = (creditsData.cast || [])
                // Deduplicate by ID
                .filter((v: any, i: number, a: any[]) => a.findIndex((t: any) => t.id === v.id) === i)
                // Filter out unreleased or very minor roles? 
                // Using vote_count is safer than popularity for "classic" status, but popularity works well too.
                // Let's use vote_count to prioritize "classics" (The Godfather) over recent obscure cameos.
                .sort((a: any, b: any) => (b.vote_count || 0) - (a.vote_count || 0));

            return actedMovies.map((movie: any) => mapTmdbMovie(movie));

        } catch (error) {
            console.error('[TMDB] getActorFilmography failed:', error);
            return [];
        }
    },

    async getMoviesByGenre(genre: string, limit: number = 20): Promise<RankedItem[]> {
        const apiKey = process.env.TMDB_API_KEY;
        if (!apiKey || !genre) return [];

        const genreMap: Record<string, number> = {
            'action': 28, 'adventure': 12, 'animation': 16, 'comedy': 35,
            'crime': 80, 'documentary': 99, 'drama': 18, 'family': 10751,
            'fantasy': 14, 'history': 36, 'horror': 27, 'music': 10402,
            'mystery': 9648, 'romance': 10749, 'sci-fi': 878, 'science fiction': 878,
            'thriller': 53, 'war': 10752, 'western': 37,
        };
        const genreId = genreMap[genre.toLowerCase()];
        if (!genreId) {
            console.log(`[TMDB] Unknown genre: ${genre}`);
            // Attempt to search for genre keyword? nah, explicit map is better.
            return [];
        }

        console.log(`[TMDB] Fetching random selection of popular ${genre} movies (ID: ${genreId})...`);

        try {
            // To avoid "normative feedback loop", we fetch a larger pool of "top" movies and sample randomly.
            // Fetch top 3 pages (60 items)
            const pages = [1, 2, 3];
            const promises = pages.map(page =>
                fetch(
                    `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=${genreId}&sort_by=vote_count.desc&page=${page}&include_adult=false`,
                    { next: { revalidate: 3600 } }
                ).then(res => res.ok ? res.json() : null)
            );

            const results = await Promise.all(promises);
            let pool: any[] = [];
            results.forEach(data => {
                if (data && data.results) {
                    pool = [...pool, ...data.results];
                }
            });

            // Deduplicate (just in case)
            pool = pool.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

            // Shuffle the pool
            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
            }

            // Slice to limit
            const selected = pool.slice(0, limit);

            return selected.map((movie: any) => mapTmdbMovie(movie));

        } catch (error) {
            console.error('[TMDB] getMoviesByGenre failed:', error);
            return [];
        }
    }
};

// Genre ID to name mapping (TMDB standard)
const TMDB_GENRES: Record<number, string> = {
    28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
    80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
    14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
    9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi', 10770: 'TV Movie',
    53: 'Thriller', 10752: 'War', 37: 'Western',
};

function mapTmdbMovie(movie: any): RankedItem {
    // Map genre IDs to names
    const genres = (movie.genre_ids || [])
        .map((id: number) => TMDB_GENRES[id])
        .filter(Boolean);

    const year = movie.release_date ? movie.release_date.split('-')[0] : 'Unknown Year';

    // Build a rich subtitle: "2024 · Action, Comedy · EN"
    const subtitleParts = [year];
    if (genres.length > 0) subtitleParts.push(genres.slice(0, 2).join(', '));
    if (movie.original_language) subtitleParts.push(movie.original_language.toUpperCase());

    return {
        id: `movie_${movie.id}`,
        name: movie.title,
        subtitle: subtitleParts.join(' · '),
        imageUrl: movie.poster_path ? `https://image.tmdb.org/t/p/w200${movie.poster_path}` : null,
        externalUrl: `https://www.themoviedb.org/movie/${movie.id}`,
        provider: 'tmdb',
        category: 'movies',
        metadata: {
            tmdb_id: movie.id,
            title: movie.title,
            original_title: movie.original_title,
            release_date: movie.release_date || null,
            year,
            genres,
            genre_ids: movie.genre_ids || [],
            original_language: movie.original_language || null,
            overview: movie.overview || null,
            vote_average: movie.vote_average || null,
            vote_count: movie.vote_count || null,
            popularity: movie.popularity || null,
            poster_path: movie.poster_path || null,
            backdrop_path: movie.backdrop_path || null,
            adult: movie.adult || false,
        }
    };
}

// Fetch full movie details (cast, crew, runtime, country, etc.) on demand
export async function fetchMovieDetails(tmdbId: number): Promise<any | null> {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) return null;

    try {
        const resp = await fetch(
            `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}&append_to_response=credits&language=en-US`,
            { next: { revalidate: 86400 } }
        );
        if (!resp.ok) return null;
        const data = await resp.json();

        // Extract top cast and crew
        const cast = (data.credits?.cast || []).slice(0, 10).map((c: any) => ({
            name: c.name,
            character: c.character,
            profile_path: c.profile_path,
        }));
        const directors = (data.credits?.crew || [])
            .filter((c: any) => c.job === 'Director')
            .map((c: any) => c.name);
        const writers = (data.credits?.crew || [])
            .filter((c: any) => c.job === 'Writer' || c.job === 'Screenplay')
            .map((c: any) => c.name);

        return {
            runtime: data.runtime || null,
            budget: data.budget || null,
            revenue: data.revenue || null,
            tagline: data.tagline || null,
            production_countries: (data.production_countries || []).map((c: any) => c.name),
            spoken_languages: (data.spoken_languages || []).map((l: any) => l.english_name || l.name),
            genres: (data.genres || []).map((g: any) => g.name),
            cast,
            directors,
            writers,
            imdb_id: data.imdb_id || null,
        };
    } catch (error) {
        console.error('[TMDB] Failed to fetch movie details:', error);
        return null;
    }
}
