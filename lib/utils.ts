import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface SearchContext {
  subject: string | null;
  location: string | null;
  intent?: 'song' | 'album' | 'movie' | 'place' | 'book' | 'general' | 'list';
  category?: string;
  artist?: string;
  genre?: string;
  cuisine?: string;
  director?: string;
  actor?: string;
  author?: string;
  year?: number;
  limit?: number;
}

/**
 * Extracts structured context from a list title.
 * e.g. "Best Pizza in Chicago" -> { subject: "Pizza", location: "Chicago", intent: "place" }
 * e.g. "Beyonce Songs" -> { subject: "Beyonce", intent: "song", artist: "Beyonce" }
 * e.g. "Jazz Albums" -> { subject: "Jazz", intent: "album", genre: "Jazz" }
 * e.g. "Bars in Austin Texas" -> { subject: "bars", location: "Austin, Texas", intent: "place" }
 * e.g. "Movies with Bill Murray" -> { subject: "Bill Murray", intent: "movie", actor: "Bill Murray" }
 */
export function extractContext(title: string, category?: string): SearchContext {
  if (!title) return { subject: null, location: null };

  // 1. Clean Title Logic
  let cleanTitle = title.trim();

  // Remove "Ranked" suffix and other trailing noise
  cleanTitle = cleanTitle.replace(/[\s,]+ranked$/i, '');
  cleanTitle = cleanTitle.replace(/[\s,]+tier\s+list$/i, '');
  cleanTitle = cleanTitle.replace(/[^\w\s)]+$/, ''); // Trailing punctuation (except parens)

  // Extract Limit (Count) - e.g. "Top 10 Movies", "7 Wonders"
  let limit: number | undefined;
  const limitMatch = cleanTitle.match(/^(?:top|best|the)?\s*(\d+)\s+(.+)$/i);

  if (limitMatch) {
    const num = parseInt(limitMatch[1], 10);
    const remainder = limitMatch[2].trim();

    // Heuristic: If it was "Top 10 X", the subject is X. 
    // If it was "7 X" (e.g. 7 Wonders), the subject might be "7 X".
    // Let's store the limit, but be careful about stripping it from subject.
    // If the prefix was "Top" or "Best", definitely strip.
    if (limitMatch[0].match(/^(?:top|best)/i)) {
      limit = num;
      cleanTitle = remainder;
    } else {
      // It was just "7 Wonders" or "100 Gecs". 
      // Check if "7 Wonders" is a specific thing? 
      // For now, let's treat "Number + Noun" as the subject itself (don't strip), 
      // BUT still record the limit as a hint.
      limit = num;
      // Don't update cleanTitle, keep "7 Wonders..."
    }
  }

  // Common Prefix Noise Removal (if not handled above)
  const noise = [
    /^the\s+best\s+/i,
    /^best\s+/i,
    /^my\s+/i, // Changed from /^my\s+favorite\s+/i
    // Removed /^top\s+\d+\s+/i as it's handled by limitMatch
    /^ranking\s+of\s+/i,
    /^a\s+list\s+of\s+/i,
    /^list\s+of\s+/i,
    /^ranked\s+/i, // Added
    /^favorite\s+/i,
    /^greatest\s+/i,
    /^the\s+/i,
    /\s+ranking$/i
  ];

  // Apply common prefix noise removal
  for (const pattern of noise) {
    cleanTitle = cleanTitle.replace(pattern, '');
  }

  // Detect "with [Person]" pattern BEFORE location matching to avoid confusion
  // e.g. "Movies with Bill Murray" -> actor = "Bill Murray"
  let actor: string | undefined = undefined;
  const withMatch = cleanTitle.match(/\s+(?:with|starring|featuring)\s+([A-Za-z\s]+)$/i);
  if (withMatch) {
    actor = withMatch[1].trim();
    cleanTitle = cleanTitle.replace(withMatch[0], '').trim();
  }

  // Detect "that start with [Letter]" pattern - just strip it from context
  const startsWithMatch = cleanTitle.match(/\s+that\s+start(?:s)?\s+with\s+\w+$/i);
  if (startsWithMatch) {
    cleanTitle = cleanTitle.replace(startsWithMatch[0], '').trim();
  }

  // Detect "I love", "I like", etc - strip personal phrases
  cleanTitle = cleanTitle.replace(/\s+i\s+(?:love|like|enjoy|hate|prefer)$/i, '').trim();

  // Detect location (matches "in [Location]" or "near [Location]")
  // Allow commas in location so "bars in houston, texas" captures full location
  const locationMatch = cleanTitle.match(/\s+(?:in|near|at|around)\s+([^;!?]+)$/i);
  let location = locationMatch ? locationMatch[1].trim() : null;
  let subject = locationMatch ? cleanTitle.replace(locationMatch[0], '').trim() : cleanTitle;
  const lowerSubject = subject.toLowerCase();

  // Normalize location: "Austin Texas" -> "Austin, Texas"
  // Insert comma before US state names if missing
  if (location) {
    location = normalizeLocation(location);
  }

  // Detect intent
  let intent: SearchContext['intent'] = undefined;
  if (/songs?|tracks?|singles?/i.test(title)) intent = 'song';
  else if (/albums?/i.test(title)) intent = 'album';
  else if (/movies?|films?/i.test(title)) intent = 'movie';
  else if (/books?|novels?|reads?|biographies|memoirs/i.test(title)) intent = 'book';
  else if (/restaurants?|bars?|pubs?|places?\s+to\s+(?:eat|get|find|try|have|drink)/i.test(title)) intent = 'place';

  // Detect "places to eat/get/find" -> extract the food item and set as cuisine-subject
  const placesToPattern = title.match(/places?\s+to\s+(?:eat|get|find|try|have|drink)\s+(.*?)(?:\s+(?:in|near|at|around)\s|$)/i);
  if (placesToPattern) {
    // e.g. "places to get idlis in Germany" -> foodItem = "idlis"
    const foodItem = placesToPattern[1]?.trim();
    subject = foodItem || 'restaurant';
    intent = 'place';
  } else if (/places?\s+to\s+eat/i.test(title)) {
    subject = 'restaurant';
    intent = 'place';
  }

  // 1. Detect Cuisines (for Places/Food)
  const cuisines = [
    'spaghetti', 'pasta', 'polish', 'mexican', 'italian', 'chinese', 'japanese', 'thai', 'indian', 'french', 'greek', 'spanish', 'korean', 'vietnamese', 'turkish', 'lebanese', 'american', 'ethiopian', 'moroccan', 'peruvian', 'brazilian', 'jamaican', 'caribbean', 'african', 'mediterranean', 'middle eastern', 'burger', 'pizza', 'sushi', 'tacos', 'ramen', 'pho', 'bbq', 'seafood', 'steak', 'vegan', 'vegetarian',
    'idli', 'idlis', 'dosa', 'biryani', 'shawarma', 'falafel', 'kebab', 'dim sum', 'dumpling', 'dumplings', 'poke', 'bao', 'pad thai', 'curry', 'tikka', 'gyoza', 'udon', 'soba', 'tempura', 'ceviche', 'empanada', 'arepa', 'taco', 'burrito', 'enchilada', 'pupusa', 'pierogi', 'schnitzel', 'bratwurst', 'croissant', 'crepe', 'banh mi', 'satay', 'rendang', 'laksa', 'naan', 'hummus', 'moussaka', 'paella'
  ];
  let cuisine: string | undefined = undefined;
  const detectedCuisine = cuisines.find(c => lowerSubject.includes(c));
  if (detectedCuisine) {
    cuisine = detectedCuisine;
    // Map food items to cuisine type for better search
    if (['spaghetti', 'pasta'].includes(detectedCuisine)) cuisine = 'italian';
  }

  // 2. Detect Directors (for Movies)
  let director: string | undefined = undefined;
  let year: number | undefined = undefined; // Added definition
  if (intent === 'movie' || category === 'movies') {
    const directorMatch = cleanTitle.match(/(?:films|movies)\s+(?:by|from)\s+([A-Za-z\s]+)$/i) ||
      cleanTitle.match(/^([A-Za-z\s]+)\s+(?:films|filmography|movies)$/i);
    if (directorMatch) {
      director = directorMatch[1].trim();
    }
  }

  // 3. Detect Universal Intent (Books, Wiki) - fallback
  if ((!category || category === 'other') && !intent) {
    if (/books?|novels?|reads?/i.test(title)) {
      intent = 'book';
    }
  }

  // 4. Common Music Genres for Detection
  const genres = [
    'jazz', 'rock', 'pop', 'hip hop', 'rap', 'classical', 'blues', 'country', 'electronic', 'dance', 'metal', 'folk', 'indie', 'punk', 'reggae', 'soul', 'r&b'
  ];
  let genre: string | undefined = undefined;
  const detectedGenre = genres.find(g => lowerSubject.includes(g));
  if (detectedGenre) {
    genre = detectedGenre;
  }

  // Strip category/intent noise from subject to isolate the core entity (Artist/Genre/Topic)
  // BUT for places categories (bars, restaurants, places), keep the category word as it's meaningful for search
  // Update core entity stripping
  const isPlacesCategory = category === 'food' || category === 'places';
  let coreEntity = subject;

  if (category || intent) {
    const musicPatterns = [
      /\s+albums?$/i,
      /\s+songs?$/i,
      /\s+tracks?$/i,
      /\s+discography$/i,
    ];
    // If we are in music, strip these common suffixes
    if (category === 'music' || intent === 'song' || intent === 'album') {
      // 1. Check for "Albums by [Artist]" prefix pattern first
      const byMatch = cleanTitle.match(/^(?:albums|songs|tracks|discography)\s+(?:by|from)\s+(.+)$/i);
      if (byMatch) {
        coreEntity = byMatch[1].trim();
        // If we found "Albums by X", X is definitely the artist
        // We can set it immediately or let fall-through logic handle it?
        // Let's rely on standard logic but ensuring coreEntity is clean helps.
      } else {
        // 2. Strip suffixes if no prefix match
        for (const pattern of musicPatterns) {
          coreEntity = coreEntity.replace(pattern, '').trim();
        }
      }
    }

    // Strip movie-related words from subject for movies category
    if (category === 'movies' || intent === 'movie') {
      const moviePatterns = [
        /\s*movies?$/i,
        /\s*films?$/i,
      ];
      for (const pattern of moviePatterns) {
        coreEntity = coreEntity.replace(pattern, '').trim();
      }
    }

    // For places categories, DON'T strip the category word — keep "bars", "restaurants" 
    // as they are meaningful for Google Places search type
    if (!isPlacesCategory && category) {
      const categorySingular = category.endsWith('s') ? category.slice(0, -1) : category;
      const catPatterns = [
        new RegExp(`\\s+${category}$`, 'i'),
        new RegExp(`\\s+${categorySingular}$`, 'i'),
      ];
      for (const pattern of catPatterns) {
        coreEntity = coreEntity.replace(pattern, '').trim();
      }
    }
  }

  // If we found a genre, the subject is likely just the genre. 
  // But if we DIDN'T find a genre, and it's music context, the remainder is likely an Artist.
  let artist: string | undefined = undefined;
  if ((category === 'music' || intent === 'song' || intent === 'album') && !genre && coreEntity.length > 0) {
    artist = coreEntity;
  }

  // Heuristic: If in movies category and the cleaned title is just a proper name
  // (2-3 capitalized words, no genre/intent keywords detected), treat as ACTOR/DIRECTOR candidate
  if (!director && !actor && !genre && category === 'movies') {
    const nameWords = coreEntity.split(/\s+/);
    // Allow mixed case (e.g. "robert duvall", "Robert duvall")
    // Just ensure they are words with letters.
    // UPDATE: Allow single words (e.g. "Almodovar", "Hitchcock") if the pattern is strong ("[Name] movies")
    const isProperName = nameWords.length >= 1 && nameWords.length <= 4 &&
      nameWords.every(w => /^[a-zA-Z\u00C0-\u00FF]+$/.test(w));

    if (isProperName) {
      // It's ambiguous (could be director or actor), but "Robert Duvall" is usually searched as an actor.
      // Let's set it as `actor` primarily, as `moviesProvider` can handle person search.
      actor = coreEntity;
    }
  }

  // If we have a director pattern, the core entity IS the director
  if (director) {
    coreEntity = director;
  }

  // If we have an actor from "with [Person]", use that as subject for movie searches
  if (actor && (intent === 'movie' || category === 'movies')) {
    coreEntity = actor;
  }

  // Detect Authors for Books
  let author: string | undefined = undefined;
  if (intent === 'book' || category === 'books') {
    const authorMatch = cleanTitle.match(/(?:books|novels)\s+(?:by|from|written by)\s+([A-Za-z\s]+)$/i) ||
      cleanTitle.match(/^([A-Za-z\s]+)\s+(?:books|novels|bibliography)$/i);
    if (authorMatch) {
      author = authorMatch[1].trim();
      // If we found an explicit author pattern, make that the core entity
      coreEntity = author;
    }
  }

  return {
    subject: coreEntity.length > 0 ? coreEntity : null,
    location,
    intent: intent as any,
    category,
    artist,
    genre,
    cuisine,
    director,
    year,
    limit,
    actor,
    author
  };
}


/**
 * Calculate similarity between two lists of items.
 * Uses Jaccard Index based on normalized item names/subtitles.
 * Returns percentage (0-100).
 */
export function calculateSimilarity(itemsA: any[], itemsB: any[]): number {
  if (!itemsA?.length || !itemsB?.length) return 0;

  const getComparableKey = (item: any) => {
    if (!item) return null;

    // Use name + subtitle as the primary comparable key.
    // This is more robust than IDs when items are added from search results.
    const name = (item.metadata?.name || item.name || '').toLowerCase().trim();
    const sub = (item.metadata?.subtitle || item.subtitle || '').toLowerCase().trim();

    if (!name && !sub) return null;
    return `${name}|${sub}`;
  };

  const keysA = itemsA.map(getComparableKey);
  const keysB = itemsB.map(getComparableKey);

  let exactMatches = 0;
  // We compare relative to the original list length (A)
  const originalCount = keysA.length;

  // Position-based matching: Item at rank I must match item at rank I
  for (let i = 0; i < originalCount; i++) {
    const keyA = keysA[i];
    const keyB = keysB[i];

    if (keyA && keyB && keyA === keyB) {
      exactMatches++;
    }
  }

  return Math.round((exactMatches / originalCount) * 100);
}

function normalizeLocation(loc: string): string {
  const usStates: Record<string, string> = {
    'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
    'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
    'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
    'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
    'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
    'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
    'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
    'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
    'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
    'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
    'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
    'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
    'wisconsin': 'WI', 'wyoming': 'WY',
    'north america': 'North America', 'south america': 'South America',
  };

  // Check if the last word(s) are a state name and add a comma
  const words = loc.split(/\s+/);
  for (let i = words.length - 1; i >= 1; i--) {
    const possibleState = words.slice(i).join(' ').toLowerCase();
    if (usStates[possibleState]) {
      const city = words.slice(0, i).join(' ');
      return `${city}, ${words.slice(i).join(' ')}`;
    }
  }

  return loc;
}
