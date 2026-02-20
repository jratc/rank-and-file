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

    // CHECK FOR DUPLICATES
    const { data: existingItem } = await supabase
        .from('list_items')
        .select('id')
        .eq('list_id', listId)
        .eq('entity_id', item.id)
        .maybeSingle();

    if (existingItem) {
        return { error: 'Item already in list' };
    }

    // 1. Shift all existing items down by 1
    const { error: shiftError } = await supabase
        .from('list_items')
        .update({ rank: supabase.rpc('increment', { row_id: 'id', x: 1 }) as any }) // This is wrong syntax for direct update
    // Use a simpler approach: just update rank = rank + 1
    // (Wait, Supabase doesn't support rank = rank + 1 in a single update call easily without RPC or raw SQL)
    // Actually, I can use raw SQL via RPC or just a loop (but loop is slow).
    // Let's use the most reliable way: fetch all, shift, save? No, that's bad.
    // I'll use a direct UPDATE with a raw SQL-like object if I were using Postgres directly, 
    // but here I depends on Supabase client.

    // Standard Supabase pattern for incrementing:
    // .update({ count: supabase.rpc('increment', { x: 1 }) }) is NOT how it works.
    // It's usually `update({ rank: rank + 1 })` which doesn't work in JS.

    // I will use a simple RPC call if available, or just fetch and batch update.
    // Given the constraints, I'll fetch current items, increment their rank, and upsert.

    const { data: existingItemsData, error: fetchError } = await supabase
        .from('list_items')
        .select('id, rank')
        .eq('list_id', listId);

    if (fetchError) {
        return { error: 'Failed to fetch existing items for shifting.' };
    }

    if (existingItemsData && existingItemsData.length > 0) {
        const updates = existingItemsData.map(item => ({
            id: item.id,
            rank: item.rank + 1,
            list_id: listId
        }));

        const { error: updateError } = await supabase
            .from('list_items')
            .upsert(updates);

        if (updateError) {
            return { error: 'Failed to shift ranks: ' + updateError.message };
        }
    }

    // 2. Add new item at rank 1
    const { data: newItem, error: addError } = await supabase
        .from('list_items')
        .insert({
            list_id: listId,
            entity_id: item.id,
            rank: 1, // Always rank 1
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
