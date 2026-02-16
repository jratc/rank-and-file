'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProfile(formData: FormData) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('Not authenticated');
    }

    const displayName = formData.get('displayName') as string;
    const bio = formData.get('bio') as string;

    const { error } = await supabase
        .from('profiles')
        .update({
            display_name: displayName,
            bio: bio,
            updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

    if (error) {
        throw new Error(error.message);
    }

    revalidatePath('/settings');
    revalidatePath(`/@[username]`);
}
