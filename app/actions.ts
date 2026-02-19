'use server'

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { MOCK_USER, IS_AUTH_DISABLED } from '@/lib/auth-bypass';

export async function createList(title: string = 'NEW LIST', category: string = 'music') {
    const log = (msg: string) => {
        console.log(`${new Date().toISOString()}: ${msg}`);
    };

    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;
    const user = IS_AUTH_DISABLED ? MOCK_USER : authUser;

    log(`[Action] Creating list: "${title}" | Category: ${category} | User: ${user?.id}`);

    if (!user) {
        log(`[Action] Error: Not logged in`);
        throw new Error("Must be logged in");
    }

    // VERIFY PROFILE EXISTS (Foreign Key constraint)
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

    if (profileError || !profile) {
        log(`[Action] Profile missing for user ${user.id}. Attempting to fix...`);
        // If profile is missing, try to create it (should have been done by trigger)
        const { error: insertError } = await supabase
            .from('profiles')
            .insert({ id: user.id, username: `user_${user.id.substring(0, 5)}` });

        if (insertError) {
            log(`[Action] Error creating profile: ${insertError.message} | Code: ${insertError.code}`);
            // Don't throw yet, maybe the list insert works anyway (unlikely but possible if RLS is weird)
        } else {
            log(`[Action] Profile fixed for user ${user.id}`);
        }
    }

    const { data, error } = await supabase
        .from('lists')
        .insert({
            title: title,
            user_id: user.id,
            category: category
        })
        .select('*, profiles(username, display_name)')
        .single();

    if (error) {
        log(`[Action] Create list DB error: ${error.message} | Code: ${error.code} | Hint: ${error.hint}`);
        // Return a structured error so the UI can log it
        throw new Error(`DB_ERROR: ${error.message} (${error.code})`);
    }

    log(`[Action] List created successfully: ${data.id}`);

    // Include empty list_items to match the UI expectation
    const newList = { ...data, list_items: [] };

    revalidatePath('/');
    return newList;
}

export async function addItemsToList(listId: string, items: string[]) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Must be logged in");

    // Clean and filter items
    const filteredItems = items
        .map(i => i.trim())
        .filter(i => i.length > 0);

    if (filteredItems.length === 0) return { success: true, count: 0 };

    // Create the batch
    const insertData = filteredItems.map((name, index) => ({
        list_id: listId,
        entity_id: `manual-${Date.now()}-${index}`,
        rank: index + 1,
        metadata: {
            name: name,
            subtitle: 'Manual Entry',
            imageUrl: null,
            provider: 'manual'
        }
    }));

    const { error } = await supabase
        .from('list_items')
        .insert(insertData);

    if (error) {
        console.error('Add items error:', error);
        throw new Error(error.message);
    }

    revalidatePath('/');
    return { success: true, count: filteredItems.length };
}

export async function findListByTitle(title: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('lists')
        .select('id, title, user_id, category')
        .eq('title', title)
        .limit(1)
        .single();

    if (error) return null;
    return data;
}

export async function updateListTitle(listId: string, title: string) {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;
    const user = IS_AUTH_DISABLED ? MOCK_USER : authUser;

    if (!user) {
        throw new Error("Must be logged in");
    }

    const { error } = await supabase
        .from('lists')
        .update({ title })
        .eq('id', listId)
        .eq('user_id', user.id);

    if (error) {
        console.error('Update list title error:', error);
        throw new Error(error.message);
    }

    revalidatePath('/');
    return { success: true };
}

export async function getLists() {
    const supabase = await createClient();

    // Only fetch ORIGINAL lists (no parent_id) — responses are accessed via thread view
    const { data, error } = await supabase
        .from('lists')
        .select('*, list_items(*), profiles(username, display_name)')
        .eq('is_public', true)
        .is('parent_id', null)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Fetch lists error:', error);
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

export async function getFollowingLists() {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    if (!user) return [];

    // 1. Get IDs of people I follow
    const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

    const followingIds = (follows || []).map(f => f.following_id);

    if (followingIds.length === 0) return [];

    // 2. Get lists from those users
    const { data, error } = await supabase
        .from('lists')
        .select('*, list_items(*), profiles(username, display_name)')
        .eq('is_public', true)
        .is('parent_id', null)
        .in('user_id', followingIds)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Fetch following lists error:', error);
        return [];
    }

    // 3. Count responses
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

export async function deleteList(listId: string) {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;
    const user = IS_AUTH_DISABLED ? MOCK_USER : authUser;

    if (!user) {
        throw new Error("Must be logged in");
    }

    const { error } = await supabase
        .from('lists')
        .delete()
        .eq('id', listId)
        .eq('user_id', user.id);

    if (error) {
        console.error('Delete list error:', error);
        throw new Error(error.message);
    }

    revalidatePath('/');
    return { success: true };
}

export async function createResponse(parentListId: string) {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    if (!user) {
        throw new Error("Must be logged in to respond");
    }

    // 1. Fetch parent list details
    const { data: parentList, error: fetchError } = await supabase
        .from('lists')
        .select('*')
        .eq('id', parentListId)
        .single();

    if (fetchError || !parentList) {
        throw new Error("Parent list not found");
    }

    // BLOCK SELF-RESPONSE
    if (parentList.user_id === user.id) {
        throw new Error("Cannot respond to your own list");
    }

    // CHECK FOR EXISTING RESPONSE
    const { data: existingResponse } = await supabase
        .from('lists')
        .select('*')
        .eq('parent_id', parentList.id)
        .eq('user_id', user.id)
        .single();

    if (existingResponse) {
        return existingResponse;
    }

    // 2. Create new response list
    const { data: newList, error: createError } = await supabase
        .from('lists')
        .insert({
            title: `Re: ${parentList.title}`,
            category: parentList.category,
            user_id: user.id,
            parent_id: parentList.id,
            is_public: true
        })
        .select()
        .single();

    if (createError) {
        console.error('Create response error:', createError);
        throw new Error(createError.message);
    }

    // 3. COPY ITEMS FROM PARENT
    // Fetch parent items
    const { data: parentItems, error: itemsError } = await supabase
        .from('list_items')
        .select('*')
        .eq('list_id', parentListId);

    if (!itemsError && parentItems && parentItems.length > 0) {
        // Prepare new items
        const newItems = parentItems.map(item => ({
            list_id: newList.id,
            entity_id: item.entity_id,
            rank: item.rank,
            metadata: item.metadata,
            // We don't copy specific user data if any, but metadata is usually shared.
            // Ensure we don't copy 'id' or 'created_at'
        }));

        // Batch insert
        const { error: copyError } = await supabase
            .from('list_items')
            .insert(newItems);

        if (copyError) {
            console.error('Failed to copy list items:', copyError);
            // We don't fail the whole request, just log it. The user gets an empty list.
        } else {
            // Attach items to returned object so UI updates immediately
            newList.list_items = newItems;
        }
    }

    revalidatePath('/');
    return newList;
}

export async function getMyResponse(parentListId: string) {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    if (!user) return null;

    const { data } = await supabase
        .from('lists')
        .select('id')
        .eq('parent_id', parentListId)
        .eq('user_id', user.id)
        .single();

    return data?.id || null;
}

export async function getThread(listId: string) {
    const supabase = await createClient();

    // 1. Get the requested list to find its parent_id
    const { data: currentList, error: currentError } = await supabase
        .from('lists')
        .select('*, list_items(*), profiles(username, display_name)')
        .eq('id', listId)
        .single();

    if (currentError || !currentList) {
        console.error('Error fetching current list:', currentError);
        return null;
    }

    // Determine the thread root
    const rootListId = currentList.parent_id || currentList.id;

    // 2. Fetch the root list
    const { data: rootList, error: rootError } = await supabase
        .from('lists')
        .select('*, list_items(*), profiles(username, display_name)')
        .eq('id', rootListId)
        .single();

    if (rootError) {
        console.error('Error fetching root list:', rootError);
        return null;
    }

    // 3. Fetch all children of the root (responses)
    const { data: responses, error: responsesError } = await supabase
        .from('lists')
        .select('*, list_items(*), profiles(username, display_name)')
        .eq('parent_id', rootListId)
        .order('created_at', { ascending: true });

    if (responsesError) {
        console.error('Error fetching responses:', responsesError);
    }

    // Combine: [Root, ...Responses]
    return [rootList, ...(responses || [])];
}

/* ── FEATURE: Places Map ─────────────────────────────────────
   To disable, comment out uses of getAllPlacesItems in dashboard.tsx
   ──────────────────────────────────────────────────────────── */
export async function getAllPlacesItems() {
    const supabase = await createClient();

    // Get all public places/bars/restaurants lists (original only)
    const { data: placeLists, error } = await supabase
        .from('lists')
        .select('id, title, category, list_items(*), profiles(username)')
        .eq('is_public', true)
        .is('parent_id', null)
        .in('category', ['places', 'bars', 'restaurants'])
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching places:', error);
        return [];
    }

    // Flatten all items with list context
    return (placeLists || []).flatMap((list) =>
        (list.list_items || []).map((item: any) => ({
            ...item,
            listTitle: list.title,
            listCategory: list.category,
            username: (list as any).profiles?.username || 'unknown',
        }))
    );
}

export async function updateProfile(displayName: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error("Must be logged in");
    }

    const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName })
        .eq('id', user.id);

    if (error) {
        // Handle constraint errors if meaningful
        console.error('Update profile error:', error);
        throw new Error(error.message);
    }

    revalidatePath('/');
    return { success: true };
}

export async function getUserResponseIds(userId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('lists')
        .select('parent_id')
        .eq('user_id', userId)
        .not('parent_id', 'is', null);

    if (error) {
        console.error('Error fetching user responses:', error);
        return [];
    }

    return (data || []).map((row: any) => row.parent_id).filter(Boolean) as string[];
}

// ========== FOLLOW SYSTEM ==========

export async function followUser(targetUserId: string) {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;
    const user = IS_AUTH_DISABLED ? MOCK_USER : authUser;

    if (!user) return { error: 'Not authenticated' };
    if (user.id === targetUserId) return { error: 'Cannot follow yourself' };

    const { error } = await supabase
        .from('follows')
        .insert({ follower_id: user.id, following_id: targetUserId });

    if (error) {
        if (error.code === '23505') return { error: 'Already following' }; // unique constraint
        console.error('Follow error:', error);
        return { error: error.message };
    }

    revalidatePath('/');
    return { success: true };
}

export async function unfollowUser(targetUserId: string) {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;
    const user = IS_AUTH_DISABLED ? MOCK_USER : authUser;

    if (!user) return { error: 'Not authenticated' };

    const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId);

    if (error) {
        console.error('Unfollow error:', error);
        return { error: error.message };
    }

    revalidatePath('/');
    return { success: true };
}

export async function getFollowedUsers() {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;
    const user = IS_AUTH_DISABLED ? MOCK_USER : authUser;

    if (!user) return [];

    const { data, error } = await supabase
        .from('follows')
        .select('following_id, profiles!follows_following_id_fkey(id, username, display_name)')
        .eq('follower_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Get followed users error:', error);
        return [];
    }

    return (data || []).map((row: any) => ({
        id: row.profiles?.id,
        username: row.profiles?.username,
        display_name: row.profiles?.display_name,
    }));
}

export async function isFollowing(targetUserId: string): Promise<boolean> {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;
    const user = IS_AUTH_DISABLED ? MOCK_USER : authUser;

    if (!user) return false;

    const { data } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)
        .single();

    return !!data;
}

// COMMENTS
export async function getComments(listId: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('comments')
        .select(`
            id,
            user_id,
            list_id,
            content,
            created_at,
            profiles (username, display_name)
        `)
        .eq('list_id', listId)
        .order('created_at', { ascending: true }); // Linear thread

    if (error) {
        console.error('Get comments error:', error);
        return [];
    }

    // Transform to match Comment interface if needed, or rely on TS inference
    // Supabase returns profiles as an object or array depending on relation, usually object here.
    return data;
}

export async function addComment(listId: string, content: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error("Must be logged in to comment");

    const { data, error } = await supabase
        .from('comments')
        .insert({
            list_id: listId,
            user_id: user.id,
            content: content
        })
        .select(`
            *,
            profiles (username, display_name)
        `)
        .single();

    if (error) throw error;

    // Revalidate paths if necessary, or just return data for optimistic UI
    // revalidatePath(`/list/${listId}`); 
    return data;
}

export async function deleteComment(commentId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error("Must be logged in");

    // RLS handles the "user_id = auth.uid()" check usually, but good to be explicit or handle error
    const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);
    // .eq('user_id', user.id); // Redundant if RLS covers it, but safe.

    if (error) throw error;
    return true;
}

export async function submitFeedback(content: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
        .from('feedback')
        .insert({
            user_id: user?.id || null,
            content: content
        });

    if (error) {
        console.error('Submit feedback error:', error);
        // Fallback for when table doesn't exist yet
        if (error.code === 'PGRST116' || error.message?.includes('relation "public.feedback" does not exist')) {
            console.log('FEEDBACK FALLBACK (Table missing):', content);
            return { success: true, fallback: true };
        }
        throw error;
    }

    return { success: true };
}
