
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const GEMINI_MODEL = 'gemini-flash-latest';

async function generateSearchIntent(query, category) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.warn('GEMINI_API_KEY not found.');
        return null;
    }

    try {
        const prompt = `
        You are a search intent classifier for a ranking app. 
        Analyze the user's search query and category to determine their specific intent.
        
        Category: ${category}
        Query: "${query}"

        Return a JSON object with the following fields:
        - subject: (string) The core subject (e.g., "The Godfather", "Italian", "Robert Duvall", "NPR Journalists")
        - intent: (string) One of: "song", "album", "movie", "book", "place", "general", "person", "list"
        - author: (string, optional) If query implies a book author
        - artist: (string, optional) If query implies a music artist
        - director: (string, optional) If query implies a film director
        - actor: (string, optional) If query implies an actor
        - genre: (string, optional) If query implies a genre
        - year: (number, optional) If query implies a release year
        - limit: (number, optional) If query asks for a top N list (e.g. "Top 10")

        Rules:
        1. If the query is an actor's name (e.g. "Sean Penn"), set 'actor' to that name and intent to 'movie'.
        2. If the query is a director (e.g. "Wes Anderson"), set 'director'.
        3. If the query is a genre (e.g. "Horror", "80s Music"), set 'genre'.
        4. If the query asks for a group of people or items (e.g. "NPR Journalists", "Best Sci-Fi Books"), set intent to 'list' and subject to the topic.
        5. "Sean Penn Movies" -> subject: "Sean Penn", actor: "Sean Penn", intent: "movie"
        6. "Best Pizza in Chicago" -> subject: "Pizza", intent: "place", location: "Chicago"
        
        Response must be valid JSON only. No markdown formatting.
        `;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { responseMimeType: "application/json" }
                })
            }
        );

        if (!response.ok) {
            console.error(`Gemini API Error: ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) return null;

        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText);

    } catch (error) {
        console.error('Intent detection failed:', error);
        return null;
    }
}

async function testIntent() {
    const cases = [
        { query: "Langston Hughes books", category: "books" },
        { query: "Best Pizza in NY", category: "food" },
        { query: "Best Dive Bars", category: "bars" },
    ];

    console.log("Testing Intent Detection...");

    for (const test of cases) {
        console.log(`\nQuery: "${test.query}" [${test.category}]`);
        const result = await generateSearchIntent(test.query, test.category);
        console.log("Result:", JSON.stringify(result, null, 2));
    }
}

testIntent();
