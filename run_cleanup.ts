
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local manually since dotenv doesn't do it automatically for nextjs conventions usually
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false
    }
});

async function runCleanup() {
    console.log("Starting cleanup of empty lists...");

    // 1. Fetch all lists
    // Note: RLS might restrict this if we don't have a service key, 
    // but standard setup usually allows reading public lists or own lists.
    // If we can't fetch all, we can only clean what we can see.
    const { data: lists, error: listError } = await supabase
        .from('lists')
        .select('id, title, user_id');

    if (listError) {
        console.error("Error fetching lists:", listError);
        return;
    }

    console.log(`Found ${lists.length} total lists.`);

    let deletedCount = 0;
    let errors = 0;

    for (const list of lists) {
        // 2. Check item count for each list
        // We can do this by selecting count of items
        const { count, error: countError } = await supabase
            .from('list_items')
            .select('*', { count: 'exact', head: true })
            .eq('list_id', list.id);

        if (countError) {
            console.error(`Error checking items for list ${list.id}:`, countError);
            errors++;
            continue;
        }

        if (count === 0) {
            console.log(`Deleting empty list: "${list.title}" (${list.id})...`);

            // 3. Delete the list
            const { error: deleteError } = await supabase
                .from('lists')
                .delete()
                .eq('id', list.id);

            if (deleteError) {
                console.error(`Failed to delete list ${list.id}:`, deleteError);
                // Likely RLS violation if not owner
                errors++;
            } else {
                deletedCount++;
            }
        }
    }

    console.log("Cleanup complete.");
    console.log(`Deleted: ${deletedCount}`);
    console.log(`Errors: ${errors}`);
}

runCleanup();
