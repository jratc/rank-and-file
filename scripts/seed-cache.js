const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 1. Load Env Manually
const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value.length > 0) env[key.trim()] = value.join('=').trim().replace(/^"|"$/g, '');
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const GEMINI_API_KEY = env.GEMINI_API_KEY;
const MOCK_USER_ID = 'eea62b53-aba1-485f-b650-973596fb9e8b'; // Valid User ID for RLS

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function generateTopics(count = 50) {
    console.log(`[Seed] Generating ${count} popular list topics...`);
    const prompt = `
        Generate a JSON array of the ${count} most popular search topics for a ranking app.
        Include diverse categories like Movies, Music, Books, Food, Places, and General Knowledge.
        
        Output format: ["Topic 1", "Topic 2", ...]
        Return valid JSON only.
    `;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error(`[Seed] Gemini API Error (${response.status}):`, errText);
        throw new Error(`Gemini API Error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
        console.error("[Seed] Full Data:", JSON.stringify(data, null, 2));
        throw new Error("No text in Gemini response");
    }
    return JSON.parse(text.replace(/```json|```/g, '').trim());
}

async function generateItems(topic) {
    console.log(`[Seed] Generating items for: "${topic}"...`);
    const prompt = `
        Generate a JSON array of the top 30 items for the topic: "${topic}".
        Output format: [{"name": "Item Name", "subtitle": "Short desc"}]
        Return valid JSON only.
    `;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error(`[Seed] Gemini API Error (${response.status}):`, errText);
        throw new Error(`Gemini API Error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("No items from Gemini");
    return JSON.parse(text.replace(/```json|```/g, '').trim());
}

async function main() {
    try {
        const topics = await generateTopics(20);

        for (const topic of topics) {
            console.log(`\n[Seed] Processing: "${topic}"`);

            const { data: existing } = await supabase
                .from('lists')
                .select('id')
                .ilike('title', topic)
                .limit(1)
                .maybeSingle();

            if (existing) {
                console.log(`[Seed] Already exists. Skipping.`);
                continue;
            }

            const { data: newList, error: listError } = await supabase
                .from('lists')
                .insert({
                    title: topic,
                    category: 'other',
                    user_id: MOCK_USER_ID,
                    is_public: true
                })
                .select()
                .single();

            if (listError) {
                console.error(`[Seed] Error creating list:`, JSON.stringify(listError, null, 2));
                continue;
            }

            const items = await generateItems(topic);
            const { error: itemError } = await supabase.from('list_items').insert(
                items.map((item, idx) => ({
                    list_id: newList.id,
                    entity_id: `seed-${Date.now()}-${idx}`,
                    rank: idx + 1,
                    metadata: {
                        name: item.name,
                        subtitle: item.subtitle,
                        imageUrl: null,
                        provider: 'gemini-seed',
                        type: 'custom'
                    }
                }))
            );

            if (itemError) console.error(`[Seed] Error inserting items:`, JSON.stringify(itemError, null, 2));
            else console.log(`[Seed] Success! Populated "${topic}" with ${items.length} items.`);
        }
    } catch (error) {
        console.error(`[Seed] Fatal error:`, error);
    }
}

main();
