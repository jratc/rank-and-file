
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkComments() {
    const { data, error } = await supabase
        .from('comments')
        .select('count', { count: 'exact', head: true });

    if (error) {
        console.error('Comments table error:', error.message);
        if (error.message.includes('does not exist')) {
            console.log('RESULT: Comments table DOES NOT exist.');
        }
    } else {
        console.log('RESULT: Comments table EXISTS.');
    }
}

checkComments();
