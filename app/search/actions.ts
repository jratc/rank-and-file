'use server'

import { itunesProvider } from '@/lib/itunes';
import { searchPlaces } from '@/lib/places';
import { moviesProvider } from '@/lib/movies';
import { universalProvider } from '@/lib/universal';
import { booksProvider } from '@/lib/books';
import { createClient } from '@/lib/supabase/server';
import { RankedItem, Category } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { MOCK_USER, IS_AUTH_DISABLED } from '@/lib/auth-bypass';

export async function searchEntities(query: string, category: Category = 'music', context?: any): Promise<RankedItem[]> {
    if (!query && !context) return [];

    // Fallback: If category comes in as 'other', treat it as valid for Universal
    try {
        // Explicitly handle 'other' category routing
        if (category === 'other' || category === 'more' as any) {
            return await universalProvider.search(query, context);
        }

        console.log(`Searching ${category} for: ${query}${context ? ` (Context available)` : ''}`);

        switch (category) {
            case 'movies':
                return await moviesProvider.search(query, context);
            case 'places':
                return await searchPlaces(query, category, context);
            case 'food':
                // "Food" category maps to "restaurant" or generic food search
                return await searchPlaces(query, 'food', context);
            case 'books':
                return await booksProvider.search(query, context);
            case 'music':
                return await itunesProvider.searchAlbums(query, context);
            default:
                // iTunes provider uses searchAlbums specifically for music
                return await itunesProvider.searchAlbums(query, context);
        }
    } catch (error) {
        console.error('Search action failed', error);
        return [];
    }
}

export async function addToList(item: RankedItem, listId: string) {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;
    const user = IS_AUTH_DISABLED ? MOCK_USER : authUser;

    if (!user) {
        return { error: 'You must be logged in to add to a list.' };
    }

    if (!listId) {
        return { error: 'No list selected to add to.' };
    }

    // Verify list exists and belongs to user
    const { data: list, error: listError } = await supabase
        .from('lists')
        .select('id')
        .eq('id', listId)
        .eq('user_id', user.id)
        .single();

    if (listError || !list) {
        return { error: 'List not found or unauthorized.' };
    }

    // Get max rank
    const { data: maxRankData } = await supabase
        .from('list_items')
        .select('rank')
        .eq('list_id', listId)
        .order('rank', { ascending: false })
        .limit(1)
        .single();

    const nextRank = (maxRankData?.rank || 0) + 1;

    // Add item
    const { data: newItem, error: addError } = await supabase
        .from('list_items')
        .insert({
            list_id: listId,
            entity_id: item.id,
            rank: nextRank,
            metadata: item,
        })
        .select()
        .single();

    if (addError) {
        console.error('Add item error:', addError);
        return { error: 'Failed to add item: ' + addError.message };
    }

    revalidatePath('/search');
    revalidatePath('/draft'); // Revalidate the edit page
    revalidatePath('/');      // Revalidate home page dashboard
    return { success: true, item: newItem };
}
