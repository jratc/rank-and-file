'use server'

import { createClient } from '@/lib/supabase/server';
import { extractContext } from '@/lib/utils';
import { generateSearchIntent, generateListFromLLM } from '@/lib/ai';
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

    if (listError || !listData) return { populated: false, count: 0 };

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
                const llmItems = await generateListFromLLM(context.subject, context.limit || 12);
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
                items = await booksProvider.getBooksByAuthor(context.author);
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

    if (items.length === 0) return { populated: false, count: 0 };

    const maxItems = context.limit ? context.limit : 50;
    const itemsToInsert = items.slice(0, maxItems);

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
        return { populated: false, count: 0 };
    }

    revalidatePath('/');
    return { populated: true, count: insertedData.length, items: insertedData };
}
