const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCreateList() {
    console.log('Testing list creation...');

    // Try to find a user first
    const { data: profiles, error: pError } = await supabase.from('profiles').select('id, username').limit(1);
    if (pError || !profiles || profiles.length === 0) {
        console.error('Could not find a profile to test with:', pError);
        return;
    }

    const testUser = profiles[0];
    console.log('Using profile:', testUser.username, testUser.id);

    const { data, error } = await supabase
        .from('lists')
        .insert({
            title: 'TEST LIST ' + Date.now(),
            category: 'books',
            user_id: testUser.id,
            is_public: true
        })
        .select('*, profiles(username, display_name)')
        .single();

    if (error) {
        console.error('Create list error:', error);
    } else {
        console.log('Successfully created list:', data.id);
    }
}

testCreateList();
