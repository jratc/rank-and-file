'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
    const supabase = await createClient()

    const data = {
        email: formData.get('email') as string,
        password: formData.get('password') as string,
    }

    const { error } = await supabase.auth.signInWithPassword(data)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/', 'layout')
    redirect('/')
}

export async function signup(formData: FormData) {
    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const displayName = formData.get('display_name') as string

    const data = {
        email,
        password,
        options: {
            data: {
                display_name: displayName,
            },
        },
    }

    const { data: authData, error } = await supabase.auth.signUp(data)

    if (error) {
        console.error('Signup Error:', error)
        return { error: `Signup failed: ${error.message} (Code: ${error.status || 'Unknown'})` }
    }

    // Manual Profile Creation (Reliable Replacement for Triggers)
    if (authData.user) {
        // 1. Generate Username Base
        const emailUser = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        const randomSuffix = Math.floor(Math.random() * 10000).toString();

        // Ensure at least 3 chars
        let usernameBase = emailUser.length >= 3 ? emailUser : `user${randomSuffix}`;

        // Append random suffix to be safe (read-before-write is too slow/complex here)
        const username = `${usernameBase}${randomSuffix}`;

        const finalDisplayName = displayName || username;

        // 2. Insert into Profiles
        // We use upsert to be safe, though ID should be unique from Auth
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: authData.user.id,
                email: email,
                username: username,
                display_name: finalDisplayName,
            })
            .select()
            .single()

        if (profileError) {
            console.error('Manual profile creation failed:', profileError)
            // Note: We don't return error here because the Auth User IS created. 
            // Better to let them log in and maybe have a broken profile than fail securely.
        } else {
            console.log('Manual profile creation successful for:', username);
        }
    }

    revalidatePath('/', 'layout')
    redirect('/')
}

export async function resetPassword(formData: FormData) {
    const supabase = await createClient()
    const email = formData.get('email') as string
    const origin = (await headers()).get('origin')

    if (!email) {
        return { error: 'Email is required' }
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
    })

    if (error) {
        return { error: error.message }
    }

    return { success: true }
}

export async function updatePassword(formData: FormData) {
    const supabase = await createClient()
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (!password || !confirmPassword) {
        return { error: 'Password and confirm password are required' }
    }

    if (password !== confirmPassword) {
        return { error: 'Passwords do not match' }
    }

    const { error } = await supabase.auth.updateUser({
        password: password,
    })

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/', 'layout')
    redirect('/')
}
