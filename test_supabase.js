
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function test() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL.trim();
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim();
    console.log(`Testing Supabase at: ${url}`);

    const supabase = createClient(url, key);

    const { data, error } = await supabase.from('lists').select('count', { count: 'exact', head: true });

    if (error) {
        console.error('Supabase Error:', error);
    } else {
        console.log('Supabase Connection Success!', data);
    }
}

test();
