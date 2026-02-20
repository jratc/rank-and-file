export type Category = 'music' | 'movies' | 'books' | 'places' | 'food' | 'bars' | 'restaurants' | 'other' | 'more';

export interface RankedItem {
    id: string; // The API ID
    name: string;
    subtitle: string; // Artist, Address, or Director
    imageUrl: string | null;
    externalUrl: string | null;
    provider: 'itunes' | 'google' | 'tmdb' | 'custom' | 'wikipedia' | 'google_books' | 'spotify' | 'gemini';
    category?: Category; // Optional for now, but good for tracking
    rank?: number;
    metadata?: any; // Store full object for retrieval
    rawMetadata?: any; // Full raw API response for the item
    [key: string]: any; // Allow additional properties from providers
}

export interface SearchProvider {
    search(query: string): Promise<RankedItem[]>;
}

export interface Comment {
    id: string;
    user_id: string;
    list_id: string;
    content: string;
    created_at: string;
    parent_id?: string | null;
    profiles?: {
        username: string;
        display_name: string;
    };
    replies?: Comment[];
}

// Backward compatibility alias
export type Album = RankedItem;
