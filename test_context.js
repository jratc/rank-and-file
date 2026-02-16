
// Self-contained test

// Actually, let's just copy the function into the script for isolation, 
// OR use a quick TS compile. But since I can't use tsx, I'll copy the logic or try to run with node --loader ts-node/esm if available?
// Easier to just reproduce the logic in the script or copy-paste the function.

function extractContext(title, category) {
    if (!title) return { subject: null, location: null };

    const noise = [
        /^the\s+best\s+/i,
        /^best\s+/i,
        /^my\s+favorite\s+/i,
        /^top\s+\d+\s+/i,
        /^ranking\s+of\s+/i,
        /^a\s+list\s+of\s+/i,
        /^list\s+of\s+/i,
        /^favorite\s+/i,
        /^greatest\s+/i,
        /^the\s+/i,
        /\s+ranking$/i
    ];

    let cleanTitle = title.trim();
    for (const pattern of noise) {
        cleanTitle = cleanTitle.replace(pattern, '');
    }

    const locationMatch = cleanTitle.match(/\s+(?:in|near|at|around)\s+([^;!?]+)$/i);
    let location = locationMatch ? locationMatch[1].trim() : null;
    let subject = locationMatch ? cleanTitle.replace(locationMatch[0], '').trim() : cleanTitle;

    return { subject, location, category };
}

console.log("Texas Mountains:", extractContext("Texas Mountains", "other"));
console.log("Mountains in Texas:", extractContext("Mountains in Texas", "other"));
console.log("The Best Texas Mountains:", extractContext("The Best Texas Mountains", "other"));
