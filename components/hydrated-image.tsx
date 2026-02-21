'use client';

import React, { useState, useEffect } from 'react';
import { Ghost, Loader2, Music, BookOpen, Martini } from 'lucide-react';
import { hydrateItemImage } from '@/app/draft/actions';

interface HydratedImageProps {
    initialUrl: string | null;
    itemId: string;
    itemName: string;
    category?: string;
    className?: string;
    alt?: string;
    priority?: boolean;
}

export function HydratedImage({ initialUrl, itemId, itemName, category, className, alt, priority }: HydratedImageProps) {
    const [imageUrl, setImageUrl] = useState<string | null>(initialUrl);
    const [isLoading, setIsLoading] = useState(!initialUrl);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        let mounted = true;

        if (!imageUrl && itemName) {
            setIsLoading(true);
            hydrateItemImage(itemId, itemName, category)
                .then((url) => {
                    if (mounted) {
                        if (url) {
                            setImageUrl(url);
                        } else {
                            setHasError(true);
                        }
                    }
                })
                .catch(err => {
                    console.error('Hydration failed', err);
                    if (mounted) setHasError(true);
                })
                .finally(() => {
                    if (mounted) setIsLoading(false);
                });
        } else {
            setIsLoading(false);
        }

        return () => { mounted = false; };
    }, [itemId, itemName, imageUrl]);

    const getPlaceholderIcon = () => {
        const cat = category?.toLowerCase() || '';
        if (cat === 'music' || cat === 'songs' || cat === 'albums' || cat === 'artists') return <Music className={`w-12 h-12 text-slate-400/80 ${isLoading ? 'animate-float-ghost' : ''}`} strokeWidth={1.5} />;
        if (cat === 'books' || cat === 'reading' || cat === 'authors') return <BookOpen className={`w-12 h-12 text-slate-400/80 ${isLoading ? 'animate-float-ghost' : ''}`} strokeWidth={1.5} />;
        if (cat === 'food' || cat === 'drink' || cat === 'martini' || cat === 'bars' || cat === 'restaurants' || cat === 'places') return <Martini className={`w-12 h-12 text-slate-400/80 ${isLoading ? 'animate-float-ghost' : ''}`} strokeWidth={1.5} />;
        return <Ghost className={`w-12 h-12 text-slate-400/80 ${isLoading ? 'animate-float-ghost' : ''}`} strokeWidth={1.5} />;
    };

    if (!imageUrl || hasError) {
        return (
            <div className={`bg-slate-50 border border-slate-100/50 flex items-center justify-center relative overflow-hidden group ${className}`}>
                <div className={`transition-all duration-1000 flex items-center justify-center w-full h-full ${isLoading ? 'opacity-80 scale-110' : 'opacity-40 scale-100 grayscale'}`}>
                    {getPlaceholderIcon()}
                </div>
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @keyframes float-ghost {
                        0% { transform: translate(0, 0) rotate(0deg); }
                        25% { transform: translate(4px, -6px) rotate(2deg); }
                        50% { transform: translate(-2px, -8px) rotate(-1deg); }
                        75% { transform: translate(-6px, -4px) rotate(1deg); }
                        100% { transform: translate(0, 0) rotate(0deg); }
                    }
                    .animate-float-ghost {
                        animation: float-ghost 6s ease-in-out infinite;
                    }
                `}} />
            </div>
        );
    }

    const getLoadingIcon = () => {
        const cat = category?.toLowerCase() || '';
        if (cat === 'music' || cat === 'songs' || cat === 'albums') return <Music className="w-10 h-10 text-slate-400 animate-float-ghost" strokeWidth={1.5} />;
        if (cat === 'books') return <BookOpen className="w-10 h-10 text-slate-400 animate-float-ghost" strokeWidth={1.5} />;
        if (cat === 'food' || cat === 'drink' || cat === 'places') return <Martini className="w-10 h-10 text-slate-400 animate-float-ghost" strokeWidth={1.5} />;
        return <Ghost className="w-10 h-10 text-slate-400 animate-float-ghost" strokeWidth={1.5} />;
    };

    return (
        <div className={`relative overflow-hidden ${className}`}>
            <img
                src={imageUrl}
                alt={alt || itemName}
                onError={() => setHasError(true)}
                className={`w-full h-full object-cover transition-opacity duration-700 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
            />
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 backdrop-blur-sm">
                    {getLoadingIcon()}
                </div>
            )}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes float-ghost {
                    0% { transform: translate(0, 0) rotate(0deg); }
                    25% { transform: translate(4px, -6px) rotate(2deg); }
                    50% { transform: translate(-2px, -8px) rotate(-1deg); }
                    75% { transform: translate(-6px, -4px) rotate(1deg); }
                    100% { transform: translate(0, 0) rotate(0deg); }
                }
                .animate-float-ghost {
                    animation: float-ghost 6s ease-in-out infinite;
                }
            `}} />
        </div>
    );
}
