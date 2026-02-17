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
            // Completely override heuristic with LLM context (Gemini First)
            // We keep location from heuristic if LLM didn't return it, just in case, but trust LLM for subject/intent
            context = {
                ...context,
                ...llmContext,
                // Ensure we don't leverage heuristic intent if LLM provided one
                intent: llmContext.intent || context.intent,
                subject: llmContext.subject || context.subject
            };
        }
    }

    // 3. Determine Items to Populate
    let items: RankedItem[] = [];

    try {
        if (category === 'movies') {
            // Priority: Actor -> Director -> Genre
            // LLM can detect "Sean Penn" as actor even if we didn't (though our regex fix helps)
            if (context.actor) {
                console.log(`[Populate] Detected actor intent for: ${context.actor}`);
                items = await moviesProvider.getActorFilmography(context.actor);
            } else if (context.director) {
                console.log(`[Populate] Detected director intent for: ${context.director}`);
                items = await moviesProvider.getDirectorFilmography(context.director);
            } else if (context.genre) {
                console.log(`[Populate] Detected genre intent for: ${context.genre}`);
                items = await moviesProvider.getMoviesByGenre(context.genre, context.limit);
            }
        }
        else if (context.intent === 'list' && context.subject) {
            console.log(`[Populate] Detected generic list intent for: ${context.subject}`);
            // Generate list using LLM
            // We need to import generateListFromLLM first (I'll add the import in a separate block if needed, or assume it's added)
            const llmItems = await generateListFromLLM(context.subject, context.limit);
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
        else if (category === 'books' && context.author) {
            console.log(`[Populate] Detected author intent for: ${context.author}`);
            // Import dynamically or at top? Top is fine as they are server-side providers
            // We need to import booksProvider in this file
            items = await booksProvider.getBooksByAuthor(context.author);
        } else if (category === 'music' && context.artist) {
            console.log(`[Populate] Detected artist intent for: ${context.artist} (Intent: ${context.intent})`);
            if (context.intent === 'song') {
                items = await itunesProvider.getTopSongs(context.artist);
            } else {
                items = await itunesProvider.getDiscography(context.artist);
            }
        } else if ((category === 'other' || category === 'more') && context.subject) {
            // Experimental: Wikipedia Categories
            console.log(`[Populate] Detected generic subject for More: ${context.subject} (limit: ${context.limit})`);
            items = await universalProvider.getListMembers(context.subject, context.limit);
        }
    } catch (e) {
        console.error('[Populate] Provider error:', e);
    }

    if (items.length === 0) return { populated: false, count: 0 };

    // Limit to reasonable amount (e.g. top 50) to prevent blowout
    // If context has a limit (e.g. "Top 10"), respect it strictly? 
    // Yes, but maybe give a small buffer if user wants to re-rank? 
    // Actually user said "It should return a list of 7 items". So strict limit is better for "7 Wonders".
    const maxItems = context.limit ? context.limit : 50;
    const itemsToInsert = items.slice(0, maxItems);

    // 4. Batch Insert
    // Note: We need to ensure we don't duplicate if items already exist (though for new list it's fine)
    // 4. Batch Insert
    // Note: We need to ensure we don't duplicate if items already exist (though for new list it's fine)
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

    // 5. Revalidate
    revalidatePath('/');

    return { populated: true, count: insertedData.length, items: insertedData };
}
