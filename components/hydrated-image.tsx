'use client';

import React, { useState, useEffect } from 'react';
import { Ghost, Loader2 } from 'lucide-react';
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

    if (!imageUrl || hasError) {
        return (
            <div className={`bg-slate-50 border border-slate-100/50 flex items-center justify-center relative overflow-hidden group ${className}`}>
                <div className={`transition-all duration-1000 ${isLoading ? 'opacity-40 scale-100' : 'opacity-20 scale-90 grayscale'}`}>
                    <Ghost className={`w-1/2 h-1/2 max-w-[24px] text-slate-400 ${isLoading ? 'animate-pulse' : ''}`} />
                </div>
            </div>
        );
    }

    return (
        <div className={`relative overflow-hidden ${className}`}>
            <img
                src={imageUrl}
                alt={alt || itemName}
                onError={() => setHasError(true)}
                className={`w-full h-full object-cover transition-opacity duration-700 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
            />
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                    <Ghost className="w-1/2 h-1/2 max-w-[24px] text-slate-200 animate-pulse" />
                </div>
            )}
        </div>
    );
}
