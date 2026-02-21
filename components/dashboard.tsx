'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Share2, Copy, Check, Plus, MessageSquare, Search, Loader2, Link as LinkIcon, MapPin, Download, Music, MessageCircle, Twitter, Mail, X, Users, Film, Beer, Utensils, MoreHorizontal, Clock, Trash2, Pencil, Facebook, Cloud } from 'lucide-react';
import { RankingList } from "./ranking-list";
import { deleteList, createList, updateListTitle, getThread, findListByTitle, updateProfile, getFollowingLists, addComment, addItemsToList, getComments, upsertComment } from "@/app/actions";
/* FEATURE: Places Map — to disable, comment out the PlacesMap import below */
import { PlacesMap, itemsToPlaces } from './places-map';
/* FEATURE: Music Playlist Export */
import { PlaylistExport } from './music-link';
import { detectAndPopulateList, populateBackgroundItems } from '@/app/populate';
import { FeedbackHole } from './feedback-hole';
import { searchEntities, addToList } from "@/app/search/actions";
import { RankedItem, Category } from "@/lib/types";
import { toast } from 'sonner';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ResponseBtn } from '@/components/response-btn';
import { ResponseSplitView } from '@/components/response-split-view';
import { CommentModal } from '@/components/comment-modal';

import { extractContext } from "@/lib/utils";

const categoryConfig = {
    music: { label: "MUSIC", color: "text-blue-600" },
    movies: { label: "MOVIES", color: "text-purple-600" },
    books: { label: "BOOKS & LETTERS", color: "text-amber-700" },
    food: { label: "FOOD & DRINK", color: "text-green-600" },
    other: { label: "MORE...", color: "text-slate-600" },
};

interface DashboardProps {
    initialLists: any[];
    currentUserId: string | null;
    currentUsername: string | null;
    currentDisplayName: string | null;
    respondedListIds?: string[];
}

export function Dashboard({ initialLists, currentUserId, currentUsername, currentDisplayName, respondedListIds = [] }: DashboardProps) {
    const router = useRouter();
    const [lists, setLists] = useState(initialLists);
    const [followingLists, setFollowingLists] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'all' | 'following'>('all');
    const [isLoadingFollowing, setIsLoadingFollowing] = useState(false);

    const [expandedListId, setExpandedListId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    // Response Split View state
    const [responseView, setResponseView] = useState<{
        isOpen: boolean;
        threadData: any[] | null;
        draftId: string | null;
    }>({ isOpen: false, threadData: null, draftId: null });

    // While You Wait state
    const [isWaitingForComment, setIsWaitingForComment] = useState(false);
    const [waitingComment, setWaitingComment] = useState('');
    const isCommentDirty = useRef(false);
    const [pendingListAfterCreate, setPendingListAfterCreate] = useState<any>(null);
    const [populatedCount, setPopulatedCount] = useState(0);
    const [isPopulating, setIsPopulating] = useState(false);
    const [isBackgroundPopulating, setIsBackgroundPopulating] = useState(false);
    const [isPopulatingComplete, setIsPopulatingComplete] = useState(false);

    // FREE-FORM LIST STATE
    const [creationStep, setCreationStep] = useState<'naming' | 'choosing' | 'drafting' | 'waiting' | 'ranking' | null>(null);
    const [freeFormItems, setFreeFormItems] = useState<string[]>(Array(10).fill(''));

    const [commentModal, setCommentModal] = useState<{
        isOpen: boolean;
        listId: string | null;
        listTitle: string;
        userId: string | null;
    }>({ isOpen: false, listId: null, listTitle: "", userId: null });

    const [showMap, setShowMap] = useState(false);

    // Display Name Enforcement
    const [showNameModal, setShowNameModal] = useState(false);
    const [displayName, setDisplayName] = useState('');
    const [isSavingProfile, setIsSavingProfile] = useState(false);




    useEffect(() => {
        if (currentUserId && !currentDisplayName) {
            setShowNameModal(true);
        }
    }, [currentUserId, currentDisplayName]);

    // Auto-finalize creation when population completes
    useEffect(() => {
        if (isPopulatingComplete && creationStep === 'ranking') {
            console.log(`[Dashboard] Auto-finalizing list creation...`);
            handleSubmitWaitingComment();
        }
    }, [isPopulatingComplete, creationStep]);

    const handleSaveProfile = async () => {
        if (!displayName.trim()) return;
        setIsSavingProfile(true);
        try {
            await updateProfile(displayName);
            setShowNameModal(false);
            toast.success("Profile updated");
            // Force reload to update server props
            router.refresh();
        } catch (error) {
            toast.error("Failed to update profile");
        } finally {
            setIsSavingProfile(false);
        }
    };

    // FETCH COMMENTS FOR EXPANDED LIST
    useEffect(() => {
        if (!expandedListId || expandedListId === 'temp-pending') {
            if (!isCommentDirty.current) setWaitingComment('');
            return;
        }

        const fetchComments = async () => {
            // Don't overwrite if user is actively typing or has a dirty draft
            if (isCommentDirty.current || isPopulating) return;

            try {
                const results = await getComments(expandedListId);
                // Look for the user's latest comment to show in the main area
                const userComment = results?.findLast((c: any) => c.user_id === currentUserId);
                if (userComment) {
                    setWaitingComment(userComment.content);
                } else {
                    setWaitingComment('');
                }
            } catch (err) {
                console.error("[Dashboard] Failed to fetch comments:", err);
            }
        };

        fetchComments();
    }, [expandedListId, currentUserId]);

    // DEBOUNCED COMMENT SAVING
    useEffect(() => {
        if (!waitingComment.trim() || !expandedListId || expandedListId === 'temp-pending') return;

        const timer = setTimeout(async () => {
            try {
                await upsertComment(expandedListId, waitingComment.trim());
                isCommentDirty.current = false;
                console.log("[Dashboard] Debounced comment save successful");
            } catch (err) {
                console.error("[Dashboard] Debounced comment save failed:", err);
            }
        }, 2000); // 2 second debounce

        return () => clearTimeout(timer);
    }, [waitingComment, expandedListId]);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<RankedItem[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [addingItemId, setAddingItemId] = useState<string | null>(null);

    // Unified Editing State
    const [editSession, setEditSession] = useState<{
        id: string | null;
        title: string | null;
        isExpanded: boolean;
        isSample?: boolean;
        sampleTitle?: string;
    }>({
        id: null,
        title: null,
        isExpanded: false
    });
    const [isUpdatingTitle, setIsUpdatingTitle] = useState(false);

    // Share State
    const [showShareOptions, setShowShareOptions] = useState(false);

    // Search Ref for focus management
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Global Site Search State
    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const [isGlobalSearchExpanded, setIsGlobalSearchExpanded] = useState(false);
    const globalSearchInputRef = useRef<HTMLInputElement>(null);

    // Fetch following lists when tab changes
    useEffect(() => {
        if (activeTab === 'following' && followingLists.length === 0 && currentUserId) {
            setIsLoadingFollowing(true);
            getFollowingLists()
                .then(data => setFollowingLists(data))
                .catch(err => console.error(err))
                .finally(() => setIsLoadingFollowing(false));
        }
    }, [activeTab, currentUserId, followingLists.length]);

    const listsToFilter = activeTab === 'all' ? lists : followingLists;

    // Filter lists based on global search query
    const activeLists = listsToFilter.filter(list => {
        if (!globalSearchQuery.trim()) return true;
        const query = globalSearchQuery.toLowerCase();
        const matchesTitle = list.title?.toLowerCase().includes(query);
        const matchesUser = list.profiles?.username?.toLowerCase().includes(query);
        return matchesTitle || matchesUser;
    });

    // Group lists by category
    const groupedLists = activeLists.reduce((acc, list) => {
        let cat = list.category || 'other';
        if (cat === 'more' || cat === 'places') cat = 'other';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(list);
        return acc;
    }, {} as Record<string, any[]>);

    const categories = Object.keys(categoryConfig) as Array<keyof typeof categoryConfig>;

    const expandedList = lists.find(l => l.id === expandedListId);

    // Auto-focus global search when expanded
    useEffect(() => {
        if (isGlobalSearchExpanded) {
            setTimeout(() => {
                globalSearchInputRef.current?.focus();
            }, 100);
        }
    }, [isGlobalSearchExpanded]);

    const handleDelete = async (id: string, force: boolean = false) => {
        if (!force && !confirm('Are you sure you want to delete this list?')) return;

        const listToDelete = lists.find(l => l.id === id);
        setIsDeleting(true);
        try {
            await deleteList(id);
            setLists(prev => prev.filter(l => l.id !== id));
            setExpandedListId(null);

            toast.success('List deleted', {
                description: listToDelete?.title,
                action: {
                    label: "UNDO",
                    onClick: () => {
                        if (listToDelete) {
                            handleCreateList(listToDelete.category, listToDelete.title);
                        }
                    }
                }
            });
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete list');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleCopyLink = (list: any) => {
        const url = `${window.location.origin}/list/${list.id}`;
        const authorName = list.profiles?.display_name || list.profiles?.username || 'Someone';
        const text = `${authorName} made a list on Rank and file. Take a look, and respond. ${url}`;
        navigator.clipboard.writeText(text);
        setIsCopied(true);
        toast.success('Link copied to clipboard');
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleShareTwitter = (list: any) => {
        const url = `${window.location.origin}/list/${list.id}`;
        const authorName = list.profiles?.display_name || list.profiles?.username || 'Someone';
        const text = `${authorName} made a list on Rank and File. Take a look, and respond.`;
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
    };

    // Clear state when modal closes or changes
    useEffect(() => {
        if (!expandedListId) {
            setSearchResults([]);
            setSearchQuery('');
            setPage(1);
            setHasMore(true);
        }
    }, [expandedListId]);

    const handleSearch = useCallback(async (query: string, forceContext = false, pageNum = 1) => {
        const listToUse = lists.find(l => l.id === expandedListId);
        if (!listToUse) return;

        // If query is empty and we aren't forcing context (pre-fetch), don't search
        if (!query.trim() && !forceContext) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            // Extract core structured context
            const intentContext = extractContext(listToUse.title, listToUse.category);
            console.log('[Dashboard] Extracted Context:', intentContext);

            // Add pagination to context
            const searchContext = {
                ...intentContext,
                limit: 50, // Fetch 50 at a time
                offset: (pageNum - 1) * 50
            };

            // Use context as subject if query is empty (pre-fetch mode)
            // BUT for movies with actor/director context, keep query empty so the provider can use Discover API
            let finalQuery = query;
            if (!query.trim()) {
                const hasSpecialMovieContext = listToUse.category === 'movies' && (intentContext.actor || intentContext.director);
                if (hasSpecialMovieContext) {
                    // Keep query empty — let movies provider handle via Discover API
                    finalQuery = '';
                } else if (intentContext.subject) {
                    finalQuery = intentContext.subject;
                }
            }

            // Execute search with structured context
            const results = await searchEntities(finalQuery, listToUse.category as Category, searchContext);

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
    }, [expandedListId, lists]);



    // Live Search Effect (Debounced)
    useEffect(() => {
        if (!searchQuery.trim()) return;

        const timer = setTimeout(() => {
            setPage(1);
            handleSearch(searchQuery, false, 1);
        }, 400);

        return () => clearTimeout(timer);
    }, [searchQuery, handleSearch]);

    const handleAddItem = async (item: RankedItem) => {
        if (!expandedList) return;

        // PREVENT DUPLICATES
        // Find fresh list data
        const currentList = lists.find(l => l.id === expandedList.id);
        if (currentList?.list_items) {
            const isDuplicate = currentList.list_items.some((existing: any) => {
                const existingMeta = existing.metadata;
                const newMeta = item.metadata;
                if (!existingMeta || !newMeta) return false;

                // 1. Check ID from Provider (Strongest)
                if (existingMeta.provider === newMeta.provider && existingMeta.provider !== 'manual') {
                    // Try to find a unique ID in rawMetadata or top level
                    const eId = existingMeta.rawMetadata?.id || existingMeta.rawMetadata?.place_id;
                    const nId = newMeta.rawMetadata?.id || newMeta.rawMetadata?.place_id;
                    if (eId && nId && eId === nId) return true;
                }

                // 2. Check External URL
                if (existingMeta.externalUrl && newMeta.externalUrl && existingMeta.externalUrl === newMeta.externalUrl) return true;

                // 3. Fallback: Name + Subtitle exact match
                if (existingMeta.name === newMeta.name && existingMeta.subtitle === newMeta.subtitle) return true;

                return false;
            });

            if (isDuplicate) {
                toast.error("This item is already in your list!");
                return;
            }
        }

        setAddingItemId(item.id);
        try {
            const result = await addToList(item, expandedList.id);
            if (result.success) {
                toast.success(`Added ${item.name}`);
                // Update local state for the list items
                setLists(prev => prev.map(l => {
                    if (l.id === expandedList.id) {
                        // Prepend the new item and increment the ranks of existing ones for UI consistency
                        const shiftedItems = (l.list_items || []).map((existing: any) => ({
                            ...existing,
                            rank: (existing.rank || 0) + 1
                        }));
                        return {
                            ...l,
                            list_items: [result.item, ...shiftedItems]
                        };
                    }
                    return l;
                }));
                // CLEAR search results after adding
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

    const handleSubmitWaitingComment = async () => {
        if (!pendingListAfterCreate) return;

        setIsUpdatingTitle(true);
        try {
            // 1. Add comment if provided
            if (waitingComment.trim()) {
                await upsertComment(pendingListAfterCreate.id, waitingComment.trim());
            }

            // 2. Population is already happening/happened in background via startEarlyPopulation
            // But if it failed or hasn't started, we trigger it one last time to be sure
            let updatedList = { ...pendingListAfterCreate };
            let populatedResultCount = populatedCount;

            if (populatedResultCount < 1) {
                const popResult = await detectAndPopulateList(
                    pendingListAfterCreate.id,
                    pendingListAfterCreate.title,
                    pendingListAfterCreate.category
                );

                if (popResult.populated) {
                    populatedResultCount = popResult.count;
                    if (popResult.isComplete) {
                        setIsPopulatingComplete(true);
                    }
                    if (popResult.items && popResult.items.length > 0) {
                        updatedList.list_items = popResult.items;
                    } else {
                        updatedList.list_items = Array(popResult.count).fill({});
                    }
                }
            } else {
                // Get the items from our current state
                const currentList = lists.find(l => l.id === pendingListAfterCreate.id);
                if (currentList) {
                    updatedList = currentList;
                }
            }

            // 3. Update lists state
            setLists(prev => prev.map(l => l.id === 'temp-pending' || l.id === updatedList.id ? updatedList : l));
            setExpandedListId(updatedList.id);

            // BACKGROUND POPULATION: Continue fetching up to 80 items
            if (populatedResultCount < 80 && !isPopulatingComplete) {
                console.log(`[Dashboard] Starting background population for list: ${updatedList.id}`);
                setIsBackgroundPopulating(true);
                populateBackgroundItems(updatedList.id, updatedList.title, updatedList.category, populatedResultCount).then((result: any) => {
                    setIsBackgroundPopulating(false);
                    if (result.isComplete) {
                        setIsPopulatingComplete(true);
                    }
                    if ((result.count || 0) > 0) {
                        router.refresh();
                    }
                }).catch(() => {
                    console.error("[Dashboard] Background population failed");
                    setIsBackgroundPopulating(false);
                });
            }
            router.refresh();
        } catch (error) {
            console.error("[Dashboard] Comment submission failed:", error);
            // We don't toast error here because it's non-critical, we want the list to show up.
        } finally {
            setIsUpdatingTitle(false);
            setIsWaitingForComment(false);
            setCreationStep(null);
            const finalId = pendingListAfterCreate?.id;
            const finalTitle = pendingListAfterCreate?.title;
            setPendingListAfterCreate(null);
            setPopulatedCount(0);
            setIsPopulating(false);
            setIsBackgroundPopulating(false);
            setIsPopulatingComplete(false);

            // Re-focus the newly created list in the edit session to keep the title editable if needed
            if (finalId) {
                setEditSession({ id: finalId, title: (finalTitle || '').toUpperCase(), isExpanded: true });
            } else {
                setEditSession({ id: null, title: null, isExpanded: false });
            }

            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        }
    };

    const startEarlyPopulation = async (targetList: any) => {
        if (!targetList || isPopulating) return;

        setIsPopulating(true);
        setPopulatedCount(0);

        console.log(`[Dashboard] Starting early population for: ${targetList.title}`);

        try {
            const popResult = await detectAndPopulateList(
                targetList.id,
                targetList.title,
                targetList.category
            );

            if (popResult.populated) {
                setPopulatedCount(popResult.count);
                if (popResult.isComplete) {
                    setIsPopulatingComplete(true);
                }
                // Update the local lists state so the count is reflected
                setLists(prev => prev.map(l => l.id === targetList.id ? { ...l, list_items: popResult.items || [] } : l));

                // BACKGROUND POPULATION: Trigger if not complete
                if (popResult.count < 80 && !popResult.isComplete) {
                    console.log(`[Dashboard] Starting background population for list: ${targetList.id}`);
                    setIsBackgroundPopulating(true);
                    populateBackgroundItems(targetList.id, targetList.title, targetList.category, popResult.count).then((result: any) => {
                        setIsBackgroundPopulating(false);
                        if (result.isComplete) {
                            setIsPopulatingComplete(true);
                        }
                    }).catch((err) => {
                        console.error("[Dashboard] Background population failed:", err);
                        setIsBackgroundPopulating(false);
                    });
                }
            }
        } catch (error) {
            console.error("[Dashboard] Early population failed:", error);
        } finally {
            setIsPopulating(false);
        }
    };

    const handleCreateFreeForm = async () => {
        if (!pendingListAfterCreate) return;
        const validItems = freeFormItems.filter(i => i.trim().length > 0);
        if (validItems.length === 0) {
            toast.error("Please add at least one item");
            return;
        }

        setIsUpdatingTitle(true);
        try {
            // Update title if it changed during drafting
            if (editSession.title && editSession.title.trim().toUpperCase() !== pendingListAfterCreate.title.toUpperCase()) {
                await updateListTitle(pendingListAfterCreate.id, editSession.title.trim().toUpperCase());
            }

            const result = await addItemsToList(pendingListAfterCreate.id, validItems);

            // Update local state so it shows up immediately with STABLE IDs
            const newListWithItems = {
                ...pendingListAfterCreate,
                title: editSession.title?.trim().toUpperCase() || pendingListAfterCreate.title,
                list_items: (result.items || []).map((row: any) => ({
                    id: row.id || row.entity_id,
                    name: row.metadata?.name,
                    rank_position: row.rank,
                    metadata: row.metadata
                }))
            };

            setLists(prev => prev.map(l => l.id === 'temp-pending' || l.id === pendingListAfterCreate.id ? newListWithItems : l));
            setExpandedListId(pendingListAfterCreate.id);
            setCreationStep(null);
            setFreeFormItems(Array(10).fill(''));
            setEditSession({ id: null, title: null, isExpanded: false });
            router.refresh();
        } catch (error) {
            toast.error("Failed to add items");
        } finally {
            setIsUpdatingTitle(false);
            setPendingListAfterCreate(null);
        }
    };

    const handleCreateList = async (category: string, restoreTitle?: string) => {
        // Support instant creation for "Undo Delete"
        if (restoreTitle) {
            try {
                const newList = await createList(restoreTitle, category);
                setLists(prev => [newList, ...prev]);
                setExpandedListId(newList.id);
                toast.success("Ranking restored");
            } catch (error) {
                toast.error("Failed to restore list");
            }
            return;
        }

        // Create a temporary list object — title starts empty, user must name it
        const tempList = {
            id: 'temp-pending',
            title: '',
            category,
            user_id: currentUserId,
            list_items: [],
            created_at: new Date().toISOString(),
            profiles: { username: currentUsername }
        };

        setLists(prev => [tempList, ...prev]);
        setExpandedListId('temp-pending');
        setCreationStep('naming');
        setEditSession({
            id: 'temp-pending',
            title: '',
            isExpanded: true,
            isSample: false,
            sampleTitle: undefined
        });
    };

    const handleUpdateTitle = async (targetListId: string) => {
        const cleanup = () => {
            setEditSession({ id: null, title: null, isExpanded: false });
            setIsUpdatingTitle(false);
        };

        if (isUpdatingTitle) return;

        // BLOCK EMPTY TITLES
        if (!editSession.title || !editSession.title.trim()) {
            if (targetListId === 'temp-pending') {
                // For temp lists, empty title on blur is fine — just keep editing
                return;
            }
            toast.error("Please name your list!");
            return;
        }

        // HANDLE TEMP LIST CREATION
        if (targetListId === 'temp-pending') {
            // Enforce Uppercase on Save
            const titleToSave = editSession.title?.trim().toUpperCase();

            // If empty, discard only if we are truly cancelling (checking logic below)
            if (!titleToSave) {
                // If the user clears the title of a real list, we usually reject.
                // But for a TEMP list, empty title means "Cancel Creation".
                setLists(prev => prev.filter(l => l.id !== 'temp-pending'));
                setExpandedListId(null);
                cleanup();
                return;
            }

            // If we have a title, CREATE it for real
            setIsUpdatingTitle(true);
            try {
                const newList = await createList(titleToSave, lists.find(l => l.id === 'temp-pending')?.category || 'other');
                console.log(`[Dashboard] Created real list:`, newList.id);

                setPendingListAfterCreate(newList);

                // CRITICAL: Update lists state immediately so expandedListId points to a list that EXISTS in state
                // This prevents the modal from closing when expandedList becomes null due to ID switch.
                setLists(prev => [newList, ...prev.filter(l => l.id !== 'temp-pending')]);
                setExpandedListId(newList.id);
                setIsUpdatingTitle(false);

                // START EARLY POPULATION
                if (newList.category !== 'other' && newList.category !== 'places') {
                    startEarlyPopulation(newList);
                }

                // FOR 'MORE' CATEGORIES, ASK AI VS MANUAL
                if (newList.category === 'other' || newList.category === 'places') {
                    setCreationStep('choosing');
                    return;
                }

                // SAVE INITIAL COMMENT (NON-BLOCKING/RESILIENT)
                if (waitingComment.trim()) {
                    console.log(`[Dashboard] Saving initial comment for ${newList.id}: ${waitingComment}`);
                    upsertComment(newList.id, waitingComment.trim()).catch(err => {
                        console.error("[Dashboard] Initial comment save failed:", err);
                    });
                }

                console.log(`[Dashboard] Transitioned to ranking view for unified modal`);

            } catch (error: any) {
                console.error("[Dashboard] List creation failed:", error);
                toast.error(error.message?.includes('DB_ERROR') ? `Database error: ${error.message}` : "Failed to create list");
                setLists(prev => prev.filter(l => l.id !== 'temp-pending'));
                setExpandedListId(null);
                cleanup();
            }
            return;
        }

        // HANDLE EXISTING LIST UPDATE
        const targetList = lists.find(l => String(l.id) === String(targetListId));
        if (!targetList || editSession.title === null || editSession.title.trim() === '') {
            cleanup();
            return;
        }

        const newTitle = editSession.title.trim().toUpperCase();

        if (newTitle === targetList.title.toUpperCase()) {
            cleanup();
            return;
        }

        setIsUpdatingTitle(true);
        try {
            await updateListTitle(targetListId, newTitle);
            setLists(prev => prev.map(l =>
                String(l.id) === String(targetListId) ? { ...l, title: newTitle } : l
            ));
            toast.success("Title updated");
        } catch (error: any) {
            toast.error("Failed to update title");
        } finally {
            cleanup();
            // Focus search and auto-trigger contextual search based on new title
            setTimeout(() => {
                searchInputRef.current?.focus();
                handleSearch('', true);
            }, 100);
        }
    };

    return (
        <div className="relative">
            {/* Display Name Enforcement Modal */}
            {showNameModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                    <Card className="w-full max-w-md bg-white dark:bg-slate-900 border-none shadow-2xl">
                        <CardHeader className="text-center pb-2">
                            <CardTitle className="text-2xl font-black uppercase tracking-tighter">Welcome to the Rank</CardTitle>
                            <CardDescription>To start ranking, please set your display name.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Display Name</label>
                                <Input
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="e.g. Alex Smith"
                                    className="font-bold text-lg"
                                    autoFocus
                                />
                            </div>
                            <Button
                                onClick={handleSaveProfile}
                                disabled={!displayName.trim() || isSavingProfile}
                                className="w-full bg-black text-white hover:bg-slate-800 font-bold uppercase tracking-widest h-12"
                            >
                                {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start Ranking"}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* TAB TOGGLE & GLOBAL SEARCH */}
            <div className="flex justify-center mb-8 items-center gap-4">
                <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-full border border-slate-200 dark:border-white/10">
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'all'
                            ? 'bg-white dark:bg-slate-800 text-black dark:text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        Global
                    </button>
                    <button
                        onClick={() => {
                            if (!currentUserId) {
                                toast.error("Log in to follow people!");
                                return;
                            }
                            setActiveTab('following');
                        }}
                        className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'following'
                            ? 'bg-white dark:bg-slate-800 text-black dark:text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        Following
                    </button>
                </div>

                {/* GLOBAL SEARCH */}
                <div className={`flex items-center transition-all duration-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-full overflow-hidden ${isGlobalSearchExpanded ? 'w-64 shadow-md' : 'w-10 h-10 border-transparent bg-transparent hover:bg-slate-100'}`}>
                    {isGlobalSearchExpanded ? (
                        <div className="flex items-center w-full px-3">
                            <Search className="h-4 w-4 text-slate-400 shrink-0" />
                            <input
                                ref={globalSearchInputRef}
                                type="text"
                                value={globalSearchQuery}
                                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                                onBlur={() => {
                                    if (!globalSearchQuery.trim()) {
                                        setIsGlobalSearchExpanded(false);
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                        setGlobalSearchQuery('');
                                        setIsGlobalSearchExpanded(false);
                                    }
                                }}
                                placeholder="Search lists or people..."
                                className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium px-2 py-2 placeholder:text-slate-400"
                            />
                            {globalSearchQuery && (
                                <button
                                    onClick={() => setGlobalSearchQuery('')}
                                    className="p-1 hover:bg-slate-100 rounded-full"
                                >
                                    <X className="h-3 w-3 text-slate-400" />
                                </button>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsGlobalSearchExpanded(true)}
                            className="w-full h-full flex items-center justify-center text-slate-400 hover:text-slate-600"
                        >
                            <Search className="h-5 w-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* EMPTY STATE FOR FOLLOWING */}
            {activeTab === 'following' && !isLoadingFollowing && followingLists.length === 0 && (
                <div className="text-center py-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Users className="h-8 w-8 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight mb-2">Your feed is empty</h3>
                    <p className="text-slate-500 max-w-sm mx-auto mb-8">
                        Follow creators to see their rankings appear here. Use the search bar to find people.
                    </p>
                    <Button
                        variant="outline"
                        onClick={() => setActiveTab('all')}
                        className="font-bold uppercase tracking-widest text-xs"
                    >
                        Back to Global Feed
                    </Button>
                </div>
            )}

            {/* CATEGORY GRID / SWIPE VIEW */}
            <div className={`
                flex flex-col gap-8 pb-8
                md:grid md:grid-cols-2 md:gap-6 md:overflow-visible md:pb-0 md:mx-0 md:px-0
                lg:grid-cols-3 xl:grid-cols-5 
                transition-all duration-500 
                scrollbar-hide
                ${(expandedListId || showNameModal) ? 'blur-sm scale-95 pointer-events-none' : ''}
            `}>
                {categories.map((catKey) => {
                    const config = categoryConfig[catKey];
                    const lists = groupedLists[catKey] || [];

                    return (
                        <div key={catKey} className="
                            w-full
                            md:min-w-0 md:w-auto
                            flex flex-col gap-4 group/cat
                        ">
                            <div
                                onClick={() => handleCreateList(catKey)}
                                className="flex items-end gap-3 pb-2 border-b-4 border-slate-100 hover:border-black dark:border-white/10 dark:hover:border-white transition-colors cursor-pointer group h-20"
                            >
                                <h2 className={`font-black tracking-tighter uppercase transition-all duration-300 opacity-20 group-hover:opacity-100 grayscale group-hover:grayscale-0 text-4xl whitespace-pre-line leading-[0.85] ${config.color}`}>
                                    {config.label.replace(' & ', ' &\n')}
                                </h2>
                                {
                                    /* No card count displayed */
                                }
                                {/* FEATURE: Places Map — Global map button for places categories */}
                                {['places', 'bars', 'restaurants', 'other'].includes(catKey) && lists.length > 0 && (
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            // Find first list in category and expand it with map
                                            const firstList = lists[0];
                                            setExpandedListId(firstList.id);
                                            setShowMap(true);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"
                                        title={`View all ${config.label.toLowerCase()} on map`}
                                    >
                                        <MapPin className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            <div className="flex flex-col gap-3">
                                {lists.length > 0 ? (
                                    lists.map((list: any) => (
                                        <Card
                                            key={list.id}
                                            onClick={async () => {
                                                if (currentUserId === list.user_id) {
                                                    // Owner — always open editable expanded view
                                                    console.log('OPENING LIST (owner):', list.id);
                                                    setExpandedListId(list.id);
                                                } else if (list.response_count > 0) {
                                                    // Non-owner with responses — open thread split view
                                                    try {
                                                        const thread = await getThread(list.id);
                                                        if (thread) {
                                                            setResponseView({
                                                                isOpen: true,
                                                                threadData: thread,
                                                                draftId: null
                                                            });
                                                        }
                                                    } catch (err) {
                                                        console.error('Failed to load thread:', err);
                                                        toast.error('Failed to load responses');
                                                    }
                                                } else {
                                                    // Non-owner, no responses — open expanded view
                                                    console.log('OPENING LIST:', list.id);
                                                    setExpandedListId(list.id);
                                                }
                                            }}
                                            className={`group relative cursor-pointer hover:border-black transition-all duration-200 border-2 shadow-sm overflow-hidden flex flex-col justify-between min-h-[100px] ${respondedListIds.includes(list.id) || currentUserId === list.user_id
                                                ? "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10"
                                                : "bg-white dark:bg-gray-950 border-slate-100 dark:border-white/5"
                                                }`}
                                        >
                                            {/* Quick Delete Button - Only show for owner */}
                                            {currentUserId === list.user_id && (
                                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        disabled={isDeleting}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(list.id, true);
                                                        }}
                                                        className="h-6 w-6 rounded-full hover:bg-red-50 hover:text-red-500 text-slate-300 transition-colors"
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            )}
                                            {editSession.id === list.id && !editSession.isExpanded && editSession.title !== null ? (
                                                <CardHeader className="px-4 pt-2 pb-0">
                                                    <Input
                                                        autoFocus
                                                        value={editSession.title}
                                                        onFocus={(e) => e.target.select()}
                                                        onChange={(e) => setEditSession(s => ({ ...s, title: e.target.value.toUpperCase() }))}
                                                        onBlur={() => handleUpdateTitle(list.id)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleUpdateTitle(list.id);
                                                            if (e.key === 'Escape') setEditSession({ id: null, title: null, isExpanded: false });
                                                        }}
                                                        className="text-base font-black tracking-tight leading-tight uppercase h-auto p-0 border-none bg-transparent focus-visible:ring-0"
                                                    />
                                                </CardHeader>
                                            ) : (
                                                <CardHeader className="px-4 pt-2 pb-0">
                                                    <CardTitle
                                                        className="text-base font-black tracking-tight leading-tight group-hover:underline underline-offset-4 decoration-2 cursor-pointer"
                                                    >
                                                        {list.title.toUpperCase()}
                                                    </CardTitle>
                                                </CardHeader>
                                            )}
                                            <CardContent className="px-4 pb-1 pt-4 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-auto text-right">
                                                <div className="flex flex-col gap-0.5 items-end">
                                                    <Link
                                                        href={`/@${list.profiles?.username}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="hover:text-black transition-colors"
                                                    >
                                                        {list.profiles?.display_name || list.profiles?.username || 'unknown'}
                                                    </Link>
                                                    <span>{list.list_items?.length || 0} ITEMS</span>
                                                    {list.response_count > 0 && (
                                                        <span className="text-blue-500 dark:text-blue-400">
                                                            {list.response_count} {list.response_count === 1 ? 'RESPONSE' : 'RESPONSES'}
                                                        </span>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                ) : (
                                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] text-center p-8 transition-colors hover:bg-slate-100 dark:hover:bg-white/[0.05] group/empty">
                                        <div className="w-12 h-12 bg-white dark:bg-white/5 rounded-full flex items-center justify-center mb-3 shadow-sm group-hover/empty:scale-110 transition-transform">
                                            <Plus className="h-5 w-5 text-slate-300 group-hover/empty:text-black dark:group-hover/empty:text-white transition-colors" />
                                        </div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">No {config.label.toLowerCase()} lists</p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleCreateList(catKey)}
                                            className="h-7 text-[10px] font-black uppercase tracking-widest bg-white dark:bg-transparent hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
                                        >
                                            Create First List
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Expanded Overlay */}
            {expandedListId && expandedList && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-[2px]">
                    <div
                        className="fixed inset-0"
                        onClick={() => {
                            setExpandedListId(null);
                            setSearchResults([]);
                            setSearchQuery('');
                            setShowShareOptions(false);
                            setShowMap(false);
                            setIsWaitingForComment(false);
                            setCreationStep(null);
                            setPendingListAfterCreate(null);
                            setIsPopulating(false);
                            setIsBackgroundPopulating(false);
                            setIsPopulatingComplete(false);
                            setPopulatedCount(0);
                            setFreeFormItems(Array(10).fill(''));
                            setWaitingComment('');
                            // Clean up temp list if it was never saved
                            if (expandedList.id === 'temp-pending') {
                                setLists(prev => prev.filter(l => l.id !== 'temp-pending'));
                            }
                        }}
                    />
                    <Card className="relative w-full max-w-xl flex flex-col h-auto max-h-[90vh] border-slate-200 bg-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom-4 duration-300">
                        <button
                            onClick={() => {
                                setExpandedListId(null);
                                setSearchResults([]);
                                setSearchQuery('');
                                setShowShareOptions(false);
                                setShowMap(false);
                                setIsWaitingForComment(false);
                                setCreationStep(null);
                                setPendingListAfterCreate(null);
                                setIsPopulating(false);
                                setIsBackgroundPopulating(false);
                                setIsPopulatingComplete(false);
                                setPopulatedCount(0);
                                setFreeFormItems(Array(10).fill(''));
                                setWaitingComment('');
                                // Clean up temp list if it was never saved
                                if (expandedList.id === 'temp-pending') {
                                    setLists(prev => prev.filter(l => l.id !== 'temp-pending'));
                                }
                            }}
                            className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 transition-colors z-20"
                        >
                            <X className="h-4 w-4" />
                        </button>

                        {creationStep === 'choosing' ? (
                            <>
                                <CardHeader className="p-5 pb-2 text-center pt-8">
                                    <Plus className="h-8 w-8 text-slate-200 mx-auto mb-4" />
                                    <CardTitle className="text-xl font-black uppercase tracking-tighter">Choose your path</CardTitle>
                                    <CardDescription className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2 px-8 leading-relaxed">
                                        How should we start this list?
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-6 pt-2 grid grid-cols-1 gap-3">
                                    <button
                                        onClick={() => {
                                            if (pendingListAfterCreate) {
                                                setCreationStep('waiting');
                                                startEarlyPopulation(pendingListAfterCreate);
                                            } else {
                                                setCreationStep('ranking' as any);
                                            }
                                        }}
                                        className="group w-full p-4 border-2 border-slate-100 hover:border-black rounded-xl transition-all text-left flex items-start gap-4"
                                    >
                                        <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                                            <Loader2 className="h-5 w-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <div className="font-black text-sm uppercase tracking-tight">Magic Help (AI)</div>
                                            <div className="text-[10px] font-bold text-slate-400 leading-tight mt-0.5 uppercase">We'll generate a draft for you based on the title.</div>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => setCreationStep('drafting')}
                                        className="group w-full p-4 border-2 border-slate-100 hover:border-black rounded-xl transition-all text-left flex items-start gap-4"
                                    >
                                        <div className="p-2 bg-purple-50 rounded-lg group-hover:bg-purple-100 transition-colors">
                                            <Pencil className="h-5 w-5 text-purple-600" />
                                        </div>
                                        <div>
                                            <div className="font-black text-sm uppercase tracking-tight">Manual Entry</div>
                                            <div className="text-[10px] font-bold text-slate-400 leading-tight mt-0.5 uppercase">Draft your own list from scratch (10 items).</div>
                                        </div>
                                    </button>
                                </CardContent>
                            </>
                        ) : creationStep === 'drafting' ? (
                            <>
                                <CardHeader className="p-5 pb-2 text-center pt-8">
                                    <Pencil className="h-8 w-8 text-slate-200 mx-auto mb-4" />
                                    <CardTitle className="text-xl font-black uppercase tracking-tighter">Draft your list</CardTitle>
                                    <div className="mt-4 px-6">
                                        <Input
                                            value={editSession.title || ''}
                                            onChange={(e) => setEditSession(s => ({ ...s, title: e.target.value }))}
                                            placeholder="LIST TITLE"
                                            className="h-12 border-2 border-slate-100 rounded-xl font-black text-center text-lg focus-visible:ring-black uppercase placeholder:text-slate-200"
                                        />
                                    </div>
                                    <CardDescription className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-4 px-8 leading-relaxed">
                                        Enter up to 10 items for your ranking
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-5 pt-2 space-y-2 overflow-y-auto max-h-[50vh]">
                                    {freeFormItems.map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-3">
                                            <span className="w-6 text-[10px] font-black text-slate-300">#{idx + 1}</span>
                                            <Input
                                                value={item}
                                                onChange={(e) => {
                                                    const newItems = [...freeFormItems];
                                                    newItems[idx] = e.target.value;
                                                    setFreeFormItems(newItems);
                                                }}
                                                placeholder={`Item #${idx + 1}`}
                                                className="h-10 border-2 border-slate-50 rounded-lg font-bold text-sm focus-visible:ring-black uppercase"
                                                autoFocus={idx === 0}
                                            />
                                        </div>
                                    ))}
                                    <div className="pt-4 space-y-3">
                                        <Button
                                            onClick={handleCreateFreeForm}
                                            disabled={isUpdatingTitle || !freeFormItems.some(i => i.trim())}
                                            className="w-full h-14 bg-black hover:bg-slate-800 text-white font-black uppercase tracking-widest text-sm rounded-xl transition-all shadow-md active:scale-[0.98]"
                                        >
                                            {isUpdatingTitle ? <Loader2 className="h-5 w-5 animate-spin" /> : "CREATE LIST"}
                                        </Button>
                                        <button
                                            onClick={() => setCreationStep('choosing')}
                                            className="w-full text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-slate-500 transition-colors py-2"
                                        >
                                            Back
                                        </button>
                                    </div>
                                </CardContent>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col min-h-0 relative">
                                {/* WHILE YOU WAIT VIEW - Hidden but keeps RankingList mounted if we want, 
                                    actually we want the LIST to be mounted to catch events. */}
                                <div className="flex-1 flex flex-col min-h-0 relative">
                                    <CardHeader className="p-5 pb-3 shrink-0">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex flex-row items-center justify-between gap-4">
                                                <div className="space-y-0 flex-1 min-w-0">
                                                    <div className={`text-[9px] font-black tracking-widest uppercase mb-0.5 ${categoryConfig[expandedList.category as keyof typeof categoryConfig]?.color || categoryConfig.other.color}`}>
                                                        {categoryConfig[expandedList.category as keyof typeof categoryConfig]?.label || expandedList.category}
                                                    </div>
                                                    {editSession.isExpanded && editSession.title !== null ? (
                                                        <div className="flex flex-col">
                                                            <Textarea
                                                                autoFocus
                                                                value={editSession.title}
                                                                placeholder="NAME YOUR LIST"
                                                                onChange={(e) => {
                                                                    setEditSession(s => ({ ...s, title: e.target.value }));
                                                                    e.target.style.height = 'auto';
                                                                    e.target.style.height = e.target.scrollHeight + 'px';
                                                                }}
                                                                onBlur={() => handleUpdateTitle(expandedList.id)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        handleUpdateTitle(expandedList.id);
                                                                    }
                                                                    if (e.key === 'Escape') {
                                                                        setEditSession({ id: null, title: null, isExpanded: false });
                                                                    }
                                                                }}
                                                                className={`text-3xl font-black tracking-tighter leading-tight min-h-[1.2em] h-auto p-0 border-none bg-transparent focus-visible:ring-0 uppercase resize-none placeholder:text-slate-300 placeholder:font-black placeholder:uppercase ${expandedList.id === 'temp-pending' && !editSession.title?.trim() ? 'text-slate-300' : 'text-slate-900'}`}
                                                                rows={1}
                                                            />
                                                            {isUpdatingTitle && <span className="text-[8px] font-mono text-slate-400">FETCHING LIST...</span>}
                                                        </div>
                                                    ) : (
                                                        <CardTitle
                                                            onClick={() => {
                                                                if (currentUserId !== expandedList.user_id) return;
                                                                setEditSession({ id: expandedList.id, title: expandedList.title.toUpperCase(), isExpanded: true });
                                                            }}
                                                            className={`text-3xl font-black tracking-tighter text-slate-900 leading-tight py-0.5 rounded break-words whitespace-pre-wrap ${currentUserId === expandedList.user_id ? 'cursor-text hover:text-slate-500 transition-colors' : 'cursor-default'}`}
                                                        >
                                                            {expandedList.title.toUpperCase()}
                                                        </CardTitle>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-1.5 relative shrink-0">
                                                    {/* ... Share / Respond controls ... */}
                                                </div>

                                                <div className="flex items-center gap-1.5 relative shrink-0">
                                                    {/* Share / Respond controls */}
                                                    {expandedList.id !== 'temp-pending' && !isPopulating && (
                                                        <div className="relative">
                                                            <Button
                                                                variant="default"
                                                                size="sm"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setShowShareOptions(!showShareOptions);
                                                                }}
                                                                className="h-8 px-4 text-[10px] font-black tracking-widest uppercase bg-slate-900 hover:bg-black text-white rounded-md flex items-center gap-2 shadow-sm transition-all"
                                                            >
                                                                <Share2 className="h-3 w-3" />
                                                                SHARE
                                                            </Button>

                                                            {showShareOptions && (
                                                                <>
                                                                    <div
                                                                        className="fixed inset-0 z-30"
                                                                        onClick={() => setShowShareOptions(false)}
                                                                    />
                                                                    <div className="absolute top-full right-0 mt-2 w-40 bg-white border border-slate-200 rounded-lg shadow-xl z-40 p-1 animate-in fade-in zoom-in-95 duration-100">
                                                                        <button
                                                                            onClick={() => { handleCopyLink(expandedList); setShowShareOptions(false); }}
                                                                            className="w-full flex items-center gap-2 p-2 rounded hover:bg-slate-50 text-[10px] font-bold text-slate-700 transition-colors"
                                                                        >
                                                                            <Copy className="h-3 w-3" />
                                                                            COPY LINK
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                const authorName = expandedList.profiles?.display_name || expandedList.profiles?.username || 'Someone';
                                                                                const text = `${authorName} made a list on Rank and File. Take a look, and respond.`;
                                                                                const url = window.location.href;
                                                                                window.open(`mailto:?subject=${encodeURIComponent(expandedList.title)}&body=${encodeURIComponent(text + '\n' + url)}`);
                                                                                setShowShareOptions(false);
                                                                            }}
                                                                            className="w-full flex items-center gap-2 p-2 rounded hover:bg-slate-50 text-[10px] font-bold text-slate-700 transition-colors"
                                                                        >
                                                                            <Mail className="h-3 w-3" />
                                                                            EMAIL
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                const authorName = expandedList.profiles?.display_name || expandedList.profiles?.username || 'Someone';
                                                                                const text = `${authorName} made a list on Rank and File. Take a look, and respond.`;
                                                                                const url = window.location.href;
                                                                                window.open(`sms:?&body=${encodeURIComponent(text + ' ' + url)}`);
                                                                                setShowShareOptions(false);
                                                                            }}
                                                                            className="w-full flex items-center gap-2 p-2 rounded hover:bg-slate-50 text-[10px] font-bold text-slate-700 transition-colors"
                                                                        >
                                                                            <MessageCircle className="h-3 w-3" />
                                                                            TEXT
                                                                        </button>
                                                                        <button
                                                                            onClick={() => { handleShareTwitter(expandedList); setShowShareOptions(false); }}
                                                                            className="w-full flex items-center gap-2 p-2 rounded hover:bg-slate-50 text-[10px] font-bold text-slate-700 transition-colors"
                                                                        >
                                                                            <Twitter className="h-3 w-3" />
                                                                            TWEET
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                const url = encodeURIComponent(`${window.location.origin}?listId=${expandedList.id}`);
                                                                                window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
                                                                                setShowShareOptions(false);
                                                                            }}
                                                                            className="w-full flex items-center gap-2 p-2 rounded hover:bg-slate-50 text-[10px] font-bold text-slate-700 transition-colors"
                                                                        >
                                                                            <Facebook className="h-3 w-3" />
                                                                            FACEBOOK
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                const authorName = expandedList.profiles?.display_name || expandedList.profiles?.username || 'Someone';
                                                                                const text = encodeURIComponent(`${authorName} made a list on Rank and File: "${expandedList.title}"`);
                                                                                const url = encodeURIComponent(`${window.location.origin}?listId=${expandedList.id}`);
                                                                                window.open(`https://bsky.app/intent/compose?text=${text}%20${url}`, '_blank');
                                                                                setShowShareOptions(false);
                                                                            }}
                                                                            className="w-full flex items-center gap-2 p-2 rounded hover:bg-slate-50 text-[10px] font-bold text-slate-700 transition-colors"
                                                                        >
                                                                            <Cloud className="h-3 w-3" />
                                                                            BLUESKY
                                                                        </button>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Respond Button (Only for Non-Owners) */}
                                                    {currentUserId !== expandedList.user_id && (
                                                        <ResponseBtn
                                                            parentListId={expandedList.id}
                                                            parentTitle={expandedList.title}
                                                            onResponseCreated={async (newList: any) => {
                                                                setLists(prev => prev.map(list => {
                                                                    if (list.id === expandedList.id) {
                                                                        return { ...list, response_count: (list.response_count || 0) + 1 };
                                                                    }
                                                                    return list;
                                                                }));

                                                                try {
                                                                    const thread = await getThread(expandedList.id);
                                                                    router.refresh();

                                                                    if (thread) {
                                                                        setResponseView({
                                                                            isOpen: true,
                                                                            threadData: thread,
                                                                            draftId: newList.id
                                                                        });
                                                                        setExpandedListId(null);
                                                                        setEditSession({ id: null, title: null, isExpanded: false });
                                                                    } else {
                                                                        setExpandedListId(null);
                                                                    }
                                                                } catch (err) {
                                                                    console.error('Failed to load thread:', err);
                                                                    toast.error('Failed to open response view');
                                                                    setExpandedListId(null);
                                                                }
                                                            }}
                                                        />
                                                    )}

                                                    {/* View Responses Button (Owner with responses) */}
                                                    {currentUserId === expandedList.user_id && expandedList.response_count > 0 && (
                                                        <Button
                                                            size="sm"
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                try {
                                                                    const thread = await getThread(expandedList.id);
                                                                    if (thread) {
                                                                        setExpandedListId(null);
                                                                        setShowMap(false);
                                                                        setResponseView({
                                                                            isOpen: true,
                                                                            threadData: thread,
                                                                            draftId: null
                                                                        });
                                                                    }
                                                                } catch (err) {
                                                                    console.error('Failed to load thread:', err);
                                                                    toast.error('Failed to load responses');
                                                                }
                                                            }}
                                                            className="h-7 px-3 text-[9px] font-black tracking-widest uppercase bg-blue-500 hover:bg-blue-600 text-white rounded-md flex items-center gap-1.5"
                                                        >
                                                            <MessageSquare className="h-2.5 w-2.5" />
                                                            {expandedList.response_count} {expandedList.response_count === 1 ? 'RESPONSE' : 'RESPONSES'}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* INTEGRATED COMMENT AREA (Description) */}
                                            {currentUserId === expandedList.user_id ? (
                                                <div
                                                    className="mt-2 group"
                                                    onMouseLeave={async () => {
                                                        if (isCommentDirty.current && waitingComment.trim() && expandedList.id !== 'temp-pending') {
                                                            const newComment = {
                                                                id: `temp-${Date.now()}`,
                                                                user_id: currentUserId,
                                                                list_id: expandedList.id,
                                                                content: waitingComment.trim(),
                                                                created_at: new Date().toISOString(),
                                                                profiles: { username: currentUsername, display_name: currentDisplayName }
                                                            };

                                                            // Optimistic update
                                                            setLists(prev => prev.map(l => l.id === expandedList.id ? {
                                                                ...l,
                                                                comments: [...(l.comments || []).filter((c: any) => c.user_id !== currentUserId), newComment]
                                                            } : l));

                                                            await upsertComment(expandedList.id, waitingComment.trim());
                                                            isCommentDirty.current = false;
                                                        }
                                                    }}
                                                >
                                                    <Textarea
                                                        placeholder={isPopulating ? "Building your list... jot down some notes?" : "Jot down some notes-what should people know about your list?"}
                                                        value={waitingComment}
                                                        autoFocus={isWaitingForComment}
                                                        onChange={(e) => {
                                                            setWaitingComment(e.target.value);
                                                            isCommentDirty.current = true;
                                                        }}
                                                        onBlur={async () => {
                                                            if (isCommentDirty.current && waitingComment.trim() && expandedList.id !== 'temp-pending') {
                                                                const newComment = {
                                                                    id: `temp-${Date.now()}`,
                                                                    user_id: currentUserId,
                                                                    list_id: expandedList.id,
                                                                    content: waitingComment.trim(),
                                                                    created_at: new Date().toISOString(),
                                                                    profiles: { username: currentUsername, display_name: currentDisplayName }
                                                                };

                                                                // Optimistic update
                                                                setLists(prev => prev.map(l => l.id === expandedList.id ? {
                                                                    ...l,
                                                                    comments: [...(l.comments || []).filter((c: any) => c.user_id !== currentUserId), newComment]
                                                                } : l));

                                                                await upsertComment(expandedList.id, waitingComment.trim());
                                                                isCommentDirty.current = false;
                                                            }
                                                        }}
                                                        className="min-h-[60px] max-h-[120px] font-bold text-sm resize-none border-none bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus-visible:ring-1 focus-visible:ring-slate-100 rounded-xl p-3 placeholder:opacity-40 transition-all overflow-y-auto"
                                                    />
                                                </div>
                                            ) : waitingComment && (
                                                <div className="mt-2 px-3 py-2 bg-slate-50/50 rounded-xl border border-slate-100/50">
                                                    <p className="text-xs font-medium text-slate-600 italic leading-relaxed">
                                                        "{waitingComment}"
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Search Section Inside Header - Only for Owner, only after list is named, and not while populating */}
                                        {
                                            currentUserId === expandedList.user_id && expandedList.id !== 'temp-pending' && !isPopulating && (
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
                                                            className="absolute left-5 right-5 mt-1 bg-white border border-slate-100 rounded-xl shadow-2xl z-50 p-1 max-h-[300px] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in duration-200"
                                                            onScroll={(e) => {
                                                                const target = e.currentTarget;
                                                                if (target.scrollHeight - target.scrollTop <= target.clientHeight + 50 && !isSearching && hasMore) {
                                                                    const nextPage = page + 1;
                                                                    setPage(nextPage);
                                                                    handleSearch(searchQuery, true, nextPage);
                                                                }
                                                            }}
                                                        >
                                                            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-50 mb-1">
                                                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Search Results</span>
                                                                <div className="flex items-center gap-3">
                                                                    {searchResults.length > 0 && itemsToPlaces(searchResults).length > 0 && (
                                                                        <button
                                                                            onClick={() => setShowMap(!showMap)}
                                                                            className="text-[9px] font-black uppercase tracking-widest text-green-600 hover:text-green-700 flex items-center gap-1"
                                                                        >
                                                                            <MapPin className="h-2.5 w-2.5" />
                                                                            {showMap ? 'Hide Map' : 'View on Map'}
                                                                        </button>
                                                                    )}
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
                                                                            <div className="text-[9px] text-slate-400 truncate uppercase font-mono">{item.subtitle}</div>
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
                                            )
                                        }
                                    </CardHeader >

                                    <CardContent className="p-5 pt-0 flex-1 overflow-y-auto min-h-0 custom-scrollbar">
                                        <RankingList
                                            initialItems={expandedList.list_items}
                                            listId={expandedList.id}
                                            category={expandedList.category}
                                            isPopulating={isPopulating || isBackgroundPopulating}
                                            onChange={(newItems) => {
                                                // Prevent updates to temp lists
                                                if (expandedList.id === 'temp-pending') return;

                                                setLists(prev => prev.map(l =>
                                                    l.id === expandedList.id ? { ...l, list_items: newItems } : l
                                                ));
                                            }}
                                        />

                                        {/* POPULATION FEEDBACK - Subtle Indicator */}
                                        {isPopulating && (
                                            <div className="mt-4 px-4 py-2 border border-slate-100 rounded-lg bg-slate-50/50 flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                                <div className="w-full h-1 bg-slate-200/50 rounded-full overflow-hidden relative">
                                                    <div
                                                        className="absolute top-0 bottom-0 w-[40%] bg-slate-400/30 rounded-full"
                                                        style={{
                                                            animation: 'slide-puck-modal 2s ease-in-out infinite alternate'
                                                        }}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between w-full">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                                        {populatedCount > 0 ? `Found ${populatedCount} items` : ""}
                                                    </span>
                                                    {populatedCount > 0 && (
                                                        <button
                                                            onClick={() => handleSubmitWaitingComment()}
                                                            className="text-[9px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-700"
                                                        >
                                                            Done
                                                        </button>
                                                    )}
                                                </div>
                                                <style dangerouslySetInnerHTML={{
                                                    __html: `
                                                    @keyframes slide-puck-modal {
                                                        0% { left: 0%; }
                                                        100% { left: 60%; }
                                                    }
                                                `}} />
                                            </div>
                                        )}
                                        {/* FEATURE: Places Map — inline map toggle */}
                                        {['places', 'bars', 'restaurants', 'food', 'other', 'more', 'food & drink', 'drinks'].some(cat => expandedList.category?.toLowerCase().includes(cat)) && itemsToPlaces(expandedList.list_items).length > 0 && (
                                            <div className="mt-4 pt-3 border-t border-slate-100">
                                                <button
                                                    onClick={() => {
                                                        const newShowMap = !showMap;
                                                        setShowMap(newShowMap);
                                                        if (newShowMap) {
                                                            setSearchResults([]);
                                                            setSearchQuery('');
                                                        }
                                                    }}
                                                    className={`flex items-center gap-2 px-4 py-2 w-full justify-center border rounded-lg transition-colors ${showMap ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-50 hover:bg-red-50 border-slate-200 text-slate-600 hover:text-red-600'}`}
                                                >
                                                    <MapPin className="h-4 w-4" />
                                                    <span className="font-black text-[10px] uppercase tracking-widest">{showMap ? 'Hide Map' : 'View on Map'}</span>
                                                </button>
                                                {showMap && (
                                                    <div className="mt-3">
                                                        <PlacesMap
                                                            items={itemsToPlaces(expandedList.list_items)}
                                                            title={expandedList.title}
                                                            onClose={() => setShowMap(false)}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {/* FEATURE: Music Playlist Export */}
                                        {expandedList.category === 'music' && expandedList.list_items.length > 0 && (
                                            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-center">
                                                <PlaylistExport items={expandedList.list_items} listTitle={expandedList.title} />
                                            </div>
                                        )}
                                    </CardContent>
                                </div>
                            </div>
                        )
                        }
                    </Card >
                </div >
            )}

            {/* Response Split View Modal */}
            {
                responseView.isOpen && responseView.threadData && (
                    <ResponseSplitView
                        thread={responseView.threadData}
                        initialDraftId={responseView.draftId}
                        currentUserId={currentUserId || ''}
                        currentUsername={currentUsername}
                        currentDisplayName={currentDisplayName}
                        onClose={() => {
                            setResponseView({ isOpen: false, threadData: null, draftId: null });
                            router.refresh();
                        }}
                        onStartResponse={async (parentListId: string) => {
                            try {
                                const { createResponse } = await import('@/app/actions');
                                const newList = await createResponse(parentListId);

                                // Optimistic update: Increment response count immediately
                                setLists(prev => prev.map(list => {
                                    if (list.id === parentListId) {
                                        return { ...list, response_count: (list.response_count || 0) + 1 };
                                    }
                                    return list;
                                }));

                                toast.success(`Started response to "${responseView.threadData?.[0]?.title}"`);
                                // Re-fetch thread to include the new response
                                const updatedThread = await getThread(parentListId);
                                if (updatedThread) {
                                    setResponseView({
                                        isOpen: true,
                                        threadData: updatedThread,
                                        draftId: newList.id
                                    });
                                }
                            } catch (err) {
                                console.error('Failed to create response:', err);
                                toast.error('Failed to create response');
                            }
                        }}
                    />
                )
            }

            <CommentModal
                isOpen={commentModal.isOpen}
                onClose={() => setCommentModal(prev => ({ ...prev, isOpen: false }))}
                listId={commentModal.listId || ""}
                listTitle={commentModal.listTitle}
                currentUserId={currentUserId}
            />

            {/* Conditional Feedback Hole */}
            {
                !expandedListId && !responseView.isOpen && !showNameModal && !creationStep && (
                    <FeedbackHole />
                )
            }
        </div >
    );
}
