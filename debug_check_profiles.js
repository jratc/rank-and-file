
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProfiles() {
    console.log('--- Checking Profiles ---');

    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
        console.log('Note: Admin access required for listUsers. Skipping auth user check.');
    } else {
        console.log(`Found ${authUsers.users.length} auth users.`);
    }

    const { data: profiles, error: pError } = await supabase.from('profiles').select('*');
    if (pError) {
        console.error('Error fetching profiles:', pError.message);
    } else {
        console.log(`Found ${profiles.length} profiles.`);
        profiles.forEach(p => console.log(` - ${p.username} (${p.id})`));
    }
}

checkProfiles();
