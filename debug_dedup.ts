
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { booksProvider } from './lib/books';
import { moviesProvider } from './lib/movies';
import { itunesProvider } from './lib/itunes';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

async function testDeduplication() {
    console.log("=== TESTING BOOK DEDUPLICATION (Vineland) ===");
    const books = await booksProvider.search("Vineland", { author: "Thomas Pynchon" });
    console.log(`Found ${books.length} books.`);
    books.forEach(b => console.log(`- ${b.name} (${b.year}) [${b.id}]`));

    console.log("\n=== TESTING MOVIE DEDUPLICATION (Total Recall) ===");
    // Expecting 1990 version if logic "Keep Earliest" works for exact title match
    const movies = await moviesProvider.search("Total Recall");
    console.log(`Found ${movies.length} movies.`);
    movies.forEach(m => console.log(`- ${m.name} (${m.subtitle}) [${m.id}]`));

    console.log("\n=== TESTING MUSIC DEDUPLICATION (Hey Jude) ===");
    const songs = await itunesProvider.searchAlbums("Hey Jude", { intent: 'song', limit: 10 });
    console.log(`Found ${songs.length} songs.`);
    songs.forEach(s => console.log(`- ${s.name} - ${s.subtitle}`));
}

testDeduplication();
