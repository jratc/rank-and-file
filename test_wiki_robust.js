
async function testWiki() {
    // Test Case: "Texas Mountains" (should not return Tuvalu)
    const context = {
        subject: "Texas Mountains",
        location: null
    };
    const query = ""; // Contextual search

    let searchTerm = query || context.subject || '';
    let finalQuery = searchTerm;
    if (!query && context.location && !searchTerm.toLowerCase().includes(context.location.toLowerCase())) {
        finalQuery = `${searchTerm} ${context.location}`;
    }

    // Explicitly add namespace 0 to query
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(finalQuery)}&gsrnamespace=0&gsrlimit=15&prop=pageimages|extracts&exintro&explaintext&exlimit=max&piprop=thumbnail&pithumbsize=400&format=json&origin=*`;

    console.log(`Fetching: ${wikiUrl}`);
    const res = await fetch(wikiUrl);
    const data = await res.json();

    if (data.query && data.query.pages) {
        const pages = Object.values(data.query.pages);
        const sorted = pages.sort((a, b) => (a.index || 0) - (b.index || 0));

        // Mimic new filter logic
        const filtered = sorted.filter(page => {
            if (page.title.toLowerCase().includes('disambiguation')) return false;
            if (page.title.toLowerCase().includes('list of')) return true;
            if (!page.extract) return false;
            if (page.extract.includes('may refer to:')) return false;
            return true;
        });

        console.log("\n--- Filtered & Sorted Order ---");
        filtered.forEach((p) => console.log(`${p.index}: ${p.title} (ID: ${p.pageid})`));
    } else {
        console.log("No results");
    }
}

testWiki();
