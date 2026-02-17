
import { RankedItem } from './types';

export const booksProvider = {
    async search(query: string, context?: any): Promise<RankedItem[]> {
        const searchTerm = query || context?.subject || '';

        // Construct query with author if available in context
        let finalQuery = searchTerm;
        if (context?.author && !searchTerm.toLowerCase().includes(context.author.toLowerCase())) {
            finalQuery = `${searchTerm} inauthor:${context.author}`;
        }

        console.log(`Searching Google Books for: ${finalQuery}`);

        // Detect specific "Books by [Author]" intent
        const authorMatch = finalQuery.match(/^(?:books|works)\s+by\s+(.+)$/i);
        if (authorMatch && authorMatch[1]) {
            const authorName = authorMatch[1].trim();
            const lowerAuthorName = authorName.toLowerCase();
            console.log(`[GoogleBooks] Detected author search for: ${authorName}`);

            // HYBRID STRATEGY:
            // 1. Try strict `inauthor:"Name"` to get exact matches (high precision)
            // 2. Try natural query (no quotes) for fuzzy matching (high recall, handles typos)
            // 3. Merge results, deduplicate by ID, and sort by ratingsCount

            try {
                // Fetch more results to allow for heavy filtering
                const maxResults = 40;
                const [strictRes, fuzzyRes] = await Promise.all([
                    fetch(`https://www.googleapis.com/books/v1/volumes?q=inauthor:"${encodeURIComponent(authorName)}"&maxResults=${maxResults}&printType=books&orderBy=relevance`),
                    fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(finalQuery)}&maxResults=${maxResults}&printType=books&orderBy=relevance`)
                ]);

                const [strictData, fuzzyData] = await Promise.all([
                    strictRes.ok ? strictRes.json() : { items: [] },
                    fuzzyRes.ok ? fuzzyRes.json() : { items: [] }
                ]);

                const rawItems = [
                    ...(strictData.items || []),
                    ...(fuzzyData.items || [])
                ];

                if (rawItems.length > 0) {
                    // DEDUPLICATION LOGIC
                    // Group by Normalized Title -> Keep Earliest Year
                    const uniqueBooks = new Map<string, any>();

                    for (const book of rawItems) {
                        const info = book.volumeInfo;
                        if (!info.title) continue;

                        // Normalize: lowercase, remove subtitles/parentheses for grouping? 
                        // Actually, books often have "Title: A Novel" or "Title (Penguin Classics)".
                        // We should try to strip those for comparison.
                        // Regex to remove ": A Novel", " (Classic...)", etc. could be risky but helpful.
                        // Let's stick to strict title lowercased for safety first, but maybe strip content in parens.
                        let normalizedTitle = info.title.toLowerCase().trim();

                        // Heuristic: Remove common suffixes for better grouping
                        normalizedTitle = normalizedTitle.replace(/: a novel$/i, '');
                        normalizedTitle = normalizedTitle.replace(/\([^)]+\)$/, '').trim(); // Remove trailing (Content)

                        const existing = uniqueBooks.get(normalizedTitle);

                        if (!existing) {
                            uniqueBooks.set(normalizedTitle, book);
                        } else {
                            // Compare Years: We want the EARLIEST (True Original)
                            const currentYear = parseInt(info.publishedDate?.substring(0, 4) || '9999');
                            const existingYear = parseInt(existing.volumeInfo.publishedDate?.substring(0, 4) || '9999');

                            if (currentYear < existingYear) {
                                uniqueBooks.set(normalizedTitle, book);
                            }
                            // If years are equal, prefer the one with higher ratingsCount (Popularity)
                            else if (currentYear === existingYear) {
                                const currentVotes = info.ratingsCount || 0;
                                const existingVotes = existing.volumeInfo.ratingsCount || 0;
                                if (currentVotes > existingVotes) {
                                    uniqueBooks.set(normalizedTitle, book);
                                }
                            }
                        }
                    }

                    const uniqueItems = Array.from(uniqueBooks.values());

                    // Map to RankedItem
                    let items = uniqueItems.map((book: any) => {
                        const info = book.volumeInfo;
                        const authors = info.authors ? info.authors.join(', ') : 'Unknown Author';
                        const year = info.publishedDate ? info.publishedDate.split('-')[0] : '';
                        const categories = info.categories ? info.categories.join(', ') : '';

                        return {
                            id: `book_${book.id}`,
                            name: info.title,
                            subtitle: `${authors} ${year ? `• ${year}` : ''}`,
                            imageUrl: info.imageLinks?.thumbnail?.replace('http:', 'https:') || 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=400&h=600&fit=crop', // Fallback
                            externalUrl: info.infoLink,
                            provider: 'google_books' as const,
                            category: 'books' as const,
                            rawMetadata: book,
                            author: authors,
                            year: year,
                            genre: categories,
                            ratingsCount: info.ratingsCount || 0,
                            description: info.description || ''
                        };
                    });

                    // BIBLIOGRAPHY FILTERING HEURISTICS
                    // 1. Filter out books where Title contains Author Name (Likely Biography/Interview/Analysis)
                    //    Exception: Self-titled books (rare, handled by length check below potentially, or just acceptable collateral)
                    // 2. Filter out keywords: "biography", "conversations", "interview", "collected", "reader", "anthology"
                    // 3. Ensure Author is the FIRST author listed (if multiple)

                    const filteredItems = items.filter((item: any) => {
                        const titleLower = item.name.toLowerCase();
                        const authorsLower = item.author.toLowerCase();

                        // Rule 0: Must actually have the author we're looking for (fuzzy match check)
                        // If strict search failed and fuzzy search returned random stuff, we need to be careful.
                        // We check if the AUTHOR field contains our target name.
                        // Split authorName into parts to be lenient (e.g. "Phillip Roth" -> "Roth")
                        const authorNameParts = lowerAuthorName.split(' ').filter((p: any) => p.length > 2);
                        const hasAuthorMatch = authorNameParts.some((part: any) => authorsLower.includes(part));

                        if (!hasAuthorMatch) return false;

                        // Rule 1: Title should NOT contain the full author name
                        // e.g. "Graham Greene: The Last Interview" -> Reject
                        // e.g. "The Portable Graham Greene" -> Reject
                        // But: "Greene on Capri" -> "Greene" might be in title. 
                        // Let's stick to full name match or First+Last.
                        if (titleLower.includes(lowerAuthorName)) {
                            // HEURISTIC: If title IS exactly the author name, it's a biography.
                            // If title contains author name, it's likely a bio or critical analysis.
                            return false;
                        }

                        // Rule 2: Exclude Collections/Interviews/Biographies via keywords
                        const badKeywords = [
                            'biography', 'autobiography', 'memoir', 'conversations with', 'interviews',
                            'collected plays', 'collected stories', 'collected essays', 'reader',
                            'selected works', 'portable', 'anthology', 'critical essays', 'interpretation',
                            'companion to', 'guide to', 'works of', 'letters of'
                        ];

                        if (badKeywords.some(kw => titleLower.includes(kw) || item.subtitle.toLowerCase().includes(kw))) {
                            return false;
                        }

                        // Rule 3: Category filtering (if available)
                        // Google Books categories are often "Literary Criticism", "Biography & Autobiography"
                        if (item.genre) {
                            const genreLower = item.genre.toLowerCase();
                            if (genreLower.includes('literary criticism')) return false;
                            // We might allow "Biography" if it's an autobiography, but we excluded those above.
                            // Generally valid novels are "Fiction".
                        }

                        return true;
                    });

                    // SORT BY POPULARITY (Ratings Count)
                    // Bubbles "The Power and the Glory" to the top.
                    filteredItems.sort((a: any, b: any) => b.ratingsCount - a.ratingsCount);

                    return filteredItems;
                }
            } catch (error) {
                console.error("Google Books Author Search failed", error);
            }
            return [];
        }

        if (!finalQuery) return [];

        try {
            const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(finalQuery)}&maxResults=20&printType=books`);
            if (response.ok) {
                const data = await response.json();
                if (data.items) {
                    const rawItems = data.items;
                    // DEDUPLICATION LOGIC (Standard Search)
                    const uniqueBooks = new Map<string, any>();

                    for (const book of rawItems) {
                        const info = book.volumeInfo;
                        if (!info.title) continue;

                        let normalizedTitle = info.title.toLowerCase().trim();
                        normalizedTitle = normalizedTitle.replace(/: a novel$/i, '');
                        normalizedTitle = normalizedTitle.replace(/\([^)]+\)$/, '').trim();

                        const existing = uniqueBooks.get(normalizedTitle);

                        if (!existing) {
                            uniqueBooks.set(normalizedTitle, book);
                        } else {
                            const currentYear = parseInt(info.publishedDate?.substring(0, 4) || '9999');
                            const existingYear = parseInt(existing.volumeInfo.publishedDate?.substring(0, 4) || '9999');

                            if (currentYear < existingYear) {
                                uniqueBooks.set(normalizedTitle, book);
                            }
                            else if (currentYear === existingYear) {
                                const currentVotes = info.ratingsCount || 0;
                                const existingVotes = existing.volumeInfo.ratingsCount || 0;
                                if (currentVotes > existingVotes) {
                                    uniqueBooks.set(normalizedTitle, book);
                                }
                            }
                        }
                    }

                    return Array.from(uniqueBooks.values()).map((book: any) => {
                        const info = book.volumeInfo;
                        const authors = info.authors ? info.authors.join(', ') : 'Unknown Author';
                        const year = info.publishedDate ? info.publishedDate.split('-')[0] : '';
                        const categories = info.categories ? info.categories.join(', ') : '';

                        return {
                            id: `book_${book.id}`,
                            name: info.title,
                            subtitle: `${authors} ${year ? `• ${year}` : ''}`,
                            imageUrl: info.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
                            externalUrl: info.infoLink,
                            provider: 'google_books' as const,
                            category: 'books' as const,
                            rawMetadata: book,
                            // Extra fields for rich context as requested
                            author: authors,
                            year: year,
                            genre: categories
                        };
                    });
                }
            }
        } catch (error) {
            console.error("Google Books API failed", error);
        }
        return [];
    },

    async getBooksByAuthor(author: string): Promise<RankedItem[]> {
        console.log(`[GoogleBooks] Fetching books for author: ${author}`);
        const authorName = author.trim();
        const lowerAuthorName = authorName.toLowerCase();

        // HYBRID STRATEGY (Copied from search to ensure consistency)
        try {
            const maxResults = 40;
            // 1. Strict search
            const strictRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=inauthor:"${encodeURIComponent(authorName)}"&maxResults=${maxResults}&printType=books&orderBy=relevance`);
            // 2. Fuzzy search (just name) - might fetch biographies etc, but we filter them
            const fuzzyRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(authorName)}&maxResults=${maxResults}&printType=books&orderBy=relevance`);

            const [strictData, fuzzyData] = await Promise.all([
                strictRes.ok ? strictRes.json() : { items: [] },
                fuzzyRes.ok ? fuzzyRes.json() : { items: [] }
            ]);

            const rawItems = [
                ...(strictData.items || []),
                ...(fuzzyData.items || [])
            ];

            if (rawItems.length > 0) {
                // DEDUPLICATION LOGIC (Matches search)
                const uniqueBooks = new Map<string, any>();

                for (const book of rawItems) {
                    const info = book.volumeInfo;
                    if (!info.title) continue;

                    let normalizedTitle = info.title.toLowerCase().trim();
                    normalizedTitle = normalizedTitle.replace(/: a novel$/i, '');
                    normalizedTitle = normalizedTitle.replace(/\([^)]+\)$/, '').trim();

                    const existing = uniqueBooks.get(normalizedTitle);

                    if (!existing) {
                        uniqueBooks.set(normalizedTitle, book);
                    } else {
                        const currentYear = parseInt(info.publishedDate?.substring(0, 4) || '9999');
                        const existingYear = parseInt(existing.volumeInfo.publishedDate?.substring(0, 4) || '9999');

                        if (currentYear < existingYear) {
                            uniqueBooks.set(normalizedTitle, book);
                        }
                        else if (currentYear === existingYear) {
                            const currentVotes = info.ratingsCount || 0;
                            const existingVotes = existing.volumeInfo.ratingsCount || 0;
                            if (currentVotes > existingVotes) {
                                uniqueBooks.set(normalizedTitle, book);
                            }
                        }
                    }
                }

                const uniqueItems = Array.from(uniqueBooks.values());

                let items = uniqueItems.map((book: any) => {
                    const info = book.volumeInfo;
                    const authors = info.authors ? info.authors.join(', ') : 'Unknown Author';
                    const year = info.publishedDate ? info.publishedDate.split('-')[0] : '';
                    const categories = info.categories ? info.categories.join(', ') : '';

                    return {
                        id: `book_${book.id}`,
                        name: info.title,
                        subtitle: `${authors} ${year ? `• ${year}` : ''}`,
                        imageUrl: info.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
                        externalUrl: info.infoLink,
                        provider: 'google_books' as const,
                        category: 'books' as const,
                        rawMetadata: book,
                        author: authors,
                        year: year,
                        genre: categories,
                        ratingsCount: info.ratingsCount || 0,
                        description: info.description || ''
                    };
                });

                // BIBLIOGRAPHY FILTERING
                const filteredItems = items.filter((item: any) => {
                    const titleLower = item.name.toLowerCase();
                    const authorsLower = item.author.toLowerCase();

                    // Rule 0: Must actually have the author we're looking for
                    const authorNameParts = lowerAuthorName.split(' ').filter((p: any) => p.length > 2);
                    const hasAuthorMatch = authorNameParts.some((part: any) => authorsLower.includes(part));

                    if (!hasAuthorMatch) return false;

                    // Rule 1: Title should NOT contain the full author name (Bio check)
                    // Unless it is a very short title which might be "Greene on Capri" type thing?
                    // Let's be strict for populating a "Best of" list.
                    if (titleLower.includes(lowerAuthorName)) return false;

                    // Rule 2: Exclude keywords
                    const badKeywords = [
                        'biography', 'autobiography', 'memoir', 'conversations with', 'interviews',
                        'collected plays', 'collected stories', 'collected essays', 'reader',
                        'selected works', 'portable', 'anthology', 'critical essays', 'interpretation',
                        'companion to', 'guide to', 'works of', 'letters of'
                    ];

                    if (badKeywords.some(kw => titleLower.includes(kw) || item.subtitle.toLowerCase().includes(kw))) {
                        return false;
                    }

                    if (item.genre) {
                        const genreLower = item.genre.toLowerCase();
                        if (genreLower.includes('literary criticism')) return false;
                    }

                    return true;
                });

                // SORT BY POPULARITY
                filteredItems.sort((a: any, b: any) => b.ratingsCount - a.ratingsCount);

                return filteredItems;
            }
        } catch (error) {
            console.error("Google Books Author Search failed", error);
        }
        return [];
    }
};
