'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, MessageCircle, Share2, Copy, Mail, Twitter, Facebook, Cloud, Trash2, Search, Loader2, Sparkles, Plus } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { RankingList } from "./ranking-list";
import { CommentModal } from "./comment-modal";
import { getThread, deleteList } from "@/app/actions";
import { toast } from 'sonner';
import { calculateSimilarity } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { searchEntities, addToList } from "@/app/search/actions";
import { detectAndPopulateList, populateBackgroundItems } from '@/app/populate';
import { extractContext } from "@/lib/utils";
import { RankedItem, Category } from "@/lib/types";
import { itemsToPlaces, PlacesMap } from "@/components/places-map";
import { useRouter } from 'next/navigation';

interface ResponseSplitViewProps {
    thread: any[]; // [Root, Response1, Response2...]
    initialDraftId?: string | null;
    onClose: () => void;
    currentUserId: string;
    currentUsername?: string | null;
    currentDisplayName?: string | null;
    onStartResponse?: (parentListId: string) => void;
}

export function ResponseSplitView({ thread, initialDraftId, onClose, currentUserId, currentUsername, currentDisplayName, onStartResponse }: ResponseSplitViewProps) {
    const rootList = thread[0];
    const [currentIndex, setCurrentIndex] = useState(() => {
        if (initialDraftId) {
            const index = thread.findIndex(l => l.id === initialDraftId);
            return index > 0 ? index : 1;
        }
        return thread.length > 1 ? 1 : 0; // Fallback if no responses (though shouldn't happen)
    });

    const [commentModal, setCommentModal] = useState<{ isOpen: boolean; listId: string | null; listTitle: string; userId: string | null; }>({ isOpen: false, listId: null, listTitle: "", userId: null });
    const [showShareOptions, setShowShareOptions] = useState(false);

    // Editing title state
    const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
    const [editTitleValue, setEditTitleValue] = useState("");

    const currentResponse = thread[currentIndex] || rootList;

    const matchPercentage = currentIndex > 0 && rootList
        ? calculateSimilarity(rootList.list_items, currentResponse.list_items)
        : null;

    const isDraft = initialDraftId ? currentResponse.id === initialDraftId : false;

    // Search & Populating State
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchResultsRef = useRef<HTMLDivElement>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isPopulating, setIsPopulating] = useState(false);
    const [populatedCount, setPopulatedCount] = useState(0);

    const handleSearch = useCallback(async (query: string, pageNum = 1) => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const context = extractContext(currentResponse.title, currentResponse.category);
            const searchContext = { ...context, limit: 50, offset: (pageNum - 1) * 50 };
            const results = await searchEntities(query, currentResponse.category as Category, searchContext);

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
    }, [currentResponse]);

    const handleAddItem = async (item: RankedItem) => {
        try {
            const result = await addToList(item, currentResponse.id);
            if (result.success) {
                toast.success(`Added ${item.name}`);
                setSearchResults([]);
                setSearchQuery('');
                router.refresh(); // Refresh to get the new items in the thread prop
            } else {
                toast.error(result.error || "Failed to add item");
            }
        } catch (error) {
            toast.error("An error occurred");
        }
    };

    const startEarlyPopulation = async () => {
        if (isPopulating) return;
        setIsPopulating(true);
        setPopulatedCount(0);

        try {
            const popResult = await detectAndPopulateList(currentResponse.id, currentResponse.title, currentResponse.category);
            if (popResult.populated) {
                setPopulatedCount(popResult.count);
                if (popResult.count < 80 && !popResult.isComplete) {
                    populateBackgroundItems(currentResponse.id, currentResponse.title, currentResponse.category, popResult.count)
                        .then(() => router.refresh())
                        .catch(() => { });
                } else {
                    router.refresh();
                }
            }
        } catch (error) {
            console.error("Population failed:", error);
        } finally {
            setIsPopulating(false);
        }
    };

    const nextItem = () => setCurrentIndex(prev => Math.min(prev + 1, thread.length - 1));
    const prevItem = () => setCurrentIndex(prev => Math.max(prev - 1, 0));

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || (document.activeElement as HTMLElement)?.isContentEditable) return;
            if (e.key === 'ArrowLeft') prevItem();
            if (e.key === 'ArrowRight') nextItem();
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [thread.length]);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    if (!rootList) return null;

    const renderListCard = (list: any, isRoot: boolean) => {
        const isOwner = currentUserId === list.user_id;

        return (
            <div className={`flex flex-col relative w-full h-full lg:w-[450px] shrink-0 min-h-0`}>
                <div className={`bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border-2 ${isRoot ? 'border-slate-200 dark:border-white/10' : 'border-blue-200 dark:border-blue-500/30'} flex flex-col h-full w-full`}>

                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] shrink-0">
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex flex-col flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${isRoot ? 'text-slate-500' : 'text-blue-500'}`}>
                                        {isRoot ? "ORIGINAL LIST" : `RESPONSE #${currentIndex}`}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        BY {list.profiles?.display_name || list.profiles?.username || 'GUEST'}
                                    </span>
                                    {!isRoot && matchPercentage !== null && (
                                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">
                                            {matchPercentage}% Match
                                        </span>
                                    )}
                                </div>

                                {editingTitleId === list.id ? (
                                    <Input
                                        autoFocus
                                        value={editTitleValue}
                                        onChange={(e) => setEditTitleValue(e.target.value.toUpperCase())}
                                        onBlur={() => {
                                            if (editTitleValue.trim() && editTitleValue.trim() !== list.title.toUpperCase()) {
                                                // Trigger update list title (could hook into app/actions here)
                                                // Skipping optimistic update for simplicity, in a real app would call updateListTitle
                                            }
                                            setEditingTitleId(null);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') setEditingTitleId(null);
                                            if (e.key === 'Escape') setEditingTitleId(null);
                                        }}
                                        className="text-xl font-black uppercase tracking-tighter leading-[0.9] h-8 p-0 border-none focus-visible:ring-0"
                                    />
                                ) : (
                                    <h2
                                        onClick={() => {
                                            if (isOwner && !isDraft) {
                                                setEditTitleValue(list.title.toUpperCase());
                                                setEditingTitleId(list.id);
                                            }
                                        }}
                                        className={`text-xl font-black uppercase tracking-tighter leading-[0.9] text-slate-800 dark:text-slate-100 line-clamp-2 break-words ${isOwner && !isDraft ? 'cursor-text hover:text-slate-500' : ''}`}
                                    >
                                        {list.title}
                                    </h2>
                                )}
                            </div>

                            {/* Share button (only needed on one, let's put it on Root or if it's the response) */}
                            {!isRoot && (
                                <div className="flex items-center gap-2 shrink-0">
                                    <Button
                                        variant="ghost" size="icon"
                                        className="h-8 w-8 text-slate-400 hover:text-slate-900"
                                        onClick={(e) => { e.stopPropagation(); setShowShareOptions(!showShareOptions); }}
                                    >
                                        <Share2 className="h-4 w-4" />
                                    </Button>
                                    {isOwner && (
                                        <Button
                                            variant="ghost" size="icon"
                                            className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                            onClick={async () => {
                                                if (confirm('Delete this response?')) {
                                                    await deleteList(list.id);
                                                    onClose();
                                                    window.location.reload();
                                                }
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Search Section Inside Header - Only for Draft */}
                        {isDraft && !isPopulating && (
                            <div className="mt-4">
                                <form onSubmit={(e) => { e.preventDefault(); handleSearch(searchQuery); }} className="relative group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300 group-focus-within:text-black transition-colors" />
                                    <Input
                                        ref={searchInputRef}
                                        placeholder={`Add to list...`}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="h-8 pl-9 pr-20 bg-slate-50 border-none rounded-lg text-xs font-bold focus:bg-white focus:ring-1 focus:ring-slate-200 transition-all"
                                    />
                                    <div className="absolute right-1 top-1 bottom-1">
                                        <Button
                                            type="submit"
                                            size="sm"
                                            disabled={isSearching || !searchQuery.trim()}
                                            className="h-full px-3 rounded-md font-black text-[9px] tracking-widest uppercase bg-white border border-slate-200 text-slate-900 hover:bg-slate-50"
                                        >
                                            {isSearching ? <Loader2 className="h-3 w-3 animate-spin text-slate-400" /> : 'SEARCH'}
                                        </Button>
                                    </div>
                                </form>

                                {/* Search Results Dropdown-style */}
                                {searchResults.length > 0 && (
                                    <div
                                        ref={searchResultsRef}
                                        className="absolute left-5 right-5 mt-1 bg-white border border-slate-100 rounded-xl shadow-2xl z-50 p-1 max-h-[300px] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in duration-200"
                                        onScroll={(e) => {
                                            const target = e.currentTarget;
                                            if (target.scrollHeight - target.scrollTop <= target.clientHeight + 50 && !isSearching && hasMore) {
                                                const nextPage = page + 1;
                                                setPage(nextPage);
                                                handleSearch(searchQuery, nextPage);
                                            }
                                        }}
                                    >
                                        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-50 mb-1">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Search Results</span>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => setSearchResults([])}
                                                    className="text-[9px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-700"
                                                >
                                                    Close
                                                </button>
                                            </div>
                                        </div>
                                        <div className="space-y-0.5">
                                            {searchResults.map((item) => (
                                                <div
                                                    key={item.id}
                                                    onClick={() => handleAddItem(item)}
                                                    className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer group border border-transparent"
                                                >
                                                    <div className="w-7 h-7 rounded bg-slate-100 overflow-hidden shrink-0">
                                                        {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-[11px] text-slate-900 truncate group-hover:text-black">{item.name}</div>
                                                        <div className="text-[9px] text-slate-600 truncate uppercase font-medium">{item.subtitle}</div>
                                                    </div>
                                                </div>
                                            ))}
                                            {isSearching && page > 1 && (
                                                <div className="p-2 text-center text-[10px] text-slate-400">Loading more...</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div> {/* This closes the header div */}

                    {/* Author Note */}
                    {(() => {
                        const authorNote = list.comments?.find((c: any) => c.user_id === list.user_id);
                        if (!authorNote) return null;
                        return (
                            <div className="px-6 py-3 bg-slate-50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/5">
                                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 italic">"{authorNote.content}"</p>
                            </div>
                        );
                    })()}

                    {/* List Content */}
                    <div className="flex-1 overflow-y-auto p-2 md:p-4 scrollbar-hide bg-slate-50 dark:bg-black/20">
                        {/* INLINE AI NUDGE - Only for Draft, only for More/Places category, only when empty and not populating */}
                        {isDraft && list.list_items?.length === 0 && !isPopulating && (['other', 'places', 'more'].includes(list.category?.toLowerCase() || '')) && (
                            <div className="mb-6 p-6 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-center text-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500 shadow-sm mt-4">
                                <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-50">
                                    <Sparkles className="w-6 h-6 text-indigo-500 animate-pulse" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-base font-black uppercase tracking-tight text-slate-900 leading-tight">Need a starting point?</h4>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest max-w-[240px]">We can build a draft for you based on the title.</p>
                                </div>
                                <div className="flex flex-col w-full gap-2">
                                    <Button
                                        onClick={() => startEarlyPopulation()}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest h-12 rounded-xl shadow-md transition-all active:scale-95"
                                    >
                                        Generate List
                                    </Button>
                                    <button
                                        onClick={() => searchInputRef.current?.focus()}
                                        className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors py-2"
                                    >
                                        I&apos;ll add items manually
                                    </button>
                                </div>
                            </div>
                        )}

                        <RankingList
                            listId={list.id}
                            initialItems={list.list_items?.sort((a: any, b: any) => a.rank - b.rank) || []}
                            category={list.category}
                            readOnly={!isOwner}
                            isPopulating={isPopulating}
                        />

                        {/* POPULATION FEEDBACK - Progress Bar */}
                        {isPopulating && (
                            <div className="mt-4 px-4 py-3 border border-slate-100 rounded-2xl bg-slate-50/50 flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            {populatedCount > 0 ? `Generating... ${populatedCount} found` : "We are making your list-"}
                                        </span>
                                    </div>
                                    {populatedCount > 0 && (
                                        <button
                                            onClick={() => router.refresh()}
                                            className="text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-600 transition-colors"
                                        >
                                            Done
                                        </button>
                                    )}
                                </div>
                                <div className="w-full h-1.5 bg-slate-200/50 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 transition-all duration-500"
                                        style={{
                                            width: populatedCount > 0 ? `${Math.min(100, (populatedCount / 12) * 100)}%` : '15%',
                                            animation: populatedCount === 0 ? 'pulse-progress 2s ease-in-out infinite' : 'none'
                                        }}
                                    />
                                </div>
                                <style dangerouslySetInnerHTML={{
                                    __html: `
                                        @keyframes pulse-progress {
                                            0% { opacity: 0.6; width: 10%; }
                                            50% { opacity: 1; width: 30%; }
                                            100% { opacity: 0.6; width: 10%; }
                                        }
                                    `}} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-hidden">
            <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors z-[60]">
                <X className="h-8 w-8" />
            </button>

            {/* Navigation top bar if thread > 2 */}
            {thread.length > 2 && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-xl">
                    <button onClick={prevItem} disabled={currentIndex === 1} className="text-white/70 hover:text-white disabled:opacity-20 transition-all">
                        <ChevronLeft className="h-6 w-6" />
                    </button>
                    <span className="text-xs font-black uppercase tracking-widest text-white/90">Response {currentIndex} of {thread.length - 1}</span>
                    <button onClick={nextItem} disabled={currentIndex === thread.length - 1} className="text-white/70 hover:text-white disabled:opacity-20 transition-all">
                        <ChevronRight className="h-6 w-6" />
                    </button>
                </div>
            )}

            {/* Mobile Tab Switcher */}
            <div className="flex lg:hidden w-full gap-2 mb-4 shrink-0 mt-8">
                <Button
                    variant={currentIndex === 0 ? "default" : "outline"}
                    onClick={() => setCurrentIndex(0)}
                    className="flex-1 h-10 font-black text-[10px] uppercase tracking-widest rounded-xl"
                >
                    Original
                </Button>
                <Button
                    variant={currentIndex > 0 ? "default" : "outline"}
                    onClick={() => setCurrentIndex(1)}
                    className="flex-1 h-10 font-black text-[10px] uppercase tracking-widest rounded-xl"
                >
                    Response
                </Button>
            </div>

            <div className="w-full flex-1 flex flex-col lg:flex-row items-stretch justify-center gap-4 lg:gap-8 relative lg:max-w-[90vw] lg:h-[90vh] overflow-hidden">
                {/* ROOT LIST (Visible on left in desktop, or when active tab on mobile) */}
                <div className={`${currentIndex === 0 ? 'flex' : 'hidden'} lg:flex flex-1 relative w-full h-full min-h-0`}>
                    {renderListCard(rootList, true)}
                </div>

                {/* CURRENT RESPONSE (Right side in desktop, or when active tab on mobile) */}
                <div className={`${currentIndex > 0 ? 'flex' : 'hidden'} lg:flex flex-1 relative w-full h-full min-h-0`}>
                    {thread.length > 1 ? renderListCard(currentResponse, false) : renderListCard(rootList, true)}
                </div>
            </div>
        </div>
    );
}
