'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { deleteList, createList, updateListTitle, getThread, findListByTitle, updateProfile, getFollowingLists, addComment, addItemsToList, getComments, upsertComment, getListItems } from "@/app/actions";
import { detectAndPopulateList, populateBackgroundItems } from '@/app/populate';
import { searchEntities, addToList } from "@/app/search/actions";
import { RankedItem, Category } from "@/lib/types";
import { FeedbackHole } from './feedback-hole';
import { toast } from 'sonner';
import { ResponseSplitView } from '@/components/response-split-view';
import { CommentModal } from '@/components/comment-modal';

import { extractContext } from "@/lib/utils";

import { ExpandedListOverlay } from './dashboard/expanded-list-overlay';
import { ListGrid } from './dashboard/list-grid';
import { DashboardHeader } from './dashboard/dashboard-header';
import { categoryConfig, DashboardProps, EditSession, ResponseView } from './dashboard/shared';



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
    const commentValueRef = useRef('');
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
    const searchResultsRef = useRef<HTMLDivElement>(null);

    // Auto-dismiss search results when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchResultsRef.current && !searchResultsRef.current.contains(event.target as Node) &&
                searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
                setSearchResults([]);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
        // Remove confirmation dialog as per user request
        // if (!force && !confirm('Are you sure you want to delete this list?')) return;

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

    const closeExpandedView = useCallback(async () => {
        // SAVE COMMENT IF DIRTY BEFORE CLOSING
        if (isCommentDirty.current && expandedListId && expandedListId !== 'temp-pending') {
            const commentToSave = commentValueRef.current.trim();
            console.log(`[Dashboard] closeExpandedView: Saving dirty comment for ${expandedListId}`);

            // Mark as clean immediately to prevent race conditions
            isCommentDirty.current = false;

            // Optimistic sync for local state
            setLists(prev => prev.map(l => l.id === expandedListId ? {
                ...l,
                comments: commentToSave ? [...(l.comments || []).filter((c: any) => c.user_id !== currentUserId), {
                    id: `temp-${Date.now()}`,
                    user_id: currentUserId,
                    list_id: expandedListId,
                    content: commentToSave,
                    created_at: new Date().toISOString(),
                    profiles: { username: currentUsername, display_name: currentDisplayName }
                }] : [...(l.comments || []).filter((c: any) => c.user_id !== currentUserId)]
            } : l));

            // Fire and forget (non-blocking)
            upsertComment(expandedListId, commentToSave).catch(err => {
                console.error("[Dashboard] Auto-save on close failed:", err);
            });
        }

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

        // Only clear waiting comment if it wasn't dirty (or we just saved it/attempted to)
        // Reset dirty flag and comment state
        isCommentDirty.current = false;
        setWaitingComment('');

        // Clean up temp list if it was never saved
        if (expandedListId === 'temp-pending') {
            setLists(prev => prev.filter(l => l.id !== 'temp-pending'));
        }
    }, [expandedListId, waitingComment, currentUserId, currentUsername, currentDisplayName]);
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
                    populateBackgroundItems(targetList.id, targetList.title, targetList.category, popResult.count).then(async (result: any) => {
                        setIsBackgroundPopulating(false);
                        if (result.isComplete) {
                            setIsPopulatingComplete(true);
                        }

                        // Refetch the list items so we get the newly hydrated Maps/Images data immediately
                        try {
                            const freshItems = await getListItems(targetList.id);
                            if (freshItems && freshItems.length > 0) {
                                setLists(prev => prev.map(l => l.id === targetList.id ? { ...l, list_items: freshItems } : l));
                            }
                        } catch (e) {
                            console.error("[Dashboard] Failed to fetch enriched background items", e);
                        }
                    }).catch((err) => {
                        console.error("[Dashboard] Background population failed:", err);
                        setIsBackgroundPopulating(false);
                    });
                } else {
                    // Even if complete on first pass, wait a second for parallel hydration then refetch
                    setTimeout(async () => {
                        try {
                            const freshItems = await getListItems(targetList.id);
                            if (freshItems && freshItems.length > 0) {
                                setLists(prev => prev.map(l => l.id === targetList.id ? { ...l, list_items: freshItems } : l));
                            }
                        } catch (e) { }
                    }, 2500);
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

                setLists(prev => [newList, ...prev.filter(l => l.id !== 'temp-pending')]);
                setExpandedListId(newList.id);
                setIsUpdatingTitle(false);

                // Check if a comment was written during temp-pending phase
                const pendingComment = commentValueRef.current?.trim();
                if (pendingComment && isCommentDirty.current) {
                    console.log(`[Dashboard] Saving pending comment on list creation:`, pendingComment);
                    upsertComment(newList.id, pendingComment)
                        .then(() => {
                            isCommentDirty.current = false;
                            setLists(prev => prev.map(l => l.id === newList.id ? {
                                ...l,
                                comments: [{
                                    id: `temp-${Date.now()}`,
                                    user_id: currentUserId,
                                    list_id: newList.id,
                                    content: pendingComment,
                                    created_at: new Date().toISOString(),
                                    profiles: { username: currentUsername, display_name: currentDisplayName }
                                }]
                            } : l));
                        })
                        .catch(e => console.error("Failed to save pending comment", e));
                }

                // FOR 'MORE' CATEGORIES, SIMPLIFY: Skip choices, go straight to drafting
                if (newList.category === 'other' || newList.category === 'places') {
                    setCreationStep(null);
                    setEditSession({ id: null, title: null, isExpanded: false });
                    setIsUpdatingTitle(false);
                    return;
                }

                // FOR OTHER CATEGORIES (Music, Movies, Books):
                // Go to 'choosing' step so user can decide between AI and Manual.
                // This prevents AI from auto-filling the top 10 while they are drafting.
                setCreationStep('choosing');
                setIsUpdatingTitle(false);
                return;

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
            <DashboardHeader
                showNameModal={showNameModal}
                displayName={displayName}
                setDisplayName={setDisplayName}
                isSavingProfile={isSavingProfile}
                handleSaveProfile={handleSaveProfile}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                currentUserId={currentUserId}
                isGlobalSearchExpanded={isGlobalSearchExpanded}
                setIsGlobalSearchExpanded={setIsGlobalSearchExpanded}
                globalSearchQuery={globalSearchQuery}
                setGlobalSearchQuery={setGlobalSearchQuery}
                globalSearchInputRef={globalSearchInputRef}
                isLoadingFollowing={isLoadingFollowing}
                followingListsCount={followingLists.length}
            />

            {/* CATEGORY GRID / SWIPE VIEW */}
            <ListGrid
                categories={categories}
                groupedLists={groupedLists}
                currentUserId={currentUserId}
                expandedListId={expandedListId}
                setExpandedListId={setExpandedListId}
                setShowMap={setShowMap}
                setResponseView={setResponseView}
                respondedListIds={respondedListIds}
                isDeleting={isDeleting}
                handleDelete={handleDelete}
                editSession={editSession}
                setEditSession={setEditSession}
                handleUpdateTitle={handleUpdateTitle}
                handleCreateList={handleCreateList}
                showNameModal={showNameModal}
            />

            {/* Expanded Overlay */}
            <ExpandedListOverlay
                expandedList={expandedList}
                expandedListId={expandedListId}
                closeExpandedView={closeExpandedView}
                creationStep={creationStep}
                setCreationStep={setCreationStep}
                editSession={editSession}
                setEditSession={setEditSession}
                handleUpdateTitle={handleUpdateTitle}
                pendingListAfterCreate={pendingListAfterCreate}
                startEarlyPopulation={startEarlyPopulation}
                freeFormItems={freeFormItems}
                setFreeFormItems={setFreeFormItems}
                handleCreateFreeForm={handleCreateFreeForm}
                isUpdatingTitle={isUpdatingTitle}
                isPopulating={isPopulating}
                isBackgroundPopulating={isBackgroundPopulating}
                populatedCount={populatedCount}
                currentUserId={currentUserId}
                currentUsername={currentUsername}
                currentDisplayName={currentDisplayName}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                handleSearch={handleSearch}
                searchInputRef={searchInputRef}
                isSearching={isSearching}
                searchResults={searchResults}
                setSearchResults={setSearchResults}
                searchResultsRef={searchResultsRef}
                hasMore={hasMore}
                page={page}
                setPage={setPage}
                showMap={showMap}
                setShowMap={setShowMap}
                handleAddItem={handleAddItem}
                waitingComment={waitingComment}
                setWaitingComment={setWaitingComment}
                isWaitingForComment={isWaitingForComment}
                commentValueRef={commentValueRef}
                isCommentDirty={isCommentDirty}
                setLists={setLists}
                showShareOptions={showShareOptions}
                setShowShareOptions={setShowShareOptions}
                handleCopyLink={handleCopyLink}
                handleShareTwitter={handleShareTwitter}
                handleSubmitWaitingComment={handleSubmitWaitingComment}
                setResponseView={setResponseView}
                router={router}
            />

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
