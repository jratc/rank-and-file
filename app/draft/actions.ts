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

        // Update ranks
        for (const item of items) {
            const { error } = await supabase
                .from('list_items')
                .update({ rank: item.rank })
                .eq('id', item.id);

            if (error) {
                console.error('updateListOrder rank update error:', error);
                throw new Error('Failed to update item rank');
            }
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

export async function hydrateItemImage(itemId: string, query: string) {
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

        // 2. Fetch thumbnail from Universal Provider (Wikipedia)
        const { universalProvider } = await import('@/lib/universal');
        const imageUrl = await universalProvider.fetchThumbnail(query);

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
