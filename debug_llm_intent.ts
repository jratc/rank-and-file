
import { generateSearchIntent } from './lib/ai';

async function run() {
    const testCases = [
        { query: "Sean Penn Movies", category: "movies" },
        { query: "Films by Wes Anderson", category: "movies" },
        { query: "Best 80s Horror Movies", category: "movies" },
        { query: "Robert Duvall", category: "movies" }, // Capitalized
        { query: "robert duvall", category: "movies" }, // Lowercase
        { query: "Jazz Albums", category: "music" },
        { query: "Oasis Songs", category: "music" },
        { query: "Italian Food in NYC", category: "food" },
    ];

    console.log("--- Testing LLM Intent Detection ---");
    if (!process.env.GEMINI_API_KEY) {
        console.warn("WARNING: GEMINI_API_KEY not found. LLM calls will fail or be skipped.");
    }

    for (const test of testCases) {
        console.log(`\nQuery: "${test.query}" [${test.category}]`);
        try {
            const result = await generateSearchIntent(test.query, test.category);
            console.log("Result:", JSON.stringify(result, null, 2));
        } catch (e) {
            console.error("Error:", e);
        }
    }
}

run();
