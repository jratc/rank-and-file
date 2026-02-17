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
                return aiItems.map((item, index) => ({
                    id: `ai_${Date.now()}_${index}`,
                    name: item.name,
                    subtitle: item.subtitle,
                    imageUrl: null, // AI doesn't give images yet, maybe we fetch them later or use a generic placeholder icon in frontend
                    externalUrl: null,
                    provider: 'gemini' as const,
                    category: 'more' as Category,
                    rawMetadata: item,
                    rank: index + 1 // Implicit rank from AI order
                }));
            }
        } catch (err) {
            console.error('[Universal] LLM Fallback failed', err);
        }

        return [];
    },

    async fetchThumbnail(query: string): Promise<string | null> {
        if (!query) return null;
        try {
            // Quick search for the page and its main image
            const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=0&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=400&format=json&origin=*`;

            // Set a strict timeout to avoid slowing down the main list generation
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5s max per image

            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                if (data.query && data.query.pages) {
                    const page = Object.values(data.query.pages)[0] as any;
                    return page.thumbnail?.source || null;
                }
            }
        } catch (e) {
            // Ignore abort errors or network blips, just return null
        }
        return null;
    }
};
