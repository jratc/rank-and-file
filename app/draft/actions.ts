'use server'

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { MOCK_USER, IS_AUTH_DISABLED } from '@/lib/auth-bypass';

export async function getDraftList(listId?: string) {
    try {
        const supabase = await createClient();
        const { data } = await supabase.auth.getUser();
        const authUser = data?.user;
        const user = IS_AUTH_DISABLED ? MOCK_USER : authUser;

        if (!user) return null;

        let query = supabase
            .from('lists')
            .select('*, list_items(*)');

        if (listId) {
            query = query.eq('id', listId);
        } else {
            query = query.eq('status', 'published').order('created_at', { ascending: false }).limit(1);
        }

        const { data: list, error } = await query.single();

        if (error) {
            console.error('getDraftList error:', error);
            return null;
        }

        if (!list) return null;

        // Sort items by rank
        list.list_items.sort((a: any, b: any) => a.rank - b.rank);

        return list;
    } catch (error) {
        console.error('getDraftList critical error:', error);
        return null;
    }
}

export async function updateListOrder(listId: string, items: { id: string, rank: number }[]) {
    try {
        const supabase = await createClient();
        const { data } = await supabase.auth.getUser();
        const authUser = data?.user;
        const user = IS_AUTH_DISABLED ? MOCK_USER : authUser;

        if (!user) return { error: 'Unauthorized' };

        // Verify list ownership
        const { data: list, error: listError } = await supabase
            .from('lists')
            .select('id')
            .eq('id', listId)
            .eq('user_id', user.id)
            .single();

        if (listError || !list) {
            console.error('updateListOrder ownership check error:', listError);
            return { error: 'List not found or unauthorized' };
        }

        // Update ranks in bulk using upsert
        const upsertData = items.map(item => ({
            id: item.id,
            rank: item.rank,
            list_id: listId // Required for upsert to match properly if there are constraints
        }));

        const { error: updateError } = await supabase
            .from('list_items')
            .upsert(upsertData, { onConflict: 'id' });

        if (updateError) {
            console.error('updateListOrder bulk update error:', updateError);
            return { error: 'Failed to update item ranks' };
        }

        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        console.error('updateListOrder critical error:', error);
        return { error: error.message || 'Server error' };
    }
}

export async function deleteListItem(itemId: string) {
    try {
        const supabase = await createClient();
        const { data } = await supabase.auth.getUser();
        const authUser = data?.user;
        const user = IS_AUTH_DISABLED ? MOCK_USER : authUser;

        if (!user) return { error: 'Unauthorized' };

        const { error } = await supabase
            .from('list_items')
            .delete()
            .eq('id', itemId);

        if (error) {
            console.error('deleteListItem error:', error);
            return { error: error.message };
        }

        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        console.error('deleteListItem critical error:', error);
        return { error: error.message };
    }
}

export async function publishList(listId: string) {
    try {
        const supabase = await createClient();
        const { data } = await supabase.auth.getUser();
        const authUser = data?.user;
        const user = IS_AUTH_DISABLED ? MOCK_USER : authUser;

        if (!user) return { error: 'Unauthorized' };

        const { error } = await supabase
            .from('lists')
            .update({ status: 'published' })
            .eq('id', listId)
            .eq('user_id', user.id);

        if (error) {
            console.error('publishList error:', error);
            return { error: error.message };
        }

        revalidatePath('/draft');
        return { success: true, listId };
    } catch (error: any) {
        console.error('publishList critical error:', error);
        return { error: error.message };
    }
}

export async function hydrateItemImage(itemId: string, query: string, category?: string, contextTopic?: string) {
    try {
        const supabase = await createClient();

        // 1. Check if image already exists (Optimization)
        const { data: item, error: fetchError } = await supabase
            .from('list_items')
            .select('metadata')
            .eq('id', itemId)
            .single();

        if (fetchError || !item) return null;

        if (item.metadata.imageUrl) {
            return item.metadata.imageUrl; // Already hydrated
        }

        // 2. Fetch thumbnail
        let imageUrl: string | null = null;

        if (category === 'music') {
            try {
                const { spotifyProvider } = await import('@/lib/spotify');
                const spotifyItems = await spotifyProvider.searchTracks(query);
                if (spotifyItems.length > 0) {
                    imageUrl = spotifyItems[0].imageUrl;
                }
            } catch (err) {
                console.error('Spotify hydration failed, falling back...', err);
            }
        }

        if (category === 'movies' && !imageUrl) {
            const { moviesProvider } = await import('@/lib/movies');
            const movieItems = await moviesProvider.search(query);
            if (movieItems.length > 0) {
                // Find best title match if possible, otherwise first result
                const bestMatch = movieItems.find(m => m.name.toLowerCase() === query.toLowerCase()) || movieItems[0];
                imageUrl = bestMatch.imageUrl;
            }
        }

        if (!imageUrl) {
            // Fallback to Universal Provider (Wikipedia)
            const { universalProvider } = await import('@/lib/universal');
            // Try with category and topic context
            imageUrl = await universalProvider.fetchThumbnail(query, category, contextTopic);
        }

        if (imageUrl) {
            // 3. Update DB
            const newMetadata = { ...item.metadata, imageUrl };
            await supabase
                .from('list_items')
                .update({ metadata: newMetadata })
                .eq('id', itemId);

            return imageUrl;
        }

        return null;
    } catch (error) {
        console.error('hydrateItemImage error:', error);
        return null;
    }
}

export async function loadMoreItems(listId: string, topic: string, currentCount: number) {
    try {
        const supabase = await createClient();
        const { data } = await supabase.auth.getUser();
        const user = IS_AUTH_DISABLED ? MOCK_USER : data?.user;

        if (!user) return null;

        // 1. Fetch existing names for deduplication
        const { data: existingItems } = await supabase
            .from('list_items')
            .select('metadata')
            .eq('list_id', listId);

        const existingNames = (existingItems || []).map(i => i.metadata.name.toLowerCase().trim());

        // 2. Generate items
        const { generateMoreItemsFromLLM } = await import('@/lib/ai');
        const generatedItems = await generateMoreItemsFromLLM(topic, currentCount, 35, existingNames);

        if (!generatedItems || generatedItems.length === 0) return [];

        // 3. Filter out duplicates (double-check after LLM)
        const uniqueItems = generatedItems.filter(item => {
            const normalized = item.name.toLowerCase().trim();
            if (existingNames.includes(normalized)) return false;
            existingNames.push(normalized);
            return true;
        });

        if (uniqueItems.length === 0) return [];

        // 4. Format for DB
        const itemsToInsert = uniqueItems.map((item, index) => ({
            list_id: listId,
            entity_id: `llm-more-${Date.now()}-${index}`,
            rank: currentCount + 1 + index,
            metadata: {
                id: `llm-more-${Date.now()}-${index}`,
                name: item.name,
                subtitle: item.subtitle,
                imageUrl: null, // Client will hydrate
                externalUrl: null,
                provider: 'gemini',
                type: 'custom'
            }
        }));

        // 3. Insert
        const { data: insertedData, error } = await supabase
            .from('list_items')
            .insert(itemsToInsert)
            .select();

        if (error) {
            console.error('loadMoreItems DB error:', error);
            return [];
        }

        revalidatePath('/');

        // Return structured items for frontend state
        return insertedData.map((row: any) => ({
            id: row.entity_id,
            rank: row.rank,
            metadata: row.metadata
        }));

    } catch (error) {
        console.error('loadMoreItems error:', error);
        return [];
    }
}
