
import { extractContext } from './lib/utils';
import { booksProvider } from './lib/books';

async function test() {
    console.log("--- Testing Roth Books ---");

    // Test case from user (with typo)
    const title = "Phillp Roth Books, Ranked";

    // 1. Extraction
    const context = extractContext(title, 'books');
    console.log("Title:", title);
    // context.author should be "Phillp Roth"
    console.log("Context Author:", context.author);

    if (context.author) {
        console.log(`\nSearching for author: "${context.author}"`);
        const items = await booksProvider.getBooksByAuthor(context.author);
        console.log(`Found ${items.length} items:`);
        items.slice(0, 5).forEach(i => console.log(`- ${i.name} (${i.subtitle})`));

        // Validation: Check if "American Pastoral" or "Human Stain" is in the list
        const passed = items.some(i => i.name.includes('American Pastoral') || i.name.includes('Human Stain') || i.name.includes('Portnoy'));
        console.log(`\nValidation Passed: ${passed}`);
    } else {
        console.log("\nNo author detected.");
    }
}

test();
