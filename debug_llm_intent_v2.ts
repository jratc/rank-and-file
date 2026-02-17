
import { generateSearchIntent } from './lib/ai';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testIntent() {
    const cases = [
        { query: "NPR Journalists", category: "more" },
        { query: "Best Sci-Fi Books", category: "books" },
        { query: "Sean Penn Movies", category: "movies" },
        { query: "Chloe Veltman", category: "more" }
    ];

    console.log("Testing Intent Detection...");

    for (const test of cases) {
        console.log(`\nQuery: "${test.query}" [${test.category}]`);
        const result = await generateSearchIntent(test.query, test.category);
        console.log("Result:", JSON.stringify(result, null, 2));
    }
}

testIntent();
