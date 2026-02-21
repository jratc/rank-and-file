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
    // https://music.apple.com/us/album/kind-of-blue/268443092?i=268443093
    const url = meta.trackViewUrl || meta.collectionViewUrl || item?.metadata?.externalUrl;
    if (!url) return null;

    // Convert music.apple.com URL to embed.music.apple.com
    try {
        const parsed = new URL(url);
        if (parsed.hostname.includes('apple.com')) {
            // Preserve the search query (e.g., ?i=trackId) so the embed plays the specific song
            return `https://embed.music.apple.com${parsed.pathname}${parsed.search}`;
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
 * for playback. Now includes direct links for full playback.
 */
export function MusicPlayer({ item, className = '' }: MusicPlayerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const provider = item?.metadata?.provider;
    const externalUrl = item?.metadata?.externalUrl;

    const embedUrl = provider === 'spotify'
        ? getSpotifyEmbedUrl(item)
        : getAppleMusicEmbedUrl(item);

    if (!embedUrl) return null;

    const isSpotify = provider === 'spotify';

    return (
        <div className={className + " flex items-center gap-2"}>
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

            {/* DIRECT EXTERNAL LINK FOR FULL PLAYBACK */}
            {externalUrl && (
                <a
                    href={externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-tighter text-slate-400 hover:text-blue-500 transition-colors"
                >
                    <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    Open
                </a>
            )}

            {isOpen && (
                <div
                    className="absolute left-0 right-0 top-full mt-2 z-50 rounded-xl overflow-hidden shadow-xl border border-slate-100 animate-in slide-in-from-top-2 duration-200"
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
        item.metadata?.category === 'music'
    );

    if (musicItems.length === 0) return null;

    const handleSpotifyExport = (e: React.MouseEvent) => {
        e.stopPropagation();
        const spotifyItems = musicItems.filter(i => i.metadata?.provider === 'spotify');
        const ids = spotifyItems
            .map(i => i.metadata?.rawMetadata?.id)
            .filter(Boolean)
            .join(',');

        if (ids) {
            window.open(`spotify:trackset:${encodeURIComponent(listTitle)}:${ids}`, '_self');
        } else {
            // Fallback to first external URL if no explicit IDs found
            const firstUrl = musicItems.find(i => i.metadata?.externalUrl)?.metadata?.externalUrl;
            if (firstUrl) window.open(firstUrl, '_blank');
        }
    };

    const handleUniversalExport = (e: React.MouseEvent) => {
        e.stopPropagation();

        // Generate M3U content
        let m3uContent = "#EXTM3U\n";
        musicItems.forEach((item) => {
            const name = item.metadata?.name || "Unknown Track";
            const subtitle = item.metadata?.subtitle || "Unknown Artist";
            const url = item.metadata?.externalUrl || "";

            m3uContent += `#EXTINF:-1,${subtitle} - ${name}\n`;
            m3uContent += `${url}\n`;
        });

        // Trigger download
        const blob = new Blob([m3uContent], { type: 'audio/x-mpegurl' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${listTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_playlist.m3u`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const hasSpotify = musicItems.some(i => i.metadata?.provider === 'spotify');

    return (
        <div className={`flex flex-wrap gap-2 ${className}`}>
            {hasSpotify && (
                <button
                    onClick={handleSpotifyExport}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1DB954] hover:bg-[#1ed760] text-white text-[9px] font-black uppercase tracking-widest transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
                    title="Open in Spotify App"
                >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.306c-.216.354-.675.467-1.03.249-2.887-1.762-6.523-2.162-10.792-1.183-.404.092-.814-.16-.906-.565-.092-.402.16-.812.565-.904 4.673-1.07 8.688-.617 11.912 1.353.355.216.464.676.251 1.05zm1.47-3.253c-.273.443-.852.585-1.294.312-3.303-2.03-8.336-2.617-12.24-1.431-.5-.152-.843-.695-.69-1.196.153-.502.697-.842 1.197-.69 4.466 1.353 10.01 2.01 13.715 4.288.442.272.583.85.312 1.293v.024zm.146-3.41c-3.963-2.354-10.513-2.57-14.307-1.417-.608.185-1.248-.167-1.433-.774-.185-.607.168-1.248.775-1.432 4.356-1.323 11.58-1.066 16.143 1.643.548.325.728 1.033.403 1.58-.323.547-1.03.73-1.58.404l-.001-.024z" />
                    </svg>
                    Spotify App
                </button>
            )}
            <button
                onClick={handleUniversalExport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#FC3C44] to-[#8B5CF6] hover:from-[#ff4f57] hover:to-[#9d6eff] text-white text-[9px] font-black uppercase tracking-widest transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
                title="Download .m3u for iTunes/Apple Music"
            >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
                iTunes / Universal
            </button>
        </div>
    );
}
