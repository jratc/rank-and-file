
async function testWiki() {
    const searchTerm = "texas mountains";
    // Using the exact URL from the universal provider
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(searchTerm)}&gsrlimit=15&prop=pageimages|extracts&exintro&explaintext&exlimit=max&piprop=thumbnail&pithumbsize=400&format=json&origin=*`;

    console.log(`Fetching: ${wikiUrl}`);
    const res = await fetch(wikiUrl);
    const data = await res.json();

    if (data.query && data.query.pages) {
        const pages = Object.values(data.query.pages);
        // Log titles and indices
        pages.forEach((p) => {
            console.log(`Page: ${p.title}, Index: ${p.index}, PageId: ${p.pageid}`);
        });

        // The sort logic from the code
        const sorted = pages.sort((a, b) => (a.index || 0) - (b.index || 0));
        console.log("\n--- Sorted Order ---");
        sorted.forEach((p) => console.log(`${p.index}: ${p.title}`));
    } else {
        console.log("No results");
    }
}

testWiki();
