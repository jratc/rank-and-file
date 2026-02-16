
import { extractContext } from './lib/utils';
import { moviesProvider } from './lib/movies';

async function test() {
    console.log("--- Testing Movie Genres ---");

    // Test case
    const title = "Top 10 Comedy Movies";
    const context = extractContext(title, 'movies');
    console.log("Context:", JSON.stringify(context, null, 2));

    if (context.genre) {
        console.log(`Searching for genre: "${context.genre}" with limit: ${context.limit}`);
        const items = await moviesProvider.getMoviesByGenre(context.genre, context.limit);
        console.log(`Found ${items.length} items:`);
        items.slice(0, 5).forEach(i => console.log(`- ${i.name} (${i.subtitle})`));
    } else {
        console.log("No genre detected.");
    }
}

test();
