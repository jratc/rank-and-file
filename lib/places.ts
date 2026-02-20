import { RankedItem, Category } from './types';

// ──────────────────────────────────────────────────────────────────
// City nickname / abbreviation → canonical name
// ──────────────────────────────────────────────────────────────────
const CITY_ALIASES: Record<string, string> = {
    // US abbreviations
    'sf': 'San Francisco, CA', 'nyc': 'New York, NY', 'la': 'Los Angeles, CA',
    'dc': 'Washington, DC', 'philly': 'Philadelphia, PA', 'atl': 'Atlanta, GA',
    'chi': 'Chicago, IL', 'nola': 'New Orleans, LA', 'stl': 'St. Louis, MO',
    'lv': 'Las Vegas, NV', 'kc': 'Kansas City, MO', 'slc': 'Salt Lake City, UT',
    'dtw': 'Detroit, MI', 'okc': 'Oklahoma City, OK',
    // Nicknames
    'big apple': 'New York, NY', 'the big apple': 'New York, NY',
    'windy city': 'Chicago, IL', 'the windy city': 'Chicago, IL',
    'city of angels': 'Los Angeles, CA', 'sin city': 'Las Vegas, NV',
    'motor city': 'Detroit, MI', 'steel city': 'Pittsburgh, PA',
    'charm city': 'Baltimore, MD', 'bean town': 'Boston, MA', 'beantown': 'Boston, MA',
    'mile high city': 'Denver, CO', 'emerald city': 'Seattle, WA',
    'golden gate city': 'San Francisco, CA', 'frisco': 'San Francisco, CA',
    'the bay': 'San Francisco Bay Area, CA', 'bay area': 'San Francisco Bay Area, CA',
    'h-town': 'Houston, TX', 'hotlanta': 'Atlanta, GA',
    // International
    'bkk': 'Bangkok, Thailand', 'cdmx': 'Mexico City, Mexico',
    'hk': 'Hong Kong', 'istanbul': 'Istanbul, Turkey',
};

// ──────────────────────────────────────────────────────────────────
// Ambiguous US cities → default to most populated version
// ──────────────────────────────────────────────────────────────────
const AMBIGUOUS_CITIES: Record<string, string> = {
    'portland': 'Portland, OR', 'springfield': 'Springfield, IL',
    'columbus': 'Columbus, OH', 'jacksonville': 'Jacksonville, FL',
    'richmond': 'Richmond, VA', 'birmingham': 'Birmingham, AL',
    'charleston': 'Charleston, SC', 'alexandria': 'Alexandria, VA',
    'florence': 'Florence, Italy', 'venice': 'Venice, Italy',
    'naples': 'Naples, Italy', 'paris': 'Paris, France',
    'london': 'London, UK', 'dublin': 'Dublin, Ireland',
    'manchester': 'Manchester, UK', 'cambridge': 'Cambridge, UK',
    'oxford': 'Oxford, UK', 'brunswick': 'Brunswick, Germany',
    'santiago': 'Santiago, Chile', 'lima': 'Lima, Peru',
    'athens': 'Athens, Greece', 'cairo': 'Cairo, Egypt',
    'melbourne': 'Melbourne, Australia', 'perth': 'Perth, Australia',
    'hamilton': 'Hamilton, New Zealand', 'victoria': 'Victoria, BC, Canada',
    'vancouver': 'Vancouver, BC, Canada',
};

/**
 * Normalize a location string:
 * 1. Resolve city aliases/nicknames
 * 2. Resolve ambiguous cities to their most likely version
 * 3. Strip "near me" (let geocoding handle it)
 */
function normalizeSearchLocation(raw: string | null): string | null {
    if (!raw) return null;

    let loc = raw.trim();

    // Handle "near me" — strip it, we can't resolve it server-side
    if (/^near\s+me$/i.test(loc) || /^around\s+me$/i.test(loc)) {
        return null; // Let Google use default bias
    }

    // Strip "near" prefix for landmarks: "near the eiffel tower" → "eiffel tower"
    loc = loc.replace(/^near\s+(?:the\s+)?/i, '').trim();

    // Check alias dictionary (case-insensitive)
    const aliasKey = loc.toLowerCase();
    if (CITY_ALIASES[aliasKey]) {
        return CITY_ALIASES[aliasKey];
    }

    // Check ambiguous cities — only if no state/country already provided
    const hasQualifier = /,/.test(loc) || /\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/i.test(loc);
    if (!hasQualifier) {
        const ambigKey = loc.toLowerCase();
        if (AMBIGUOUS_CITIES[ambigKey]) {
            return AMBIGUOUS_CITIES[ambigKey];
        }
    }

    return loc;
}

/**
 * Sanitize and structure a Places search query.
 * Strips noise words, resolves city nicknames, and builds a clean query.
 */
function sanitizePlacesQuery(
    typedQuery: string,
    category: Category,
    context?: any
): { textQuery: string; location: string | null; placeType: string; subjectParts: string[] } {
    const typeMap: Record<string, string> = {
        'food': 'restaurant',
        'restaurants': 'restaurant', // legacy
    };
    const placeType = typeMap[category] || 'establishment';

    // Get the subject and location from context
    const subject = typedQuery || context?.subject || '';
    const rawLocation = context?.location || null;
    const cuisine = context?.cuisine || '';

    // Normalize location: resolve nicknames, ambiguous cities, "near me"
    const location = normalizeSearchLocation(rawLocation);

    // Noise words to strip from subject for cleaner queries
    const noisePatterns = [
        /^places?\s+to\s+(?:eat|get|find|try|have|drink)\s*/i,
        /^(?:the\s+)?\d+(?:st|nd|rd|th)\s+best\s+/i,   // "the 3rd best"
        /^top\s+(?:\d+\s+)?(?:rated\s+)?/i,              // "top rated", "top 10"
        /^best\s+/i,
        /^my\s+favorite\s+/i,
        /^favorite\s+/i,
        /^greatest\s+/i,
        /^the\s+best\s+/i,
        /^most\s+\w+\s+/i,                                // "most popular"
        /\s+spots?$/i,
        /\s+places?$/i,
        /\s+joints?$/i,
    ];

    let cleanSubject = subject.trim();
    for (const pattern of noisePatterns) {
        cleanSubject = cleanSubject.replace(pattern, '').trim();
    }

    // Strip atmospheric/time qualifiers that over-constrain the search
    // "quiet vegan sushi" → "vegan sushi", "open at 3am" → stripped
    cleanSubject = cleanSubject
        .replace(/\b(?:quiet|cozy|fancy|cheap|authentic|traditional|modern|trendy|hidden|secret|underground|best|amazing)\s+/gi, '')
        .replace(/\s+(?:open|closes?|closing)\s+(?:at|until|after|before|by)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?/gi, '')
        .replace(/\s+(?:open\s+)?(?:late|early|24.?hours?|all\s+night)/gi, '')
        .trim();

    // If subject is just the category name, clear it
    if (cleanSubject.toLowerCase() === category ||
        cleanSubject.toLowerCase() === category.slice(0, -1) ||
        cleanSubject.toLowerCase() === placeType) {
        cleanSubject = '';
    }

    // Build clean query parts
    const parts: string[] = [];

    // 1. Cuisine or food item (most specific)
    if (cuisine && !cleanSubject.toLowerCase().includes(cuisine)) {
        parts.push(cuisine);
    }

    // 2. The cleaned subject (food item, specific name, etc.)
    if (cleanSubject) {
        parts.push(cleanSubject);
    }

    // 3. Place type — add if nothing else provides context about the type
    const hasTypeContext = /bar|pub|restaurant|cafe|bistro|grill|tavern|lounge|club|diner|eatery/i.test(
        parts.join(' ')
    );
    if (!hasTypeContext && placeType !== 'establishment') {
        parts.push(placeType);
    }

    // 4. Location — always append to the query string for Google text search
    let textQuery = parts.join(' ');
    if (location) {
        textQuery = `${textQuery} in ${location}`;
    }

    // Final cleanup: collapse whitespace
    textQuery = textQuery.replace(/\s+/g, ' ').trim();

    return { textQuery, location, placeType, subjectParts: parts };
}

export async function searchPlaces(query: string, category: Category, context?: any): Promise<RankedItem[]> {
    if (!query && !context?.subject && !context?.location) return [];

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    // sanitizePlacesQuery now returns the raw subject parts too
    const { textQuery: fullQuery, location, placeType, subjectParts } = sanitizePlacesQuery(query, category, context);

    if (apiKey) {
        try {
            console.log(`[searchPlaces] Sanitized query: "${fullQuery}" | Category: ${category} | Type: ${placeType}`);
            console.log(`[searchPlaces] Context:`, JSON.stringify(context));

            // Primary: Text search with location baked into query string
            let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(fullQuery)}&type=${placeType}&key=${apiKey}`;

            // If we have a location, also try geocoding for lat/lng bias
            // This helps when text search doesn't properly scope to the location
            let geoLat: number | null = null;
            let geoLng: number | null = null;
            if (location) {
                try {
                    const geoResp = await fetch(
                        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${apiKey}`,
                        { next: { revalidate: 86400 } }
                    );
                    if (geoResp.ok) {
                        const geoData = await geoResp.json();
                        if (geoData.results?.[0]?.geometry?.location) {
                            geoLat = geoData.results[0].geometry.location.lat;
                            geoLng = geoData.results[0].geometry.location.lng;
                            // Add location bias to help Google scope results
                            url += `&location=${geoLat},${geoLng}&radius=50000`;
                            console.log(`[searchPlaces] Geocoded "${location}" → ${geoLat},${geoLng}`);
                        }
                    }
                } catch (e) {
                    console.error('[searchPlaces] Geocoding failed, continuing without bias:', e);
                }
            }

            const response = await fetch(url);

            if (response.ok) {
                const data = await response.json();

                if (data.results && data.results.length > 0) {
                    let validPlaces = data.results;

                    // Relaxed location filtering
                    // Google Places already handles location in the query,
                    // but we can do a loose filter to remove obviously wrong locations
                    if (location) {
                        const normalizedLoc = normalizeForComparison(location);
                        const locationFiltered = validPlaces.filter((place: any) => {
                            const addr = normalizeForComparison(place.formatted_address || '');
                            return addr.includes(normalizedLoc) || normalizedLoc.split(',')[0] && addr.includes(normalizedLoc.split(',')[0].trim());
                        });
                        // Only apply filter if it doesn't eliminate all results
                        if (locationFiltered.length > 0) {
                            validPlaces = locationFiltered;
                        }
                    }

                    return validPlaces.map((place: any) => {
                        // Better category-based fallback
                        const fallbackUnsplash = category === 'bars' ? 'bar' :
                            category === 'restaurants' || category === 'food' ? 'restaurant' :
                                'place';
                        let imageUrl = `https://images.unsplash.com/photo-category-${fallbackUnsplash}?w=400&h=400&fit=crop`;
                        // Real Unsplash generic fallback for restaurants, bars, etc
                        if (category === 'bars') {
                            imageUrl = 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=400&fit=crop'; // Cocktail/Bar
                        } else if (category === 'restaurants' || category === 'food') {
                            imageUrl = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=400&fit=crop'; // Restaurant
                        } else {
                            imageUrl = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400&h=400&fit=crop'; // Travel/Place
                        }

                        if (place.photos && place.photos.length > 0) {
                            imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${place.photos[0].photo_reference}&key=${apiKey}`;
                        }

                        return {
                            id: `google_${place.place_id}`,
                            name: place.name || 'Unknown Place',
                            subtitle: place.formatted_address || 'Location unavailable',
                            imageUrl: imageUrl,
                            externalUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name || '')}&query_place_id=${place.place_id}`,
                            provider: 'google',
                            category: category,
                            rawMetadata: place
                        };
                    });
                }
            }
        } catch (error) {
            console.error('Google Places search failed, falling back to Photon', error);
        }
    }

    // Fallback to Photon API
    // Construct query with commas instead of "in" for better OSM parsing
    let photonQuery = subjectParts.join(' ');
    if (location) {
        photonQuery = `${photonQuery}, ${location}`;
    } else {
        // Fallback to full query if construction fails
        photonQuery = fullQuery;
    }

    console.log(`Searching Photon fallback for: ${photonQuery}`);
    try {
        const params = new URLSearchParams({
            q: photonQuery,
            limit: '15'
        });

        // Add location bias if we have coordinates (e.g. from client context)? No client coords here yet.
        // Photon can handle location strings in query well if comma separated.

        const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`);
        if (!response.ok) throw new Error('Photon API error');

        const data = await response.json();

        return (data.features || []).map((feature: any, index: number) => {
            const props = feature.properties;
            const name = props.name || props.street || 'Unknown Place';
            const subtitle = [props.street, props.city, props.state, props.country]
                .filter(Boolean)
                .join(', ');

            return {
                id: `photon_${props.osm_id || 'no_id'}_${index}`,
                name: name,
                subtitle: subtitle || 'Address unavailable',
                imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=400&fit=crop',
                externalUrl: `https://www.openstreetmap.org/${props.osm_type}/${props.osm_id}`,
                provider: 'google', // Keep consistent provider ID for UI compatibility
                category: category,
                rawMetadata: props
            };
        });
    } catch (error) {
        console.error('All places search providers failed', error);
        return [];
    }
}

/**
 * Normalize location strings for comparison.
 * Handles "Austin, Texas" vs "Austin, TX" mismatches.
 */
function normalizeForComparison(str: string): string {
    let normalized = str.toLowerCase().trim();

    // State abbreviation mapping for comparison
    const stateAbbrevs: Record<string, string> = {
        'alabama': 'al', 'alaska': 'ak', 'arizona': 'az', 'arkansas': 'ar',
        'california': 'ca', 'colorado': 'co', 'connecticut': 'ct', 'delaware': 'de',
        'florida': 'fl', 'georgia': 'ga', 'hawaii': 'hi', 'idaho': 'id',
        'illinois': 'il', 'indiana': 'in', 'iowa': 'ia', 'kansas': 'ks',
        'kentucky': 'ky', 'louisiana': 'la', 'maine': 'me', 'maryland': 'md',
        'massachusetts': 'ma', 'michigan': 'mi', 'minnesota': 'mn', 'mississippi': 'ms',
        'missouri': 'mo', 'montana': 'mt', 'nebraska': 'ne', 'nevada': 'nv',
        'new hampshire': 'nh', 'new jersey': 'nj', 'new mexico': 'nm', 'new york': 'ny',
        'north carolina': 'nc', 'north dakota': 'nd', 'ohio': 'oh', 'oklahoma': 'ok',
        'oregon': 'or', 'pennsylvania': 'pa', 'rhode island': 'ri', 'south carolina': 'sc',
        'south dakota': 'sd', 'tennessee': 'tn', 'texas': 'tx', 'utah': 'ut',
        'vermont': 'vt', 'virginia': 'va', 'washington': 'wa', 'west virginia': 'wv',
        'wisconsin': 'wi', 'wyoming': 'wy'
    };

    // Replace full state names with abbreviations for uniform comparison
    for (const [full, abbrev] of Object.entries(stateAbbrevs)) {
        normalized = normalized.replace(new RegExp(`\\b${full}\\b`, 'g'), abbrev);
    }

    // Remove common noise
    normalized = normalized.replace(/,\s+/g, ' ').replace(/\s+/g, ' ');

    return normalized;
}
