'use server'

import { createClient } from '@/lib/supabase/server';
import { extractContext } from '@/lib/utils';
import { generateSearchIntent, generateListFromLLM, generateMoreItemsFromLLM } from '@/lib/ai';
import { moviesProvider } from '@/lib/movies';
import { booksProvider } from '@/lib/books';
import { itunesProvider } from '@/lib/itunes';
import { universalProvider } from '@/lib/universal';
import { RankedItem } from '@/lib/types';
import { revalidatePath } from 'next/cache';

export async function detectAndPopulateList(listId: string, title: string, category: string) {
    const supabase = await createClient();
    let items: RankedItem[] = [];

    // 1. Validate list ownership
    const { data: listData, error: listError } = await supabase
        .from('lists')
        .select('user_id')
        .eq('id', listId)
        .single();

    if (listError || !listData) return { populated: false, count: 0, isComplete: false };

    // 2. Extract Context (Gemini First -> Heuristic Fallback)
    let context = extractContext(title, category);

    // User Request: "Always use gemini to determine user intent"
    if (process.env.GEMINI_API_KEY) {
        const llmContext = await generateSearchIntent(title, category);
        if (llmContext) {
            console.log(`[Populate] Using LLM Context:`, llmContext);
            context = {
                ...context,
                ...llmContext,
                intent: llmContext.intent || context.intent,
                subject: llmContext.subject || context.subject
            };
        }
    }

    // 2.5 CACHING: Check if a similar list already exists to reuse items
    try {
        const { data: existingList } = await supabase
            .from('lists')
            .select('id')
            .ilike('title', title)
            .neq('id', listId)
            .limit(1)
            .maybeSingle();

        if (existingList) {
            console.log(`[Populate] Cache Hit! Found existing list: ${existingList.id} for "${title}"`);
            const { data: cachedItems } = await supabase
                .from('list_items')
                .select('*')
                .eq('list_id', existingList.id);

            if (cachedItems && cachedItems.length > 0) {
                items = cachedItems.map(item => ({
                    id: `cache-${Date.now()}-${item.rank}`,
                    name: item.metadata.name,
                    subtitle: item.metadata.subtitle,
                    imageUrl: item.metadata.imageUrl,
                    externalUrl: item.metadata.externalUrl,
                    provider: item.metadata.provider || 'cache',
                    type: item.metadata.type || 'custom'
                }));
                console.log(`[Populate] Reusing ${items.length} items from cache.`);
            }
        }
    } catch (cacheError) {
        // Silently ignore cache miss
    }

    // 3. Determine Items to Populate (if not cached)
    if (items.length === 0) {
        try {
            if (context.intent === 'list' && context.subject) {
                // Use the more descriptive string between title and subject
                const generationTopic = title.length > context.subject.length ? title : context.subject;
                const llmItems = await generateListFromLLM(generationTopic, context.limit || 12);
                items = llmItems.map((item, idx) => ({
                    id: `llm-${Date.now()}-${idx}`,
                    name: item.name,
                    subtitle: item.subtitle,
                    imageUrl: null,
                    externalUrl: null,
                    provider: 'gemini',
                    type: 'custom'
                }));
            } else if (category === 'movies') {
                if (context.actor && context.director) {
                    // Hybrid mode for actor-directors like Mel Brooks
                    items = await moviesProvider.search('', context);
                } else if (context.actor) {
                    items = await moviesProvider.getActorFilmography(context.actor);
                } else if (context.director) {
                    items = await moviesProvider.getDirectorFilmography(context.director);
                } else if (context.genre) {
                    items = await moviesProvider.getMoviesByGenre(context.genre, context.limit);
                }
            } else if (category === 'books' && context.author) {
                // Use LLM for cleaner bibliographies (User Feedback: Google Books API is too noisy)
                if (process.env.GEMINI_API_KEY) {
                    try {
                        const authorBooks = await import('@/lib/ai').then(m => m.generateAuthorBibliography(context.author!));
                        if (authorBooks.length > 0) {
                            items = authorBooks.map((item, idx) => ({
                                id: `llm-book-${Date.now()}-${idx}`,
                                name: item.name,
                                subtitle: item.subtitle,
                                imageUrl: null,
                                externalUrl: null,
                                provider: 'gemini',
                                type: 'custom',
                                metadata: {
                                    year: item.year
                                }
                            }));
                        } else {
                            // Fallback if LLM fails
                            items = await booksProvider.getBooksByAuthor(context.author);
                        }
                    } catch (e) {
                        items = await booksProvider.getBooksByAuthor(context.author);
                    }
                } else {
                    items = await booksProvider.getBooksByAuthor(context.author);
                }
            } else if (category === 'music' && context.artist) {
                if (context.intent === 'song') {
                    items = await itunesProvider.getTopSongs(context.artist);
                } else {
                    items = await itunesProvider.getDiscography(context.artist);
                }
            } else if (['food', 'bars', 'restaurants', 'places', 'other', 'more'].includes(category)) {
                if (process.env.GEMINI_API_KEY) {
                    try {
                        const llmItems = await generateListFromLLM(title, context.limit || 12);
                        if (llmItems && llmItems.length > 0) {
                            items = llmItems.map((item, idx) => ({
                                id: `llm-${Date.now()}-${idx}`,
                                name: item.name,
                                subtitle: item.subtitle,
                                imageUrl: null,
                                externalUrl: null,
                                provider: 'gemini',
                                type: 'custom'
                            }));
                        }
                    } catch (e) {
                        console.error('[Populate] LLM generation failed:', e);
                    }
                }
                if (items.length === 0 && context.subject) {
                    items = await universalProvider.getListMembers(context.subject, context.limit);
                }
            }
        } catch (e) {
            console.error('[Populate] Provider error:', e);
        }
    }

    // Fail-Safe Fallback
    if (items.length === 0 && process.env.GEMINI_API_KEY && title) {
        try {
            const llmItems = await generateListFromLLM(title, context.limit || 12);
            if (llmItems.length > 0) {
                items = llmItems.map((item, idx) => ({
                    id: `llm-${Date.now()}-${idx}`,
                    name: item.name,
                    subtitle: item.subtitle,
                    imageUrl: null,
                    externalUrl: null,
                    provider: 'gemini',
                    type: 'custom'
                }));
            }
        } catch (e) {
            console.error('[Populate] LLM Fallback failed:', e);
        }
    }

    if (items.length === 0) return { populated: false, count: 0, isComplete: false };

    // 3.5 INTERNAL DEDUPLICATION (Safeguard against repetitive LLM results)
    const seenNames = new Set<string>();
    items = items.filter(item => {
        const normalized = item.name.toLowerCase().trim();
        // Check for exact name match OR similar substrings for places
        if (seenNames.has(normalized)) return false;

        // Prevent very similar names for places (e.g. "Joe's Pizza" vs "Joe's Pizza & Bar")
        if (['food', 'bars', 'restaurants', 'places'].includes(category)) {
            const isTooSimilar = Array.from(seenNames).some(seen =>
                normalized.includes(seen) || seen.includes(normalized)
            );
            if (isTooSimilar) return false;
        }

        seenNames.add(normalized);
        return true;
    });

    // 4. Determine starting rank to avoid disturbing top items
    const { data: existing } = await supabase.from('list_items').select('rank').eq('list_id', listId);
    const startRank = (existing && existing.length > 0) ? Math.max(...existing.map(e => e.rank || 0)) : 0;

    const maxItems = 15;
    const itemsToInsert = items.slice(0, maxItems);
    console.log(`[Populate] Inserting ${itemsToInsert.length} items for list: ${listId} (Start Rank: ${startRank + 1})...`);

    const { data: insertedData, error: insertError } = await supabase.from('list_items').insert(
        itemsToInsert.map((item, index) => ({
            list_id: listId,
            entity_id: item.id,
            rank: startRank + index + 1,
            metadata: item
        }))
    ).select();

    if (insertError) {
        console.error('[Populate] Failed to insert items:', insertError);
        return { populated: false, count: 0, isComplete: false };
    }

    revalidatePath('/');
    const populatedItems = insertedData.length;

    // 4. PARALLEL HYDRATION (PRE-FETCH IMAGES & PLACE DATA)
    // We kick this off in the background so by the time the user clicks "See List", many images are ready.
    if (populatedItems > 0) {
        const { hydrateItemImage } = await import('./draft/actions');
        const { searchPlaces } = await import('@/lib/places');

        // We don't await the entire thing to avoid blocking the initial response, 
        // but it will run concurrently in the background on the server.
        Promise.allSettled(
            insertedData.map(async (item) => {
                // Background hydration for images
                hydrateItemImage(item.id, item.metadata.name, category);

                // Specific enrichment for food/drink/places
                if (['food', 'bars', 'restaurants', 'places'].includes(category)) {
                    console.log(`[Populate] Enriching place data for: ${item.metadata.name}`);
                    try {
                        const places = await searchPlaces(item.metadata.name, category as any, {
                            location: context.location,
                            subject: context.subject
                        });
                        if (places && places.length > 0) {
                            const match = places[0]; // Take the first best match
                            const { data: updated, error } = await supabase
                                .from('list_items')
                                .update({
                                    metadata: {
                                        ...item.metadata,
                                        ...match,
                                        id: match.id, // Use the STABLE identifier from Google/Photon
                                        imageUrl: item.metadata.imageUrl || match.imageUrl
                                    },
                                    entity_id: match.id // Update entity_id to stable provider ID
                                })
                                .eq('id', item.id);

                            if (error) console.error(`[Populate] Failed to enrich ${item.id}:`, error);
                            else console.log(`[Populate] Enriched ${item.id} with place data.`);
                        }
                    } catch (e) {
                        console.error(`[Populate] Enrichment failed for ${item.id}:`, e);
                    }
                }
            })
        ).then(() => {
            console.log(`[Populate] Hydration/Enrichment complete for ${populatedItems} items.`);
        });
    }

    // 5. Check if complete
    // We only consider it "complete" if less than our initial 15 items were found.
    // If we inserted zero or very few items, it might be incomplete (especially for books search)
    // We only consider it "Complete" if we hit the maxItems or if we are sure there's nothing left.
    // For now, let's be more lenient and allow background population if we have < 15.
    const isComplete = (populatedItems < 5); // Only truly "complete" if we found almost nothing

    return { populated: true, count: populatedItems, items: insertedData, isComplete };
}

export async function populateBackgroundItems(listId: string, title: string, category: string, offset: number) {
    const supabase = await createClient();

    console.log(`[Populate] Background phase for: "${title}" (Offset: ${offset})`);

    // 1. Generate more items using LLM
    // SPECIAL CASE: For curated bibliographies (Books + Author), we usually have the full set already.
    // If we have an author context, we should skip generic "more items" to avoid noise.
    const intentContext = await import('@/lib/utils').then(m => m.extractContext(title, category));
    // NO SKIP: Even curated book lists should allow background population 
    // if the user wants more than the top selection or if the selection was small.
    // (Removed author skip here)

    console.log(`[Populate] Background items check for: ${title} (${category}), Offset: ${offset}`);

    // 1. Fetch existing names for deduplication
    const { data: existingItems } = await supabase
        .from('list_items')
        .select('metadata')
        .eq('list_id', listId);

    const existingNames = (existingItems || []).map(i => i.metadata.name.toLowerCase().trim());

    // 2. Generate more items using LLM
    const moreItems = await generateMoreItemsFromLLM(title, offset, 45, existingNames);

    if (!moreItems || moreItems.length === 0) {
        console.log(`[Populate] No more items found for "${title}"`);
        return { count: 0, isComplete: true };
    }

    // 3. Filter out duplicates
    const uniqueMoreItems = moreItems.filter(item => {
        const normalized = item.name.toLowerCase().trim();
        if (existingNames.includes(normalized)) {
            console.log(`[Populate] Filtering out duplicate item: ${item.name}`);
            return false;
        }
        existingNames.push(normalized);
        return true;
    });

    if (uniqueMoreItems.length === 0) {
        return { count: 0, isComplete: true };
    }

    // 4. Insert into database, ensuring we start after the actual current count
    const { data: currentItems } = await supabase.from('list_items').select('rank').eq('list_id', listId);
    const currentMaxRank = (currentItems && currentItems.length > 0) ? Math.max(...currentItems.map(c => c.rank || 0)) : offset;

    const { data: insertedData, error: insertError } = await supabase.from('list_items').insert(
        uniqueMoreItems.map((item, index) => ({
            list_id: listId,
            entity_id: `llm-bg-${Date.now()}-${index}`,
            rank: currentMaxRank + index + 1,
            metadata: {
                ...item,
                id: `llm-bg-${Date.now()}-${index}`,
                provider: 'gemini',
                type: 'custom'
            }
        }))
    ).select();

    if (insertError) {
        console.error('[Populate] Background insert error:', insertError);
        return { count: 0, isComplete: false };
    }

    console.log(`[Populate] Successfully added ${insertedData.length} background items.`);
    if (insertedData && insertedData.length > 0) {
        const { hydrateItemImage } = await import('./draft/actions');
        const { searchPlaces } = await import('@/lib/places');

        Promise.allSettled(
            insertedData.map(async (item) => {
                hydrateItemImage(item.id, item.metadata.name, category);

                if (['food', 'bars', 'restaurants', 'places'].includes(category)) {
                    try {
                        const enrichmentContext = await import('@/lib/utils').then(m => m.extractContext(title, category));
                        const places = await searchPlaces(item.metadata.name, category as any, {
                            location: enrichmentContext.location,
                            subject: enrichmentContext.subject
                        });
                        if (places && places.length > 0) {
                            const match = places[0];
                            await supabase
                                .from('list_items')
                                .update({
                                    metadata: {
                                        ...item.metadata,
                                        ...match,
                                        id: match.id,
                                        imageUrl: item.metadata.imageUrl || match.imageUrl
                                    },
                                    entity_id: match.id
                                })
                                .eq('id', item.id);
                        }
                    } catch (e) {
                        // Silent failure for background enrichment
                    }
                }
            })
        ).then(() => {
            console.log(`[Populate] Background hydration/enrichment complete for ${insertedData.length} items.`);
        });
    }

    const totalCount = offset + insertedData.length;
    return { count: insertedData.length, isComplete: totalCount >= 80 };
}
