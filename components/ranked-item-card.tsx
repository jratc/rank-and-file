'use client';

import React from 'react';
import { Card } from "@/components/ui/card";
import { HydratedImage } from './hydrated-image';
import { MusicPlayer } from './music-link';

interface RankedItemCardProps extends React.HTMLAttributes<HTMLDivElement> {
    item: any;
    category?: string;
    showMusicPlayer?: boolean;
    onDoubleClick?: () => void;
}

export function RankedItemCard({
    item,
    category,
    showMusicPlayer = true,
    className = "",
    children,
    onDoubleClick,
    ...props
}: RankedItemCardProps) {
    return (
        <Card
            className={`relative flex flex-row items-center p-2 border-slate-200 bg-white shadow-sm transition-all group gap-0 ${className}`}
            onDoubleClick={onDoubleClick}
            {...props}
        >
            <div className="flex-1 flex items-center gap-5 pl-4 min-w-0 select-none">
                <div className="w-16 h-16 bg-slate-100 rounded-lg overflow-hidden shrink-0 shadow-sm border border-slate-200">
                    <HydratedImage
                        initialUrl={item.metadata.imageUrl}
                        itemId={item.id}
                        itemName={item.metadata.name}
                        category={category}
                        className="w-full h-full object-cover pointer-events-none"
                    />
                </div>

                <div className="min-w-0 flex-1 py-1 w-full text-left">
                    <h4 className="font-black text-xl tracking-tighter leading-tight break-words whitespace-pre-wrap text-slate-900 uppercase w-full">
                        {item.metadata.name}
                    </h4>
                    <p className="font-mono text-[10px] font-bold text-slate-400 tracking-widest uppercase mt-1">
                        {item.metadata.subtitle}
                    </p>
                    {/* Music Player Integration */}
                    {showMusicPlayer && item.metadata.category === 'music' && (
                        <div className="mt-1.5" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                            <MusicPlayer item={item} />
                        </div>
                    )}
                </div>
            </div>
            {children}
        </Card>
    );
}
