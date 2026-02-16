'use server'

import { createClient } from '@/lib/supabase/server';

export async function getPublicList(listId: string) {
    const supabase = await createClient();

    const { data: list, error } = await supabase
        .from('lists')
        .select('*, profiles(username, avatar_url), list_items(*)')
        .eq('id', listId)
        .single();

    if (error || !list) return null;

    // Sort items by rank
    list.list_items.sort((a: any, b: any) => a.rank - b.rank);

    return list;
}
