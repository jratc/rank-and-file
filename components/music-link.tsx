'use client';

import { useState, useRef, useEffect } from 'react';
import { ExternalLink, X, Play, Square, Loader2, Disc } from 'lucide-react';

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
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const provider = item?.metadata?.provider;
    const externalUrl = item?.metadata?.externalUrl;

    const previewUrl = provider === 'spotify'
        ? item?.metadata?.rawMetadata?.preview_url
        : item?.metadata?.rawMetadata?.previewUrl;

    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
            }
        };
    }, []);

    if (!previewUrl) return null;

    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        if (isPlaying) {
            audioRef.current?.pause();
            setIsPlaying(false);
        } else {
            // Stop any other audio elements if we want, but for now just this one
            if (audioRef.current) {
                audioRef.current.play().catch(err => console.error("Playback failed", err));
                setIsPlaying(true);
            }
        }
    };

    return (
        <div className={className}>
            <audio
                ref={audioRef}
                src={previewUrl}
                onEnded={() => setIsPlaying(false)}
                onPause={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
            />
            <button
                onClick={togglePlay}
                className={`
                    inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                    text-[9px] font-black uppercase tracking-widest
                    transition-all duration-200 shrink-0
                    ${isPlaying
                        ? 'bg-blue-500 text-white shadow-md animate-pulse'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                    }
                `}
                title={isPlaying ? 'Stop' : 'Play Preview'}
            >
                {isPlaying ? (
                    <>
                        <Square className="w-2.5 h-2.5 fill-current" />
                        STOP
                    </>
                ) : (
                    <>
                        <Play className="w-2.5 h-2.5 fill-current" />
                        PLAY
                    </>
                )}
            </button>
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

        // Apple Music Desktop natively imports Tab-Separated Values (.txt)
        // Format: Name  Artist  Album
        // It uses this raw data to match with its massive cloud catalog natively
        let txtContent = "Name\tArtist\tAlbum\n";

        musicItems.forEach((item) => {
            const name = item.metadata?.name || "Unknown Track";
            // Use subtitle (which is artist usually)
            const artist = item.metadata?.subtitle || "Unknown Artist";

            // Extract album if available from rawMetadata, else leave blank
            let album = "";
            if (item.metadata?.provider === 'itunes') {
                album = item.metadata?.rawMetadata?.collectionName || "";
            } else if (item.metadata?.provider === 'spotify') {
                album = item.metadata?.rawMetadata?.album?.name || "";
            }

            // Write Tab-separated row
            txtContent += `${name}\t${artist}\t${album}\n`;
        });

        const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${listTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_playlist.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const hasSpotify = musicItems.some(i => i.metadata?.provider === 'spotify');

    return (
        <div className={`flex items-center gap-1.5 ${className}`}>
            {hasSpotify && (
                <button
                    onClick={handleSpotifyExport}
                    className="inline-flex items-center justify-center h-7 px-3 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-white text-[9px] font-black uppercase tracking-widest transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
                    title="Open in Spotify App"
                >
                    Spotify
                </button>
            )}
            <button
                onClick={handleUniversalExport}
                className="inline-flex items-center justify-center h-7 px-3 rounded-full bg-gradient-to-r from-[#FC3C44] to-[#8B5CF6] hover:from-[#ff4f57] hover:to-[#9d6eff] text-white text-[9px] font-black uppercase tracking-widest transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
                title="Download .txt for Apple Music Import"
            >
                Apple Music
            </button>
        </div>
    );
}
