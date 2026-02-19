
import { SearchContext } from './utils';

// Using Gemini Flash Latest for speed and availability
// Using Gemini Flash Latest for maximum speed and stability
const GEMINI_MODEL = 'gemini-flash-latest';

// Helper for Exponential Backoff
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delay = 1000): Promise<Response> {
    try {
        const response = await fetch(url, options);

        if (response.status === 429 && retries > 0) {
            console.warn(`[AI] Rate limit hit. Retrying in ${delay}ms... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(url, options, retries - 1, delay * 2);
        }

        return response;
    } catch (error) {
        if (retries > 0) {
            console.warn(`[AI] Network error. Retrying in ${delay}ms...`, error);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(url, options, retries - 1, delay * 2);
        }
        throw error;
    }
}

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

        const response = await fetchWithRetry(
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
        
        CRITICAL REQUIREMENT: If the topic contains a location (e.g., a city like "San Francisco" or "London"), EVERY SINGLE item MUST be strictly within that specific city's legal borders. 
        - DO NOT include items from neighboring cities (e.g., if topic is "San Francisco", do NOT include restaurants in Atherton, Oakland, or South San Francisco).
        - DO NOT provide global or national results if a location is specified.
        - Strict geographical accuracy is the top priority.
        
        Generate a JSON array of the top ${count} items that best fit this topic.
        The list should be high-quality, culturally significant, and accurate.
        
        Output format:
        [
            {
                "name": "Item Name",
                "subtitle": "Short description (10-15 words) explaining why it matches the topic or its specific location/neighborhood within the city",
                "score": 95
            },
            ...
        ]

        Subject: ${topic}
        
        Return valid JSON only. No markdown.
        `;

        const response = await fetchWithRetry(
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

export async function generateMoreItemsFromLLM(topic: string, offset: number, count: number = 10): Promise<any[]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return [];

    try {
        console.log(`[AI] Generating MORE items for: "${topic}" (Offset: ${offset})`);

        const prompt = `
        You are an expert curator for a ranking app.
        The user wants MORE items for the list: "${topic}".
        They already have the top ${offset} items.
        
        CRITICAL REQUIREMENT: If the topic contains a location, EVERY SINGLE item MUST be strictly within that specific city's legal borders. 
        - DO NOT include items from neighboring cities or the broader metro area.
        - If the topic is "San Francisco", only include items in the city itself.
        
        Generate the NEXT ${count} items (ranked #${offset + 1} to #${offset + count}).
        Do NOT repeat items already found.
        
        Output format:
        [
            {
                "name": "Item Name",
                "subtitle": "Short description including specific neighborhood",
                "score": 85
            },
            ...
        ]

        Return valid JSON only. No markdown.
        `;

        const response = await fetchWithRetry(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: "application/json",
                        temperature: 0.8 // Slightly higher temp for variety
                    }
                })
            }
        );

        if (!response.ok) return [];

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return [];

        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const items = JSON.parse(cleanText);

        return Array.isArray(items) ? items : [];

    } catch (error) {
        console.error('[AI] More items generation failed:', error);
        return [];
    }
}

export async function generateAuthorBibliography(author: string): Promise<any[]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return [];

    try {
        console.log(`[AI] Generating bibliography for author: "${author}"`);

        const prompt = `
        You are an expert literary curator.
        The user wants a list of the PRIMARY WORKS (Novels, Major Non-Fiction) by the author: "${author}".

        CRITICAL RULES:
        1.  **NO FLUFF**: Exclude short stories, essays, introductions, forewords, anthologies (unless edited by them and famous), and minor works.
        2.  **NO BIOGRAPHIES**: Do not include biographies ABOUT the author.
        3.  **NO DUPLICATES**: Ensure each book is listed only once.
        4.  **ORDER**: Chronological order of publication (Oldest to Newest).
        5.  **LIMIT**: Return all major works, up to a maximum of 80.
        6.  **COMPREHENSIVENESS**: Ensure you include every single published novel and major collection. Do not be conservative.

        Output format:
        [
            {
                "name": "Book Title",
                "subtitle": "Year (e.g. 1999) - Short description",
                "year": 1999, // Number
                "score": 90
            },
            ...
        ]

        Return valid JSON only. No markdown.
        `;

        const response = await fetchWithRetry(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: "application/json",
                        temperature: 0.2 // Low temp for factual accuracy
                    }
                })
            }
        );

        if (!response.ok) return [];

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return [];

        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const items = JSON.parse(cleanText);

        return Array.isArray(items) ? items : [];

    } catch (error) {
        console.error('[AI] Author bibliography generation failed:', error);
        return [];
    }
}
