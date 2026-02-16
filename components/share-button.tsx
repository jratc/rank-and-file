'use client';

import { useState } from 'react';
import { Share2, Check, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function ShareButton({ title, text, url }: { title: string; text?: string; url?: string }) {
    const [copied, setCopied] = useState(false);

    const handleShare = async () => {
        const shareUrl = url || window.location.href;

        // Try native share first (mobile/supported browsers)
        if (navigator.share) {
            try {
                await navigator.share({
                    title,
                    text,
                    url: shareUrl,
                });
                return;
            } catch (err) {
                // Ignore abort errors
                if ((err as Error).name !== 'AbortError') {
                    console.error('Error sharing:', err);
                }
            }
        }

        // Fallback to clipboard
        try {
            const textToCopy = text ? `${text} ${shareUrl}` : shareUrl;
            await navigator.clipboard.writeText(textToCopy);
            setCopied(true);
            toast.success('Link copied to clipboard');
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error('Failed to copy link');
        }
    };

    return (
        <Button
            variant="outline"
            size="sm"
            className="gap-2 font-bold uppercase tracking-wider"
            onClick={handleShare}
        >
            {copied ? (
                <>
                    <Check className="h-4 w-4" />
                    Copied
                </>
            ) : (
                <>
                    <Share2 className="h-4 w-4" />
                    Share
                </>
            )}
        </Button>
    );
}
