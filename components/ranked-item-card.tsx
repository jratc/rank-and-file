'use client';

import React from 'react';
import { Card } from "@/components/ui/card";
import { HydratedImage } from './hydrated-image';
import { MusicPlayer } from './music-link';
import { MapPin } from 'lucide-react';

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
            className={`relative flex flex-row items-center p-1.5 border-slate-200 bg-white shadow-sm transition-all group gap-0 ${className}`}
            onDoubleClick={onDoubleClick}
            {...props}
        >
            <div className="flex-1 flex items-center gap-2 pl-1.5 min-w-0 select-none">
                <div className="w-12 h-12 bg-slate-100 rounded-lg overflow-hidden shrink-0 shadow-sm border border-slate-200">
                    <HydratedImage
                        initialUrl={item.metadata.imageUrl}
                        itemId={item.id}
                        itemName={item.metadata.name}
                        category={category}
                        className="w-full h-full object-cover pointer-events-none"
                    />
                </div>

                <div className="min-w-0 flex-1 py-0.5 w-full text-left pr-2">
                    <h4 className="font-black text-sm tracking-tighter leading-tight text-slate-900 uppercase w-full break-words whitespace-normal">
                        {item.metadata.name}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5 min-w-0">
                        <p className="font-mono text-[9px] font-bold text-slate-400 tracking-widest uppercase flex-1 min-w-0 break-words whitespace-normal">
                            {item.metadata.subtitle}
                        </p>
                        {(item.metadata.lat || item.metadata.rawMetadata?.geometry?.location || item.metadata.rawMetadata?.geometry?.coordinates) && (
                            <div className="flex items-center gap-0.5 text-red-500 animate-in fade-in duration-500">
                                <MapPin className="w-2.5 h-2.5" />
                                <span className="text-[8px] font-black uppercase tracking-tighter">Loc</span>
                            </div>
                        )}
                    </div>
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
