export const categoryConfig = {
    music: { label: "MUSIC", color: "text-blue-600" },
    movies: { label: "MOVIES", color: "text-purple-600" },
    books: { label: "BOOKS & LETTERS", color: "text-amber-700" },
    food: { label: "FOOD & DRINK", color: "text-green-600" },
    other: { label: "MORE...", color: "text-slate-600" },
};

export type CategoryKey = keyof typeof categoryConfig;

export interface DashboardProps {
    initialLists: any[];
    currentUserId: string | null;
    currentUsername: string | null;
    currentDisplayName: string | null;
    respondedListIds?: string[];
}

export interface EditSession {
    id: string | null;
    title: string | null;
    isExpanded: boolean;
    isSample?: boolean;
    sampleTitle?: string;
}

export interface ResponseView {
    isOpen: boolean;
    threadData: any[] | null;
    draftId: string | null;
}
