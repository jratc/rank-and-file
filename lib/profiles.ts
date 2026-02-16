import { createClient } from './supabase/server';

export async function getProfileByUsername(username: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();

    if (error) {
        console.error('Error fetching profile:', error);
        return null;
    }
    return data;
}

export async function getPublicListsByUserId(userId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('lists')
        .select('*, list_items(*), profiles(username)')
        .eq('user_id', userId)
        .eq('is_public', true)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching user lists:', error);
        return [];
    }

    // Count responses for each list
    const listsWithCounts = await Promise.all(
        (data || []).map(async (list) => {
            const { count } = await supabase
                .from('lists')
                .select('*', { count: 'exact', head: true })
                .eq('parent_id', list.id);
            return { ...list, response_count: count || 0 };
        })
    );

    return listsWithCounts;
}
