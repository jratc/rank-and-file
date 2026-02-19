'use client';
// Trigger Vercel Rebuild - Fix Top 10 Button Visibility

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { GripVertical, X } from 'lucide-react'
import { RankedItemCard } from './ranked-item-card';

interface SortableItemProps {
    id: string;
    item: any;
    rank: number;
    category?: string;
    onRemove: (id: string) => void;
    onDoubleClick?: () => void;
}

export function SortableItem({ id, item, rank, category, onRemove, onDoubleClick }: SortableItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="mb-3">
            <RankedItemCard
                item={item}
                category={category}
                className="cursor-grab active:cursor-grabbing hover:bg-slate-50 hover:shadow-md"
                {...attributes}
                {...listeners}
                onDoubleClick={onDoubleClick}
            >
                <div className="flex flex-col items-center justify-center pl-2 pr-1 border-l border-slate-100 gap-1 bg-white z-10">
                    {rank > 10 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-auto px-1.5 text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all absolute right-12 shadow-sm border border-blue-100"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onDoubleClick) onDoubleClick();
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            TOP 10
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                        onClick={() => onRemove(item.id)}
                        onPointerDown={(e) => e.stopPropagation()} // Prevent drag start
                        onMouseDown={(e) => e.stopPropagation()}   // Prevent drag start
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </RankedItemCard>
        </div>
    );
}
