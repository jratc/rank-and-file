
import { SearchContext } from './utils';

// Using Gemini Flash Latest for speed and availability
const GEMINI_MODEL = 'gemini-flash-latest';

export async function generateSearchIntent(query: string, category: string): Promise<SearchContext | null> {
    const apiKey = process.env.GEMINI_API_KEY;

    // Fail gracefully if no key 
    if (!apiKey) {
        console.warn('GEMINI_API_KEY not found. Skipping LLM intent detection.');
        return null;
    }

    try {
        console.log(`[AI] Analyzing intent for: "${query}" in category: "${category}"`);

        const prompt = `
        You are a search intent classifier for a ranking app. 
        Analyze the user's search query and category to determine their specific intent.
        
        Category: ${category}
        Query: "${query}"

        Return a JSON object with the following fields:
        - subject: (string) The core subject (e.g., "The Godfather", "Italian", "Robert Duvall")
        - intent: (string) One of: "song", "album", "movie", "book", "place", "general", "person"
        - author: (string, optional) If query implies a book author
        - artist: (string, optional) If query implies a music artist
        - director: (string, optional) If query implies a film director
        - actor: (string, optional) If query implies an actor
        - genre: (string, optional) If query implies a genre
        - year: (number, optional) If query implies a release year
        - limit: (number, optional) If query asks for a top N list (e.g. "Top 10")

        Rules:
        1. If the query is an actor's name (e.g. "Sean Penn", "Robert Duvall"), set 'actor' to that name and intent to 'movie' (if category is movies).
        2. If the query is a director (e.g. "Wes Anderson"), set 'director' to that name.
        3. If the query is a genre (e.g. "Horror", "80s Music"), set 'genre'.
        4. "Sean Penn Movies" -> subject: "Sean Penn", actor: "Sean Penn", intent: "movie"
        5. "Best Pizza in Chicago" -> subject: "Pizza", intent: "place", location: "Chicago" (if applicable)

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
            console.error(`[AI] Gemini API Error: ${response.status} ${response.statusText}`);
            return null;
        }


        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) return null;

        // Clean markdown code blocks if present // ```json ... ```
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const result = JSON.parse(cleanText);
        console.log(`[AI] Intent detected:`, result);

        return result as SearchContext;

    } catch (error) {
        console.error('[AI] Intent detection failed:', error);
        return null;
    }
}

export async function generateListFromLLM(topic: string, count: number = 20): Promise<any[]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return [];

    try {
        console.log(`[AI] Generating list for topic: "${topic}"`);

        const prompt = `
        You are an expert curator for a ranking app.
        The user wants a list of items for the topic: "${topic}".
        
        Generate a JSON array of the top ${count} items that best fit this topic.
        The list should be high-quality, culturally significant, and accurate.
        
        Output format:
        [
            {
                "name": "Item Name",
                "subtitle": "Short description (10-15 words) explaining why it matches the topic or date/creator",
                "score": 95 (relevance score 0-100)
            },
            ...
        ]

        Subject: ${topic}
        
        Return valid JSON only. No markdown.
        `;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: "application/json",
                        temperature: 0.7
                    }
                })
            }
        );

        if (!response.ok) {
            console.error(`[AI] Gemini API Error: ${response.status}`);
            return [];
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) return [];

        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const items = JSON.parse(cleanText);

        return Array.isArray(items) ? items : [];

    } catch (error) {
        console.error('[AI] List generation failed:', error);
        return [];
    }
}
