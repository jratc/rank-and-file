'use client';

import React, { useState, useEffect } from 'react';
import { hydrateItemImage } from '@/app/draft/actions';

interface HydratedImageProps {
    initialUrl: string | null;
    itemId: string;
    itemName: string;
    category?: string;
    className?: string;
    alt?: string;
}

export function HydratedImage({ initialUrl, itemId, itemName, category, className, alt }: HydratedImageProps) {
    const [imageUrl, setImageUrl] = useState<string | null>(initialUrl);
    const [isLoading, setIsLoading] = useState(!initialUrl);

    useEffect(() => {
        let mounted = true;

        if (!imageUrl && itemName) {
            setIsLoading(true);
            hydrateItemImage(itemId, itemName, category)
                .then((url) => {
                    if (mounted && url) {
                        setImageUrl(url);
                    }
                })
                .catch(err => console.error('Hydration failed', err))
                .finally(() => {
                    if (mounted) setIsLoading(false);
                });
        } else {
            setIsLoading(false);
        }

        return () => { mounted = false; };
    }, [itemId, itemName, imageUrl]);

    if (!imageUrl) {
        return <div className={`bg-slate-100 ${className}`} />;
    }

    return (
        <img
            src={imageUrl}
            alt={alt || itemName}
            className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-700`}
        />
    );
}
