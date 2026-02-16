'use client';

import { useState } from 'react';

/* ── FEATURE FLAG ──────────────────────────────────────────────
   To disable music player, comment out <MusicPlayer> usage
   in ranking-list.tsx / sortable-item.tsx (search "FEATURE: Music")
   ──────────────────────────────────────────────────────────── */

interface MusicPlayerProps {
    item: any; // The full list_item with metadata
    className?: string;
}

/**
 * Build a Spotify embed URL from a Spotify track/album ID.
 * Supports both track and album IDs.
 */
function getSpotifyEmbedUrl(item: any): string | null {
    const meta = item?.metadata?.rawMetadata;
    if (!meta) return null;

    // Spotify albums have an 'id' and 'type' field
    const id = meta.id;
    const type = meta.type || 'album'; // 'album', 'track', 'playlist'

    if (!id) return null;
    return `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`;
}

/**
 * Build an Apple Music embed URL from iTunes metadata.
 * Apple Music embeds use the format: https://embed.music.apple.com/us/album/{album-name}/{id}
 * We can construct it from the trackViewUrl or collectionViewUrl.
 */
function getAppleMusicEmbedUrl(item: any): string | null {
    const meta = item?.metadata?.rawMetadata;
    if (!meta) return null;

    // iTunes API returns trackViewUrl or collectionViewUrl like:
    // https://music.apple.com/us/album/kind-of-blue/268443092
    const url = meta.trackViewUrl || meta.collectionViewUrl || item?.metadata?.externalUrl;
    if (!url) return null;

    // Convert music.apple.com URL to embed.music.apple.com
    try {
        const parsed = new URL(url);
        if (parsed.hostname.includes('apple.com')) {
            return `https://embed.music.apple.com${parsed.pathname}`;
        }
    } catch {
        // fallback: try to construct from collection ID
        const collectionId = meta.collectionId || meta.trackId;
        if (collectionId) {
            return `https://embed.music.apple.com/us/album/${collectionId}`;
        }
    }

    return null;
}

/**
 * Inline embedded music player. Uses Spotify or Apple Music embeds
 * for full playback (for logged-in users of those services).
 */
export function MusicPlayer({ item, className = '' }: MusicPlayerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const provider = item?.metadata?.provider;

    const embedUrl = provider === 'spotify'
        ? getSpotifyEmbedUrl(item)
        : getAppleMusicEmbedUrl(item);

    if (!embedUrl) return null;

    const isSpotify = provider === 'spotify';

    return (
        <div className={className}>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setIsOpen(!isOpen);
                }}
                className={`
                    inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                    text-[9px] font-black uppercase tracking-widest
                    transition-all duration-200 shrink-0
                    ${isOpen
                        ? 'bg-black text-white shadow-md'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                    }
                `}
                title={isOpen ? 'Hide player' : 'Play'}
            >
                {isOpen ? (
                    <>
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                            <rect x="6" y="4" width="4" height="16" rx="1" />
                            <rect x="14" y="4" width="4" height="16" rx="1" />
                        </svg>
                        Close
                    </>
                ) : (
                    <>
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                        {isSpotify ? 'Spotify' : 'Play'}
                    </>
                )}
            </button>

            {isOpen && (
                <div
                    className="mt-2 rounded-xl overflow-hidden shadow-sm border border-slate-100 animate-in slide-in-from-top-2 duration-200"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <iframe
                        src={embedUrl}
                        width="100%"
                        height={isSpotify ? 80 : 150}
                        frameBorder="0"
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        loading="lazy"
                        style={{ borderRadius: '12px' }}
                        className="bg-slate-50"
                    />
                </div>
            )}
        </div>
    );
}

/* ── Playlist Export ──────────────────────────────────────────
   Creates an Apple Music / Spotify link with all songs from a list.
   ──────────────────────────────────────────────────────────── */

interface PlaylistExportProps {
    items: any[]; // list_items from the list
    listTitle: string;
    className?: string;
}

export function PlaylistExport({ items, listTitle, className = '' }: PlaylistExportProps) {
    const musicItems = items.filter((item: any) =>
        item.metadata?.category === 'music' && item.metadata?.externalUrl
    );

    if (musicItems.length === 0) return null;

    const handleExport = (e: React.MouseEvent) => {
        e.stopPropagation();

        // 1. Try to build a Spotify Trackset (Legacy but effective)
        // Format: spotify:trackset:<SessionName>:<comma-separated-ids>
        const spotifyItems = musicItems.filter(i => i.metadata?.provider === 'spotify');
        if (spotifyItems.length > 0) {
            const ids = spotifyItems
                .map(i => i.metadata?.rawMetadata?.id)
                .filter(Boolean)
                .join(',');

            if (ids) {
                // Use the trackset schema
                // Note: This often works best on Desktop. On mobile it might just open the app.
                // We could also try the web player URL?
                window.open(`spotify:trackset:${encodeURIComponent(listTitle)}:${ids}`, '_self');
                return;
            }
        }

        // 2. Fallback: Open the first track's streaming URL as the entry point
        const firstTrackUrl = musicItems[0]?.metadata?.externalUrl;
        if (firstTrackUrl) {
            window.open(firstTrackUrl, '_blank');
        } else {
            // 3. Last resort: search Apple Music/Generic
            const searchQuery = encodeURIComponent(listTitle);
            window.open(`https://music.apple.com/search?term=${searchQuery}`, '_blank');
        }
    };

    return (
        <button
            onClick={handleExport}
            className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                bg-gradient-to-r from-[#FC3C44] to-[#8B5CF6]
                hover:from-[#ff4f57] hover:to-[#9d6eff]
                text-white text-[9px] font-black uppercase tracking-widest
                transition-all duration-200 shadow-sm hover:shadow-md
                hover:scale-105 active:scale-95
                ${className}
            `}
            title={`Open "${listTitle}" as playlist`}
        >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
            Open as Playlist
        </button>
    );
}
