'use client';

/* FEATURE: Music Player — to disable, comment out the MusicPlayer import below */
import { MusicPlayer } from './music-link';
import { HydratedImage } from './hydrated-image';

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
import { updateListOrder, deleteListItem } from '@/app/draft/actions';
import { toast } from 'sonner';

interface RankingListProps {
    initialItems: any[];
    listId: string;
    category?: string;
    onChange?: (newItems: any[]) => void;
    readOnly?: boolean;
}

export function RankingList({ initialItems, listId, category = 'items', onChange, readOnly = false }: RankingListProps) {
    const [items, setItems] = useState(initialItems);
    const [isSaving, setIsSaving] = useState(false);

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

        // Trigger a background delete
        Promise.all(itemsToDelete.map(item => deleteListItem(item.id)))
            .then(() => {
                toast.success('List trimmed!');
                if (onChange) onChange(itemsToKeep);
            })
            .catch(() => {
                toast.error('Failed to trim list');
                // Could revert here, but tricky with multiple deletes.
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
        return null;
    }

    // Read-Only View (No Drag and Drop)
    // NOTE: Keep read-only view consistent with edit view colors? Yes.
    if (readOnly) {
        return (
            <div className="space-y-2">
                {items.map((item, index) => (
                    <div key={item.id} className="flex gap-4 items-center">
                        <span className={`font-mono font-black text-4xl w-14 text-right tabular-nums ${getRankColor(index)}`}>#{index + 1}</span>
                        <div className="flex-1">
                            {/* Static Item Card */}
                            <div className="mb-3">
                                <div className="flex flex-row items-center p-2 border border-slate-200 bg-white shadow-sm rounded-lg gap-0">
                                    <div className="flex-1 flex items-center gap-5 pl-4 min-w-0">
                                        <div className="w-16 h-16 bg-slate-100 rounded-lg overflow-hidden shrink-0 shadow-sm border border-slate-200">
                                            <HydratedImage
                                                initialUrl={item.metadata.imageUrl}
                                                itemId={item.id}
                                                itemName={item.metadata.name}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>

                                        <div className="min-w-0 flex-1 py-1 w-full">
                                            <h4 className="font-black text-xl tracking-tighter leading-tight break-words whitespace-pre-wrap text-slate-900 uppercase w-full">{item.metadata.name}</h4>
                                            <p className="font-mono text-[10px] font-bold text-slate-400 tracking-widest uppercase mt-1">{item.metadata.subtitle}</p>
                                            {/* FEATURE: Music Links */}
                                            {item.metadata.category === 'music' && (
                                                <MusicPlayer item={item} className="mt-1.5" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
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
        </DndContext>
    );
}
