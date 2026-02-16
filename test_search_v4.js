
const { extractContext } = require('./lib/utils');

const tests = [
    { title: "Best Polish Food in LA", category: "places", expected: { cuisine: "polish", location: "LA", subject: "Polish Food" } },
    { title: "Mexican Restaurants in Chicago", category: "places", expected: { cuisine: "mexican", location: "Chicago" } },
    { title: "Almodovar Films", category: "movies", expected: { director: "Almodovar", intent: "movie" } },
    { title: "Films by Scorsese", category: "movies", expected: { director: "Scorsese", intent: "movie" } },
    { title: "Best Books about Space", category: "other", expected: { intent: "book", subject: "Space" } },
    { title: "Types of Cats", category: "other", expected: { subject: "Types of Cats" } } // Should NOT be book
];

console.log("Running Search V4 Context Tests...\n");

tests.forEach(test => {
    const result = extractContext(test.title, test.category);
    console.log(`[${test.title}]`);

    let pass = true;
    for (const [key, val] of Object.entries(test.expected)) {
        if (result[key] !== val && !(key === 'subject' && result.subject?.includes(val))) {
            console.log(`❌ Expected ${key}='${val}', got '${result[key]}'`);
            pass = false;
        }
    }

    if (pass) console.log("✅ PASS");
    else console.log("JSON Result:", JSON.stringify(result, null, 2));
    console.log('---');
});
