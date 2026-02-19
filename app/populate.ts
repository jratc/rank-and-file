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
                if (context.actor) {
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

    const maxItems = 15; // User requested 15 initially
    const itemsToInsert = items.slice(0, maxItems);
    console.log(`[Populate] Inserting ${itemsToInsert.length} items for list: ${listId}...`);

    const { data: insertedData, error: insertError } = await supabase.from('list_items').insert(
        itemsToInsert.map((item, index) => ({
            list_id: listId,
            entity_id: item.id,
            rank: index + 1,
            metadata: item
        }))
    ).select();

    if (insertError) {
        console.error('[Populate] Failed to insert items:', insertError);
        return { populated: false, count: 0, isComplete: false };
    }

    revalidatePath('/');
    const populatedItems = insertedData.length;

    // 4. PARALLEL HYDRATION (PRE-FETCH IMAGES)
    // We kick this off in the background so by the time the user clicks "See List", many images are ready.
    if (populatedItems > 0) {
        const { hydrateItemImage } = await import('./draft/actions');
        // We don't await the entire thing to avoid blocking the initial response, 
        // but it will run concurrently in the background on the server.
        Promise.allSettled(
            insertedData.map(item => hydrateItemImage(item.id, item.metadata.name, category))
        ).then(() => {
            console.log(`[Populate] Hydration complete for ${populatedItems} items.`);
        });
    }

    // 5. Check if complete
    // We only consider it "complete" if less than our initial 15 items were found.
    const isComplete = (populatedItems < 15);

    return { populated: true, count: populatedItems, items: insertedData, isComplete };
}

export async function populateBackgroundItems(listId: string, title: string, category: string, offset: number) {
    const supabase = await createClient();

    console.log(`[Populate] Background phase for: "${title}" (Offset: ${offset})`);

    // 1. Generate more items using LLM
    // SPECIAL CASE: For curated bibliographies (Books + Author), we usually have the full set already.
    // If we have an author context, we should skip generic "more items" to avoid noise.
    const intentContext = await import('@/lib/utils').then(m => m.extractContext(title, category));
    if (category === 'books' && intentContext.author) {
        console.log(`[Populate] Curated book list detected, skipping background "more-items" generation.`);
        return { count: 0, isComplete: true };
    }

    const moreItems = await generateMoreItemsFromLLM(title, offset, 38);

    if (!moreItems || moreItems.length === 0) {
        console.log(`[Populate] No more items found for "${title}"`);
        return { count: 0, isComplete: true };
    }

    // 2. Insert into database
    const { data: insertedData, error: insertError } = await supabase.from('list_items').insert(
        moreItems.map((item, index) => ({
            list_id: listId,
            entity_id: `llm-bg-${Date.now()}-${index}`,
            rank: offset + index + 1,
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
        Promise.allSettled(
            insertedData.map(item => hydrateItemImage(item.id, item.metadata.name, category))
        ).then(() => {
            console.log(`[Populate] Background hydration complete for ${insertedData.length} items.`);
        });
    }

    const totalCount = offset + insertedData.length;
    return { count: insertedData.length, isComplete: totalCount >= 50 };
}
