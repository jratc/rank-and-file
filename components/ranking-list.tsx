'use client';

/* FEATURE: Music Player — to disable, comment out the MusicPlayer import below */
import { MusicPlayer } from './music-link';
import { HydratedImage } from './hydrated-image';
import { updateListOrder, deleteListItem, loadMoreItems } from '@/app/draft/actions';
import { deleteListItems } from '@/app/actions';
import { RankedItemCard } from './ranked-item-card';
import { toast } from 'sonner';
import { Loader2, MapPin, Plus } from 'lucide-react';

import React, { useState, useEffect, useRef } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import { PlacesMap } from './places-map';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableItem } from './sortable-item';

import { createClient } from '@/lib/supabase/client';

interface RankingListProps {
    initialItems: any[];
    listId: string;
    category?: string;
    title?: string;
    onChange?: (newItems: any[]) => void;
    readOnly?: boolean;
    isPopulating?: boolean;
    showMap?: boolean;
    mapItems?: any[];
}

export function RankingList({
    initialItems,
    listId,
    category = 'items',
    title,
    onChange,
    readOnly = false,
    isPopulating = false,
    showMap = false,
    mapItems = []
}: RankingListProps) {
    const [items, setItems] = useState(initialItems);
    const [isSaving, setIsSaving] = useState(false);
    const lastManualOrderRef = useRef<number>(0);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [displayLimit, setDisplayLimit] = useState(25);
    const [prevListId, setPrevListId] = useState(listId);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );
    const prevInitialItemsLength = useRef(initialItems.length);

    // Sync items from props, BUT only if the list ID has changed 
    // or if the initialItems prop has actually changed from the outside.
    useEffect(() => {
        const idChanged = listId !== prevListId;
        const propLengthChanged = initialItems.length !== prevInitialItemsLength.current;

        if (idChanged) {
            setItems(initialItems);
            setPrevListId(listId);
            setDisplayLimit(25);
            prevInitialItemsLength.current = initialItems.length;
        } else if (propLengthChanged || isPopulating) {
            // IGNORE prop updates if we just did a manual reorder
            if (Date.now() - lastManualOrderRef.current < 4000) {
                console.log('[RankingList] Skipping prop sync during manual reorder cooldown');
                return;
            }

            // Only sync if the prop actually changed or we are populating
            setItems(initialItems);
            prevInitialItemsLength.current = initialItems.length;

            if (isPopulating) {
                setDisplayLimit(Math.max(25, initialItems.length));
            }
        }
    }, [initialItems, listId, prevListId, isPopulating]);

    // REALTIME SUBSCRIPTION
    useEffect(() => {
        if (!listId || listId === 'temp-pending') return;

        console.log(`[RankingList] Subscribing to realtime for ${listId}`);
        const supabase = createClient();
        const channel = supabase
            .channel(`list-items-${listId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'list_items',
                    filter: `list_id=eq.${listId}`,
                },
                (payload) => {
                    // IGNORE realtime updates if we just did a manual reorder (avoid jump-back)
                    if (Date.now() - lastManualOrderRef.current < 4000) {
                        console.log('[Realtime] Ignoring update during manual reorder cooldown');
                        return;
                    }

                    console.log('[Realtime] Change received:', payload);

                    if (payload.eventType === 'INSERT') {
                        console.log('[Realtime] NEW item:', payload.new.id);
                        const newItem = {
                            id: payload.new.entity_id,
                            rank: payload.new.rank,
                            metadata: payload.new.metadata,
                        };
                        setItems((currentItems) => {
                            // Avoid duplicates
                            if (currentItems.some((i) => i.id === newItem.id)) {
                                console.log('[Realtime] Duplicate ignored:', newItem.id);
                                return currentItems;
                            }
                            const newSafeItems = [...currentItems, newItem];
                            // Sort by rank to maintain order
                            const sorted = newSafeItems.sort((a, b) => (a.rank || 0) - (b.rank || 0));

                            // SYNC WITH PARENT
                            if (onChange) {
                                console.log('[Realtime] Notifying parent of sync for', listId);
                                onChange(sorted);
                            }

                            return sorted;
                        });
                    } else if (payload.eventType === 'DELETE') {
                        console.log('[Realtime] DELETING item:', payload.old.id);
                        setItems((currentItems) =>
                            currentItems.filter((i) => i.id !== payload.old.id)
                        );
                    } else if (payload.eventType === 'UPDATE') {
                        console.log('[Realtime] UPDATING item:', payload.new.id);
                        setItems((currentItems) => {
                            return currentItems.map((i) =>
                                i.id === payload.new.id ? { ...i, ...payload.new } : i
                            ).sort((a, b) => (a.rank || 0) - (b.rank || 0));
                        });
                    }
                }
            )
            .subscribe((status) => {
                console.log(`[Realtime] Subscription status for ${listId}:`, status);
            });

        return () => {
            console.log(`[RankingList] Unsubscribing from ${listId}`);
            supabase.removeChannel(channel);
        };
    }, [listId]);

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = items.findIndex((item) => item.id === active.id);
            const newIndex = items.findIndex((item) => item.id === over.id);
            const newItems = arrayMove(items, oldIndex, newIndex);

            // 1. Update local state
            setItems(newItems);

            // 2. Trigger side effects AFTER state update (not in render)
            saveOrder(newItems);
            if (onChange) onChange(newItems);
        }
    };

    const saveOrder = async (newItems: any[]) => {
        if (readOnly) return;
        setIsSaving(true);
        lastManualOrderRef.current = Date.now();
        const updates = newItems.map((item, index) => ({
            id: item.id,
            rank: index + 1
        }));

        try {
            await updateListOrder(listId, updates);
        } catch (e) {
            toast.error('Failed to save order');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemove = async (itemId: string) => {
        if (readOnly) return;

        // 1. Snapshot for rollback
        const previousItems = [...items];

        // 2. Optimistic update
        const newItems = items.filter(i => i.id !== itemId);
        setItems(newItems);
        if (onChange) onChange(newItems);

        try {
            const result = await deleteListItem(itemId);
            if (result.error) {
                toast.error(result.error || 'Failed to delete item');
                setItems(previousItems); // Rollback
                if (onChange) onChange(previousItems);
            } else {
                toast.success('Item removed');
            }
        } catch (e) {
            toast.error('Failed to delete item');
            setItems(previousItems); // Rollback
            if (onChange) onChange(previousItems);
        }
    };

    const handleDeleteBelow = async (cutoffIndex: number) => {
        if (readOnly) return;

        // cutoffIndex is the index of the last item to KEEP.
        // e.g. if cutoffIndex is 4 (Rank 5), we keep indices 0,1,2,3,4.

        // Removed confirmation as per request

        const itemsToKeep = items.slice(0, cutoffIndex + 1);
        const itemsToDelete = items.slice(cutoffIndex + 1);

        setItems(itemsToKeep); // Optimistic local UI
        if (onChange) onChange(itemsToKeep); // Optimistic parent sync

        // Trigger a background bulk delete
        deleteListItems(itemsToDelete.map(item => item.id))
            .then(() => {
                toast.success('List trimmed!');
            })
            .catch((err) => {
                console.error("Trim failed:", err);
                toast.error('Failed to trim list');
                // Rollback if needed
                setItems(items);
                if (onChange) onChange(items);
            });
    };

    const handleDoubleClick = (itemId: string) => {
        console.log('Double Click Detected on Item:', itemId);
        if (readOnly) return;

        const oldIndex = items.findIndex((item) => item.id === itemId);
        console.log('Item Index:', oldIndex);

        // Promote to rank 1 (index 0)
        if (oldIndex > 0) {
            const newIndex = 0; // Rank 1
            const newItems = arrayMove(items, oldIndex, newIndex);

            setItems(newItems);
            saveOrder(newItems);
            if (onChange) onChange(newItems);
        } else {
            console.log('Item is already at #1, ignoring.');
        }
    };

    const getRankColor = (index: number) => {
        const rank = index + 1;
        if (rank <= 5) return 'text-blue-500 dark:text-blue-400';
        if (rank <= 10) return 'text-green-500 dark:text-green-400';
        return 'text-slate-200 dark:text-slate-700';
    };

    if (items.length === 0) {
        if (title && !readOnly) {
            return (
                <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
                    {/* Items are loading or list is empty - no pucks animation as requested */}
                </div>
            );
        }
        return null;
    }

    // Read-Only View (No Drag and Drop)
    if (readOnly) {
        return (
            <div className="flex flex-col">
                <div className="space-y-4">
                    {items.slice(0, isPopulating ? items.length : displayLimit).map((item, index) => (
                        <div key={item.id} className="flex gap-2 items-center animate-in fade-in slide-in-from-left-4 duration-300" style={{ animationDelay: `${Math.min(index, 15) * 50}ms` }}>
                            <span className={`font-mono font-black text-3xl w-14 text-right tabular-nums shrink-0 ${getRankColor(index)}`}>
                                #{index + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                                <RankedItemCard
                                    item={item}
                                    category={category}
                                    className="border-none shadow-none bg-transparent p-0"
                                />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Populating Indicator */}
                {isPopulating && (
                    <div className="mt-6 flex flex-col items-center gap-3 animate-pulse">
                        <div className="flex gap-4 items-center w-full">
                            <div className="w-14 h-8 bg-slate-50 rounded-lg animate-pulse" />
                            <div className="flex-1 h-32 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-100 flex items-center justify-center">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Building your list... jot some thoughts down about your list while we work</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Load More Button (Pagination) */}
                {!isPopulating && items.length > displayLimit && (
                    <div className="mt-8 flex justify-center">
                        <button
                            onClick={() => setDisplayLimit(prev => prev + 15)}
                            className="px-6 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 font-black uppercase tracking-widest text-[10px] rounded-full transition-all"
                        >
                            Load More ({items.length - displayLimit} remaining)
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={items.map(i => i.id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="space-y-0">
                    {/* PLACEMENT: Map at the TOP for better mobile accessibility when toggled */}
                    {showMap && mapItems.length > 0 && (
                        <div className="mb-6 px-4 pl-16 animate-in fade-in slide-in-from-top-4 duration-500 w-full">
                            <div className="p-4 bg-slate-50 border-2 border-dashed border-slate-100 rounded-3xl">
                                <PlacesMap
                                    items={mapItems}
                                    title={title}
                                />
                            </div>
                        </div>
                    )}
                    {items.slice(0, isPopulating ? items.length : displayLimit).map((item, index) => (
                        <React.Fragment key={item.id}>
                            <div className="flex gap-2 items-center mb-1.5 flex-1 min-w-0">
                                <span className={`font-mono font-black text-3xl w-14 text-right tabular-nums shrink-0 ${getRankColor(index)}`}>#{index + 1}</span>
                                <div className="flex-1 min-w-0">
                                    <SortableItem
                                        id={item.id}
                                        item={item}
                                        rank={index + 1}
                                        category={category}
                                        onRemove={handleRemove}
                                        onDoubleClick={() => handleDoubleClick(item.id)}
                                        priority={index < 15}
                                    />
                                </div>
                            </div>

                            {/* Ranking Separators & Map */}
                            {index === 4 && items.length > 5 && (
                                <div className="flex items-center gap-4 py-4 mb-2 group/separator">
                                    <div className="w-14 text-right"></div>
                                    <div className="flex-1 flex items-center gap-4">
                                        <div className="h-px border-b-2 border-dashed border-slate-200 dark:border-white/10 flex-1"></div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleDeleteBelow(index)}
                                                className="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-red-500 bg-slate-50 hover:bg-red-50 px-3 py-1 rounded-full transition-colors whitespace-nowrap"
                                            >
                                                Delete Below
                                            </button>
                                        </div>
                                        <div className="h-px border-b-2 border-dashed border-slate-200 dark:border-white/10 flex-1"></div>
                                    </div>
                                </div>
                            )}


                            {index === 9 && items.length > 10 && (
                                <div className="flex items-center gap-4 py-4 mb-2 group/separator">
                                    <div className="w-14 text-right"></div>
                                    <div className="flex-1 flex items-center gap-4">
                                        <div className="h-px border-b-2 border-dashed border-slate-200 dark:border-white/10 flex-1"></div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleDeleteBelow(index)}
                                                className="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-red-500 bg-slate-50 hover:bg-red-50 px-3 py-1 rounded-full transition-colors whitespace-nowrap"
                                            >
                                                Delete Below
                                            </button>
                                        </div>
                                        <div className="h-px border-b-2 border-dashed border-slate-200 dark:border-white/10 flex-1"></div>
                                    </div>
                                </div>
                            )}
                        </React.Fragment>
                    ))}

                    {/* Reward-based Map Button: available for any count between 1 and 10 */}
                    {items.length > 0 && items.length <= 10 && !showMap && (['places', 'food', 'restaurants', 'bars'].includes(category?.toLowerCase() || '')) && (
                        <div className="mt-4 flex justify-center">
                            <button
                                onClick={() => {
                                    const event = new CustomEvent('toggle-map', { detail: { listId, show: true } });
                                    window.dispatchEvent(event);
                                }}
                                className="text-[10px] font-black uppercase tracking-widest text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 px-6 py-3 rounded-full transition-all shadow-lg flex items-center gap-2 active:scale-95"
                            >
                                <MapPin className="h-3 w-3" />
                                View on Map
                            </button>
                        </div>
                    )}
                </div>
            </SortableContext>

            {/* Populating Indicator */}
            {isPopulating && (
                <div className="mt-4 flex flex-col items-center gap-3 animate-pulse px-4">
                    <div className="flex gap-4 items-center w-full">
                        <div className="w-14 h-8 bg-slate-50 rounded-lg" />
                        <div className="flex-1 h-24 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-100 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin text-slate-200" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Finding more relevant items...</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Load More Button (Pagination) */}
            {!isPopulating && items.length > displayLimit && (
                <div className="mt-4 flex justify-center">
                    <button
                        onClick={() => setDisplayLimit(prev => Math.min(prev + 35, 50))}
                        className="px-6 py-2 bg-slate-900 hover:bg-black text-white font-black uppercase tracking-widest text-[10px] rounded-full transition-all shadow-md active:scale-95"
                    >
                        Load More ({Math.min(items.length, 50) - displayLimit} remaining)
                    </button>
                </div>
            )}

            {/* Load More Ideas Button (Fetch) */}
            {!readOnly && title && items.length < 50 && !isPopulating && (
                <div className="mt-8 flex justify-center">
                    <button
                        onClick={async () => {
                            if (items.length >= 50) return;
                            setIsLoadingMore(true);
                            try {
                                const currentCount = items.length;
                                // Requested logic: 15 initially, then up to 50.
                                // If we are at 15, we want 35 more.
                                const limit = 50 - currentCount;
                                const newItems = await loadMoreItems(listId, title, currentCount);
                                if (newItems && newItems.length > 0) {
                                    const updatedList = [...items, ...newItems].slice(0, 50);
                                    setItems(updatedList);
                                    // Removed notification as requested
                                    if (onChange) onChange(updatedList);
                                } else {
                                    toast.info("No more items found.");
                                }
                            } catch (e) {
                                toast.error("Failed to load more items.");
                            } finally {
                                setIsLoadingMore(false);
                            }
                        }}
                        disabled={isLoadingMore}
                        className="flex items-center gap-2 px-6 py-3 bg-black hover:bg-slate-800 text-white font-black uppercase tracking-widest text-[11px] rounded-full transition-all shadow-lg active:scale-95 disabled:opacity-50"
                    >
                        {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        {isLoadingMore ? 'Loading...' : 'Load more ideas'}
                    </button>
                </div>
            )}
        </DndContext>
    );
}
