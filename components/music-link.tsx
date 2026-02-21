'use client';

import { useState } from 'react';
import { ExternalLink, X, Play, Square, Loader2 } from 'lucide-react';

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

    const id = meta.id;
    const type = meta.type || 'track'; // Default to track if unknown

    if (!id) return null;
    return `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`;
}

/**
 * Build an Apple Music embed URL from iTunes metadata.
 */
function getAppleMusicEmbedUrl(item: any): string | null {
    const meta = item?.metadata?.rawMetadata;
    if (!meta) return null;

    const url = meta.trackViewUrl || meta.collectionViewUrl || item?.metadata?.externalUrl;
    if (!url) return null;

    try {
        const parsed = new URL(url);
        if (parsed.hostname.includes('apple.com')) {
            return `https://embed.music.apple.com${parsed.pathname}${parsed.search}`;
        }
    } catch {
        const collectionId = meta.collectionId || meta.trackId;
        if (collectionId) {
            return `https://embed.music.apple.com/us/album/${collectionId}`;
        }
    }

    return null;
}

/**
 * Inline embedded music player. Uses Spotify or Apple Music embeds.
 * Parent container now expands/collapses when opened.
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
                        <Square className="w-2.5 h-2.5 fill-current" />
                        Close
                    </>
                ) : (
                    <>
                        <Play className="w-2.5 h-2.5 fill-current" />
                        {isSpotify ? 'Spotify' : 'Play'}
                    </>
                )}
            </button>

            {isOpen && (
                <div
                    className="mt-3 w-full bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-300"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Preview</span>
                        <div className="flex items-center gap-2">
                            {externalUrl && (
                                <a
                                    href={externalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[9px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-700 flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm transition-all hover:scale-105"
                                >
                                    <ExternalLink className="h-2.5 w-2.5" />
                                    Open
                                </a>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsOpen(false);
                                }}
                                className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-400 hover:text-slate-600"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    </div>
                    <div className="w-full bg-black min-h-[80px]">
                        <iframe
                            src={embedUrl}
                            width="100%"
                            height={provider === 'apple' ? "175" : "80"}
                            frameBorder="0"
                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                            loading="lazy"
                            className="rounded-b-xl"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

interface PlaylistExportProps {
    items: any[];
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
            const firstUrl = musicItems.find(i => i.metadata?.externalUrl)?.metadata?.externalUrl;
            if (firstUrl) window.open(firstUrl, '_blank');
        }
    };

    const handleUniversalExport = (e: React.MouseEvent) => {
        e.stopPropagation();

        let m3uContent = "#EXTM3U\n";
        musicItems.forEach((item) => {
            const name = item.metadata?.name || "Unknown Track";
            const subtitle = item.metadata?.subtitle || "Unknown Artist";
            const url = item.metadata?.externalUrl || "";

            m3uContent += `#EXTINF:-1,${subtitle} - ${name}\n`;
            m3uContent += `${url}\n`;
        });

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
        <div className={`flex items-center gap-2 ${className}`}>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mr-1">Save playlist:</span>
            {hasSpotify && (
                <button
                    onClick={handleSpotifyExport}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1DB954] hover:bg-[#1ed760] text-white text-[9px] font-black uppercase tracking-widest transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
                    title="Open in Spotify App"
                >
                    Spotify
                </button>
            )}
            <button
                onClick={handleUniversalExport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#FC3C44] to-[#8B5CF6] hover:from-[#ff4f57] hover:to-[#9d6eff] text-white text-[9px] font-black uppercase tracking-widest transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
                title="Download .m3u for iTunes/Apple Music"
            >
                iTunes / Universal
            </button>
        </div>
    );
}
