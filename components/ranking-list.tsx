'use client';

/* FEATURE: Music Player — to disable, comment out the MusicPlayer import below */
import { MusicPlayer } from './music-link';
import { HydratedImage } from './hydrated-image';
import { updateListOrder, deleteListItem, loadMoreItems } from '@/app/draft/actions';
import { deleteListItems } from '@/app/actions';
import { RankedItemCard } from './ranked-item-card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import React, { useState, useEffect } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
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
}

export function RankingList({ initialItems, listId, category = 'items', title, onChange, readOnly = false }: RankingListProps) {
    const [items, setItems] = useState(initialItems);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

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

    useEffect(() => {
        setItems(initialItems);
    }, [initialItems]);

    // REALTIME SUBSCRIPTION
    useEffect(() => {
        if (!listId) return;

        console.log(`[RankingList] Subscribing to realtime for list: ${listId}`);
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
                    console.log('[Realtime] Change received:', payload);

                    if (payload.eventType === 'INSERT') {
                        const newItem = payload.new;
                        console.log('[Realtime] INSERTING item:', newItem.id);
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
        const newItems = items.filter(i => i.id !== itemId);
        setItems(newItems); // Optimistic update

        const result = await deleteListItem(itemId);
        if (result.error) {
            toast.error('Failed to delete item');
            setItems(items); // Revert
        } else {
            toast.success('Item removed');
            if (onChange) onChange(newItems);
        }
    };

    const handleDeleteBelow = async (cutoffIndex: number) => {
        if (readOnly) return;

        // cutoffIndex is the index of the last item to KEEP.
        // e.g. if cutoffIndex is 4 (Rank 5), we keep indices 0,1,2,3,4.

        // Removed confirmation as per request

        const itemsToKeep = items.slice(0, cutoffIndex + 1);
        const itemsToDelete = items.slice(cutoffIndex + 1);

        setItems(itemsToKeep); // Optimistic

        // Delete from DB
        // We can do this in parallel or usually just passing the new list to parent handles re-sync, 
        // but we likely need to explicitly delete the items from DB to clean up.
        // `updateListOrder` only updates order. `deleteListItem` deletes one.
        // We might need a bulk delete, but loop is okay for now as lists are small (10-20 items).

        // Trigger a background bulk delete
        deleteListItems(itemsToDelete.map(item => item.id))
            .then(() => {
                toast.success('List trimmed!');
                if (onChange) onChange(itemsToKeep);
            })
            .catch((err) => {
                console.error("Trim failed:", err);
                toast.error('Failed to trim list');
            });
    };

    const handleDoubleClick = (itemId: string) => {
        console.log('Double Click Detected on Item:', itemId);
        if (readOnly) return;

        const oldIndex = items.findIndex((item) => item.id === itemId);
        console.log('Item Index:', oldIndex);

        // Only promote if item is below rank 10 (index > 9)
        if (oldIndex > 9) {
            const newIndex = 9; // Rank 10
            const newItems = arrayMove(items, oldIndex, newIndex);

            setItems(newItems);
            saveOrder(newItems);
            if (onChange) onChange(newItems);

            toast.success('Moved to Top 10!');
        } else {
            console.log('Item is already in Top 10, ignoring.');
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
                <div className="flex flex-col items-center justify-center py-24 px-4 text-center animate-in fade-in duration-1000">
                    <div className="w-[70%] h-1 bg-slate-50/50 rounded-full overflow-hidden relative">
                        <div
                            className="absolute top-0 bottom-0 w-[20%] bg-slate-300/40 rounded-full"
                            style={{
                                animation: 'slide-puck-wide 3s ease-in-out infinite alternate'
                            }}
                        />
                    </div>
                    <style dangerouslySetInnerHTML={{
                        __html: `
                        @keyframes slide-puck-wide {
                            0% { left: 0%; }
                            100% { left: 80%; }
                        }
                    `}} />
                </div>
            );
        }
        return null;
    }

    // Read-Only View (No Drag and Drop)
    // NOTE: Keep read-only view consistent with edit view colors? Yes.
    if (readOnly) {
        return (
            <div className="space-y-4">
                {items.map((item, index) => (
                    <div key={item.id} className="flex gap-4 items-center animate-in fade-in slide-in-from-left-4 duration-300" style={{ animationDelay: `${index * 50}ms` }}>
                        <span className={`font-mono font-black text-4xl w-14 text-right tabular-nums shrink-0 ${getRankColor(index)}`}>
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
                    {items.map((item, index) => (
                        <React.Fragment key={item.id}>
                            <div className="flex gap-4 items-center mb-2">
                                <span className={`font-mono font-black text-4xl w-14 text-right tabular-nums ${getRankColor(index)}`}>#{index + 1}</span>
                                <div className="flex-1">
                                    <SortableItem
                                        id={item.id}
                                        item={item}
                                        rank={index + 1}
                                        category={category}
                                        onRemove={handleRemove}
                                        onDoubleClick={() => handleDoubleClick(item.id)}
                                    />
                                </div>
                            </div>

                            {/* Ranking Separators */}
                            {((index === 4 && items.length > 5) || (index === 9 && items.length > 10)) && (
                                <div className="flex items-center gap-4 py-4 mb-2 group/separator">
                                    <div className="w-14 text-right"></div> {/* Spacer for num */}
                                    <div className="flex-1 flex items-center gap-4">
                                        <div className="h-px border-b-2 border-dashed border-slate-200 dark:border-white/10 flex-1"></div>
                                        <button
                                            onClick={() => handleDeleteBelow(index)}
                                            className="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-red-500 bg-slate-50 hover:bg-red-50 px-3 py-1 rounded-full transition-colors whitespace-nowrap"
                                        >
                                            Delete Below
                                        </button>
                                        <div className="h-px border-b-2 border-dashed border-slate-200 dark:border-white/10 flex-1"></div>
                                    </div>
                                </div>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </SortableContext>
            {isSaving && <div className="text-xs text-gray-400 text-center mt-2">Saving order...</div>}

            {/* Load More Button */}
            {!readOnly && title && (
                <div className="mt-8 flex justify-center">
                    <button
                        onClick={async () => {
                            setIsLoadingMore(true);
                            try {
                                const newItems = await loadMoreItems(listId, title, items.length);
                                if (newItems && newItems.length > 0) {
                                    const updatedList = [...items, ...newItems];
                                    setItems(updatedList);
                                    toast.success(`Added ${newItems.length} more items!`);
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
                        className="flex items-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-full transition-all disabled:opacity-50"
                    >
                        {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {isLoadingMore ? 'Loading...' : 'Load More Ideas'}
                    </button>
                </div>
            )}
        </DndContext>
    );
}
