import { RankedItem, Category } from './types';

export const universalProvider = {
    async search(query: string, context?: any): Promise<RankedItem[]> {
        const searchTerm = query || context?.subject || '';
        if (!searchTerm) return [];

        // 1. BOOKS MODE
        if (context?.intent === 'book' || /book|novel|read/i.test(context?.category || '')) {
            console.log(`Searching Google Books for: ${searchTerm}`);
            try {
                const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchTerm)}&maxResults=20`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.items) {
                        return data.items.map((book: any) => {
                            const info = book.volumeInfo;
                            const authors = info.authors ? info.authors.join(', ') : 'Unknown Author';
                            const year = info.publishedDate ? info.publishedDate.split('-')[0] : '';

                            return {
                                id: `book_${book.id}`,
                                name: info.title,
                                subtitle: `${authors} ${year ? `• ${year}` : ''}`,
                                imageUrl: info.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
                                externalUrl: info.infoLink,
                                provider: 'google_books',
                                category: 'other',
                                rawMetadata: book
                            };
                        });
                    }
                }
            } catch (error) {
                console.error("Google Books API failed", error);
            }
        }

        // 2. WIKIPEDIA (GENERAL KNOWLEDGE) MODE
        // Fallback for everything else (Types of cats, Philosophy, etc.)

        // Improve Search Term Construction
        let finalQuery = searchTerm;
        if (!query && context?.location && !searchTerm.toLowerCase().includes(context.location.toLowerCase())) {
            finalQuery = `${searchTerm} ${context.location}`;
        }

        console.log(`Searching Wikipedia for: ${finalQuery}`);
        try {
            // Use Query API with PageImages and Extracts
            // generator=search finds pages, prop=pageimages|extracts gets data for them
            // gsrnamespace=0 ensures we only get main articles (no Talk pages, etc)
            const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(finalQuery)}&gsrnamespace=0&gsrlimit=15&prop=pageimages|extracts&exintro&explaintext&exlimit=max&piprop=thumbnail&pithumbsize=400&format=json&origin=*`;

            const wikiResp = await fetch(wikiUrl);

            if (wikiResp.ok) {
                const data = await wikiResp.json();

                if (data.query && data.query.pages) {
                    const pages = Object.values(data.query.pages);

                    // Sort by index property returned by generator=search
                    const sortedPages = pages.sort((a: any, b: any) => (a.index || 0) - (b.index || 0));

                    return sortedPages
                        .filter((page: any) => {
                            // Robust Filter for Garbage/Stubs
                            const title = page.title;
                            if (title.startsWith('Template:')) return false;
                            if (title.startsWith('Category:')) return false;
                            if (title.startsWith('Portal:')) return false;
                            if (title.startsWith('Draft:')) return false;
                            if (title.startsWith('User:')) return false;
                            if (title.startsWith('Talk:')) return false;
                            if (title.startsWith('Help:')) return false;
                            if (title.startsWith('File:')) return false;
                            if (title.startsWith('MediaWiki:')) return false;

                            // Existing Logic
                            if (title.toLowerCase().includes('disambiguation')) return false;
                            if (!page.extract) return false; // Must have content
                            if (page.extract.includes('may refer to:')) return false; // Stub/Disambig page

                            return true;
                        })
                        .map((page: any) => ({
                            id: `wiki_${page.pageid}`,
                            name: page.title,
                            subtitle: page.extract ? (page.extract.slice(0, 100) + '...') : 'Wikipedia Entry',
                            imageUrl: page.thumbnail?.source || 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Wikipedia-logo-v2.svg/200px-Wikipedia-logo-v2.svg.png',
                            externalUrl: `https://en.wikipedia.org/?curid=${page.pageid}`,
                            provider: 'wikipedia' as const,
                            category: 'other',
                            rawMetadata: page
                        }));
                }
            }
        } catch (error) {
            console.error("Wikipedia API failed", error);
        }

        return [];
    },

    async getListMembers(topic: string, limit?: number): Promise<RankedItem[]> {
        if (!topic) return [];
        console.log(`[Wikipedia] Fetching list members for topic: ${topic} (limit: ${limit})`);

        try {
            // 1. Search for a Category
            // We search for "Category:<Topic>" to see if a matching qualification exists.
            const catSearchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=Category:${encodeURIComponent(topic)}&srnamespace=14&srlimit=1&format=json&origin=*`;
            const catResp = await fetch(catSearchUrl);
            if (!catResp.ok) return [];
            const catData = await catResp.json();

            const categoryTitle = catData.query?.search?.[0]?.title;

            if (!categoryTitle) {
                console.log(`[Wikipedia] No category found for: ${topic}`);
                // Fallback: Check if the query itself is a "List of..." page title?
                return [];
            }

            console.log(`[Wikipedia] Found category: ${categoryTitle}`);

            // 2. Fetch Members of the Category
            // gcmtype=page (exclude subcats/files)
            // If limit is provided, fetch a bit more to allow for filtering
            const fetchLimit = limit ? Math.min(limit * 2, 50) : 50;

            const membersUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=categorymembers&gcmtitle=${encodeURIComponent(categoryTitle)}&gcmtype=page&gcmlimit=${fetchLimit}&prop=pageimages|extracts&exintro&explaintext&exlimit=max&piprop=thumbnail&pithumbsize=200&format=json&origin=*`;

            const membersResp = await fetch(membersUrl);
            if (!membersResp.ok) return [];
            const membersData = await membersResp.json();

            if (membersData.query?.pages) {
                const members = Object.values(membersData.query.pages);

                // Filter and Map
                let items = members
                    // @ts-ignore
                    .filter((p: any) => !p.title.startsWith('List of') && !p.title.includes('disambiguation'))
                    .map((page: any) => ({
                        id: `wiki_${page.pageid}`,
                        name: page.title,
                        subtitle: page.extract ? (page.extract.slice(0, 80) + '...') : 'Wikipedia Entry',
                        imageUrl: page.thumbnail?.source || null,
                        externalUrl: `https://en.wikipedia.org/?curid=${page.pageid}`,
                        provider: 'wikipedia' as const,
                        category: 'more' as Category, // or 'other'
                        rawMetadata: page
                    }));

                // Apply strict limit if requested
                if (limit && items.length > limit) {
                    items = items.slice(0, limit);
                }

                return items;
            }
        } catch (e) {
            console.error('[Wikipedia] getListMembers failed', e);
        }

        // 3. FALLBACK: LLM GENERATION
        // If Wikipedia category search failed, ask the AI.
        // This handles "Art Exhibits that changed me" or "Best 90s hip hop albums" (if not caught by other providers)
        try {
            const { generateListFromLLM } = await import('./ai');
            const aiItems = await generateListFromLLM(topic, limit || 20);

            if (aiItems.length > 0) {
                console.log(`[Universal] LLM generated ${aiItems.length} items for "${topic}"`);

                // Hydrate items with thumbnails in parallel
                const items = aiItems.map((item, index) => ({
                    id: `ai_${Date.now()}_${index}`,
                    name: item.name,
                    subtitle: item.subtitle,
                    imageUrl: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=400&h=400&fit=crop', // Initial fallback
                    externalUrl: null,
                    provider: 'gemini' as const,
                    category: 'more' as Category,
                    rawMetadata: item,
                    rank: index + 1
                }));

                // HYDRATION: Fetch real thumbnails for each AI item
                console.log(`[Universal] Hydrating ${items.length} AI items with thumbnails...`);
                const hydratedItems = await Promise.all(
                    items.map(async (item) => {
                        const thumb = await universalProvider.fetchThumbnail(item.name, 'more');
                        if (thumb) {
                            return { ...item, imageUrl: thumb };
                        }
                        return item;
                    })
                );

                return hydratedItems;
            }
        } catch (err) {
            console.error('[Universal] LLM Fallback failed', err);
        }

        return [];
    },

    async fetchThumbnail(query: string, category?: string): Promise<string | null> {
        if (!query) return null;
        try {
            // 1. Clean the query: Remove parentheticals and extra whitespace
            let cleanedQuery = query
                .replace(/\(.*\)/g, '')
                .trim();

            const searchQueries = [cleanedQuery];

            // 2. Add category context if available for broader search
            if (category) {
                if (['restaurants', 'food', 'bars'].includes(category)) {
                    searchQueries.push(`${cleanedQuery} restaurant`);
                    searchQueries.push(`${cleanedQuery} cafe`);
                    searchQueries.push(`${cleanedQuery} San Francisco`);
                } else if (category === 'movies') {
                    searchQueries.push(`${cleanedQuery} film`);
                    searchQueries.push(`${cleanedQuery} movie`);
                } else if (category === 'books') {
                    searchQueries.push(`${cleanedQuery} book`);
                    searchQueries.push(`${cleanedQuery} novel`);
                } else if (category === 'music') {
                    searchQueries.push(`${cleanedQuery} band`);
                    searchQueries.push(`${cleanedQuery} music artist`);
                } else if (category === 'places') {
                    searchQueries.push(`${cleanedQuery} landmark`);
                    searchQueries.push(`${cleanedQuery} tourist attraction`);
                } else if (category !== 'other' && category !== 'more') {
                    searchQueries.push(`${cleanedQuery} ${category}`);
                }
            }

            // 3. ROBUST PERSON FALLBACK (TMDB)
            // Before falling back to Wikipedia, try TMDB's person API which is excellent for public figures,
            // including athletes, instructors, politicians, and media personalities.
            const tmbdApiKey = process.env.TMDB_API_KEY;
            const isPersonCategory = !category || ['more', 'other', 'music', 'movies'].includes(category);

            if (tmbdApiKey && isPersonCategory) {
                try {
                    const personResp = await fetch(
                        `https://api.themoviedb.org/3/search/person?api_key=${tmbdApiKey}&query=${encodeURIComponent(cleanedQuery)}`,
                        { next: { revalidate: 86400 } }
                    );
                    if (personResp.ok) {
                        const personData = await personResp.json();
                        const topPerson = personData.results?.[0];

                        // If we found a valid person with a profile image, use it!
                        if (topPerson && topPerson.profile_path && topPerson.popularity > 1) {
                            console.log(`[Universal] Found TMDB Person match for image: ${topPerson.name}`);
                            return `https://image.tmdb.org/t/p/w400${topPerson.profile_path}`;
                        }
                    }
                } catch (e) {
                    console.error('[Universal] TMDB Person image fallback failed:', e);
                }
            }

            // 4. Final fallback for Wikipedia search
            searchQueries.push(`${cleanedQuery} wiki`);

            for (const q of searchQueries) {
                try {
                    // Quick search for the page and its main image
                    const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrnamespace=0&gsrlimit=20&prop=pageimages|extracts&piprop=thumbnail&pithumbsize=400&format=json&origin=*`;

                    // Set a strict timeout to avoid slowing down the main list generation
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s max per query

                    const response = await fetch(url, { signal: controller.signal });
                    clearTimeout(timeoutId);

                    if (response.ok) {
                        const data = await response.json();
                        if (data.query && data.query.pages) {
                            const pages = Object.values(data.query.pages) as any[];
                            // Sort by index to maintain relevance
                            const sortedPages = pages.sort((a, b) => (a.index || 0) - (b.index || 0));

                            // Pick the BEST match
                            const bestMatch = sortedPages.find(p => {
                                const title = p.title.toLowerCase();
                                const extract = p.extract?.toLowerCase() || '';
                                const searchTerms = cleanedQuery.toLowerCase().split(' ').filter(t => t.length > 2);

                                // It MUST contain at least one significant name term in the title
                                const nameInTitle = searchTerms.some(term => title.includes(term));

                                // It's a "good" match if title matches name or it's context-rich
                                // Relaxed check: don't block based on 'logo' in the URL here, do it in isGarbage
                                const hasThumbnail = !!p.thumbnail;

                                return nameInTitle && hasThumbnail;
                            });

                            const finalChoice = bestMatch;

                            if (finalChoice && finalChoice.thumbnail) {
                                const src = finalChoice.thumbnail.source.toLowerCase();
                                // Refined garbage filter: allow names that might have 'logo' or 'official' in metadata
                                // but still block actual Wikipedia/UI logos
                                const isGarbage = src.includes('wikipedia-logo') ||
                                    src.includes('wiki-logo') ||
                                    src.includes('padlock') ||
                                    src.includes('icon_') ||
                                    src.includes('increase_') ||
                                    src.includes('symbol_') ||
                                    src.includes('question_mark') ||
                                    src.includes('mattel') ||
                                    src.includes('barbie') ||
                                    src.includes('flag_') ||
                                    src.includes('placeholder');

                                // Re-add a more specific 'logo' check if needed, but for Peloton instructors it might be okay.
                                // Ensure it's not the generic Wikipedia logo
                                if (!isGarbage && !src.includes('wikimedia-logo')) return finalChoice.thumbnail.source;
                            }
                        }
                    }
                } catch (e) {
                    // Ignore abort errors or network blips, just move to next query
                }
            }
        } catch (e) {
            console.error('[Universal] fetchThumbnail failed globally', e);
        }
        return null;
    }
};
