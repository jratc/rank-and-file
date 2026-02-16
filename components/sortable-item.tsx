'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { GripVertical, X } from 'lucide-react'
/* FEATURE: Music Player */
import { MusicPlayer } from './music-link'

interface SortableItemProps {
    id: string;
    item: any;
    onRemove: (id: string) => void;
    onDoubleClick?: () => void;
}

export function SortableItem({ id, item, onRemove, onDoubleClick }: SortableItemProps) {
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
            <Card
                className="flex flex-row items-center p-2 cursor-grab active:cursor-grabbing hover:bg-slate-50 transition-all border-slate-200 bg-white shadow-sm hover:shadow-md group gap-0"
                {...attributes}
                {...listeners}
                onDoubleClick={() => { console.log('SortableItem: Double Click fired'); if (onDoubleClick) onDoubleClick(); }}
            >
                <div
                    className="flex-1 flex items-center gap-5 pl-4 min-w-0 pointer-events-none"
                >
                    <div className="w-16 h-16 bg-slate-100 rounded-lg overflow-hidden shrink-0 shadow-sm border border-slate-200 pointer-events-auto">
                        {item.metadata.imageUrl && (
                            <img
                                src={item.metadata.imageUrl}
                                alt={item.metadata.name}
                                className="w-full h-full object-cover pointer-events-none"
                            />
                        )}
                    </div>

                    <div className="min-w-0 flex-1 py-1 w-full pointer-events-auto">
                        <h4 className="font-black text-xl tracking-tighter leading-tight break-words whitespace-pre-wrap text-slate-900 uppercase w-full">{item.metadata.name}</h4>
                        <p className="font-mono text-[10px] font-bold text-slate-400 tracking-widest uppercase mt-1">{item.metadata.subtitle}</p>
                        {/* FEATURE: Music Links */}
                        {item.metadata.category === 'music' && (
                            <div className="mt-1.5" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                                <MusicPlayer item={item} />
                            </div>
                        )}
                    </div>
                </div>


                <div className="flex flex-col items-center justify-center pl-2 pr-1 border-l border-slate-100">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full"
                        onClick={() => onRemove(item.id)}
                        onPointerDown={(e) => e.stopPropagation()} // Prevent drag start
                        onMouseDown={(e) => e.stopPropagation()}   // Prevent drag start
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </Card>
        </div>
    );
}
