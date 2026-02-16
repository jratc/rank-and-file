'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { RankingList } from "./ranking-list";
import { searchEntities, addToList } from "@/app/search/actions";
import { RankedItem, Category } from "@/lib/types";
import { toast } from 'sonner';
import { extractContext } from "@/lib/utils";

interface ResponseEditorProps {
    listId: string;
    userId: string;
    initialItems: any[];
    category: string;
    contextTitle?: string;
    onClose?: () => void;
}

export function ResponseEditor({ listId, userId, initialItems, category, contextTitle, onClose }: ResponseEditorProps) {
    const [items, setItems] = useState<any[]>(initialItems);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<RankedItem[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [addingItemId, setAddingItemId] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    // Sync initialItems if they change (e.g. parent refetch)
    useEffect(() => {
        setItems(initialItems);
    }, [initialItems]);

    const handleSearch = useCallback(async (query: string, forceContext = false, pageNum = 1) => {
        if (!query.trim() && !forceContext) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            // Context is less relevant for a response unless we assume same context as parent. 
            // But we don't have parent title here. 
            // Let's just use empty context or basic category context.
            // Extract clean context from the title (e.g. "Best Sci-Fi Movies" -> "Sci-Fi")
            const extracted = extractContext(contextTitle || '', category);

            const searchContext = {
                ...extracted, // Pass ALL extracted fields (subject, location, cuisine, actor, director, etc.)
                category: category,
                limit: 50,
                offset: (pageNum - 1) * 50
            };
            // For pre-fetch: determine the right query based on context
            let finalQuery = query;
            if (!query.trim() && forceContext) {
                const hasSpecialMovieContext = category === 'movies' && (extracted.actor || extracted.director);
                if (hasSpecialMovieContext) {
                    finalQuery = ''; // Let movies provider use Discover API
                } else if (extracted.subject) {
                    finalQuery = extracted.subject;
                }
            }

            const results = await searchEntities(finalQuery, category as Category, searchContext);

            if (pageNum === 1) {
                setSearchResults(results);
            } else {
                setSearchResults(prev => [...prev, ...results]);
            }
            setHasMore(results.length >= 50);

        } catch (error) {
            toast.error("Search failed");
        } finally {
            setIsSearching(false);
        }
    }, [category, contextTitle]);

    // Debounced Search
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }
        const timer = setTimeout(() => {
            setPage(1);
            handleSearch(searchQuery, false, 1);
        }, 400);

        return () => clearTimeout(timer);
    }, [searchQuery, handleSearch]);

    // Trigger initial contextual search on mount
    useEffect(() => {
        handleSearch('', true);
    }, []);

    const handleAddItem = async (item: RankedItem) => {
        setAddingItemId(item.id);
        try {
            const result = await addToList(item, listId);
            if (result.success) {
                toast.success(`Added ${item.name}`);
                setItems(prev => [...prev, result.item]);
                setSearchResults([]);
                setSearchQuery('');
            } else {
                toast.error(result.error || "Failed to add item");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setAddingItemId(null);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-950">
            {/* Search Header */}
            <div className="p-4 border-b border-slate-100 dark:border-white/5 bg-white dark:bg-white/[0.02] relative z-20">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/10 uppercase font-bold tracking-tight"
                        placeholder={`SEARCH ${category}...`}
                    />
                    {isSearching && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                        </div>
                    )}
                </div>

                {/* Dropdown Results */}
                {searchResults.length > 0 && (
                    <div
                        className="absolute left-4 right-4 mt-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-xl shadow-2xl z-50 p-1 max-h-[300px] overflow-y-auto"
                    >
                        {searchResults.map((item) => (
                            <div
                                key={item.id}
                                onClick={() => handleAddItem(item)}
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer group transition-colors"
                            >
                                <div className="w-10 h-10 rounded bg-slate-100 dark:bg-white/10 overflow-hidden shrink-0">
                                    {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">{item.name}</div>
                                    <div className="text-[10px] text-slate-400 truncate uppercase font-mono">{item.subtitle}</div>
                                </div>
                                {addingItemId === item.id && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
                <RankingList
                    listId={listId}
                    initialItems={items}
                    category={category}
                    onChange={setItems} // Keep local state in sync
                />
            </div>

            {/* Footer with Actions if needed */}
            <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-black/20 flex justify-end">
                <Button onClick={onClose} variant="ghost" size="sm" className="mr-2">CLOSE</Button>
                <Button onClick={onClose} variant="default" size="sm" className="bg-yellow-400 text-black hover:bg-yellow-500 font-bold tracking-wider">DONE</Button>
            </div>
        </div>
    );
}
