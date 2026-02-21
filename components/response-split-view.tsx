'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Trash2, MessageSquare, Share2, Copy, Mail, Twitter, MessageCircle, Facebook, Cloud } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { FollowButton } from "./follow-button";
import { RankingList } from "./ranking-list";
import { ResponseEditor } from "./response-editor";
import { CommentModal } from "./comment-modal";
import { getThread, deleteList } from "@/app/actions";
import { toast } from 'sonner';
import { calculateSimilarity } from "@/lib/utils";

interface ResponseSplitViewProps {
    thread: any[]; // [Root, Response1, Response2...]
    initialDraftId?: string | null; // null = browse mode, string = editing a response
    onClose: () => void;
    currentUserId: string;
    currentUsername?: string | null;
    currentDisplayName?: string | null;
    onStartResponse?: (parentListId: string) => void;
}

export function ResponseSplitView({ thread, initialDraftId, onClose, currentUserId, currentUsername, currentDisplayName, onStartResponse }: ResponseSplitViewProps) {
    const [editListId, setEditListId] = useState<string | null>(initialDraftId || null);
    const [currentIndex, setCurrentIndex] = useState(() => {
        // If editing, start at the root (0) to compare, or find the response index?
        if (initialDraftId) return 0;
        if (thread.length > 1) return 1;
        return 0;
    });

    const [commentModal, setCommentModal] = useState<{
        isOpen: boolean;
        listId: string | null;
        listTitle: string;
        userId: string | null;
    }>({ isOpen: false, listId: null, listTitle: "", userId: null });

    const [showShareOptions, setShowShareOptions] = useState(false);

    const handleCopyLink = (listId: string) => {
        const url = `${window.location.origin}?listId=${listId}`;
        navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard");
    };

    const handleShareTwitter = (list: any) => {
        const text = `Check out "${list.title}" on Rank and File!`;
        const url = `${window.location.origin}?listId=${list.id}`;
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
    };

    const currentThreadItem = thread[currentIndex];

    // Similarity Calculation
    const matchPercentage = currentIndex > 0 && thread[0]
        ? calculateSimilarity(thread[0].list_items, currentThreadItem.list_items)
        : null;

    // Navigation handlers
    const nextItem = () => setCurrentIndex(prev => Math.min(prev + 1, thread.length - 1));
    const prevItem = () => setCurrentIndex(prev => Math.max(prev - 1, 0));

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement?.tagName === 'INPUT' ||
                document.activeElement?.tagName === 'TEXTAREA' ||
                (document.activeElement as HTMLElement)?.isContentEditable) {
                return;
            }
            if (e.key === 'ArrowLeft') prevItem();
            if (e.key === 'ArrowRight') nextItem();
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [thread.length]);

    // Lock body scroll
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    if (!currentThreadItem) return null;

    const isEditing = !!editListId;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-8 animate-in fade-in duration-200 overflow-y-auto">

            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors z-50"
            >
                <X className="h-8 w-8" />
            </button>

            <div className={`w-full h-full max-h-[85vh] flex flex-col lg:flex-row items-stretch justify-center gap-4 md:gap-8 lg:gap-8 relative max-w-7xl`}>

                {/* LEFT CARD: CAROUSEL (Thread) */}
                <div className={`relative flex flex-col group/carousel w-full h-full ${isEditing ? 'lg:flex-1 lg:max-w-none' : ''}`}>

                    {/* Nav: Previous */}
                    <div className="absolute top-1/2 -left-4 -translate-y-1/2 z-10 lg:-left-12">
                        <button
                            onClick={prevItem}
                            disabled={currentIndex === 0}
                            className={`p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all shadow-xl backdrop-blur-md ${thread.length <= 2 ? 'invisible' : 'disabled:opacity-0'}`}
                        >
                            <ChevronLeft className="h-8 w-8" />
                        </button>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border-2 border-slate-200 dark:border-white/10 flex flex-col h-full w-full">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] flex justify-between items-start gap-4 shrink-0">
                            <div className="flex flex-col flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">
                                        {currentIndex === 0 ? "ORIGINAL LIST" : `RESPONSE #${currentIndex}`}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        BY {currentThreadItem.profiles?.display_name || currentThreadItem.profiles?.username || 'GUEST'}
                                    </span>
                                    {matchPercentage !== null && (
                                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">
                                            {matchPercentage}% Match
                                        </span>
                                    )}
                                </div>
                                <h2 className="text-xl font-black uppercase tracking-tighter leading-[0.9] text-slate-800 dark:text-slate-100 line-clamp-2 break-words">
                                    {currentThreadItem.title}
                                </h2>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <div className="relative">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-slate-400 hover:text-slate-900"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowShareOptions(!showShareOptions);
                                        }}
                                    >
                                        <Share2 className="h-4 w-4" />
                                    </Button>

                                    {showShareOptions && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-40"
                                                onClick={() => setShowShareOptions(false)}
                                            />
                                            <div className="absolute top-full right-0 mt-2 w-40 bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-1 animate-in fade-in zoom-in-95 duration-100">
                                                <button
                                                    onClick={() => { handleCopyLink(currentThreadItem.id); setShowShareOptions(false); }}
                                                    className="w-full flex items-center gap-2 p-2 rounded hover:bg-slate-50 text-[10px] font-bold text-slate-700 transition-colors"
                                                >
                                                    <Copy className="h-3 w-3" />
                                                    COPY LINK
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const authorName = currentThreadItem.profiles?.display_name || currentThreadItem.profiles?.username || 'Someone';
                                                        const text = `${authorName} shared a list on Rank and File: "${currentThreadItem.title}"`;
                                                        const url = `${window.location.origin}?listId=${currentThreadItem.id}`;
                                                        window.open(`mailto:?subject=${encodeURIComponent(currentThreadItem.title)}&body=${encodeURIComponent(text + '\n' + url)}`);
                                                        setShowShareOptions(false);
                                                    }}
                                                    className="w-full flex items-center gap-2 p-2 rounded hover:bg-slate-50 text-[10px] font-bold text-slate-700 transition-colors"
                                                >
                                                    <Mail className="h-3 w-3" />
                                                    EMAIL
                                                </button>
                                                <button
                                                    onClick={() => { handleShareTwitter(currentThreadItem); setShowShareOptions(false); }}
                                                    className="w-full flex items-center gap-2 p-2 rounded hover:bg-slate-50 text-[10px] font-bold text-slate-700 transition-colors"
                                                >
                                                    <Twitter className="h-3 w-3" />
                                                    TWEET
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const url = encodeURIComponent(`${window.location.origin}?listId=${currentThreadItem.id}`);
                                                        window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
                                                        setShowShareOptions(false);
                                                    }}
                                                    className="w-full flex items-center gap-2 p-2 rounded hover:bg-slate-50 text-[10px] font-bold text-slate-700 transition-colors"
                                                >
                                                    <Facebook className="h-3 w-3" />
                                                    FACEBOOK
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const authorName = currentThreadItem.profiles?.display_name || currentThreadItem.profiles?.username || 'Someone';
                                                        const text = encodeURIComponent(`${authorName} shared a list on Rank and File: "${currentThreadItem.title}"`);
                                                        const url = encodeURIComponent(`${window.location.origin}?listId=${currentThreadItem.id}`);
                                                        window.open(`https://bsky.app/intent/compose?text=${text}%20${url}`, '_blank');
                                                        setShowShareOptions(false);
                                                    }}
                                                    className="w-full flex items-center gap-2 p-2 rounded hover:bg-slate-50 text-[10px] font-bold text-slate-700 transition-colors"
                                                >
                                                    <Cloud className="h-3 w-3" />
                                                    BLUESKY
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="text-xs font-mono font-bold text-slate-400 bg-slate-100 dark:bg-white/10 px-2 py-1 rounded">
                                    {currentIndex + 1} / {thread.length}
                                </div>
                            </div>
                        </div>

                        {/* List Note (Comment from Author) - TOP POSITION */}
                        {(() => {
                            const authorNote = currentThreadItem.comments?.find((c: any) => c.user_id === currentThreadItem.user_id);
                            if (!authorNote) return null;
                            return (
                                <div className="px-6 py-3 bg-slate-50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/5">
                                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400 italic">
                                        "{authorNote.content}"
                                    </p>
                                </div>
                            );
                        })()}

                        {/* List Content */}
                        <div className="flex-1 overflow-y-auto p-2 md:p-4 scrollbar-hide bg-slate-50 dark:bg-black/20">
                            <RankingList
                                listId={currentThreadItem.id}
                                initialItems={currentThreadItem.list_items?.sort((a: any, b: any) => a.rank - b.rank) || []}
                                category={currentThreadItem.category}
                                readOnly={true}
                            />
                        </div>

                        {/* Actions Footer */}
                        <div className="p-3 bg-white dark:bg-white/5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center font-bold text-slate-500 text-[10px]">
                                    {currentThreadItem.profiles?.username?.[0]?.toUpperCase()}
                                </div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                    {currentThreadItem.category}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Respond button in browse mode */}
                                {!isEditing &&
                                    currentUserId !== currentThreadItem.user_id &&
                                    onStartResponse &&
                                    !thread.some(item => item.user_id === currentUserId) && (
                                        <button
                                            onClick={() => onStartResponse(thread[0].id)}
                                            className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black text-xs font-black uppercase tracking-widest rounded-lg transition-colors"
                                        >
                                            Respond
                                        </button>
                                    )}

                                {/* Thoughts Button */}
                                {currentIndex === 0 && (!isEditing || currentUserId !== currentThreadItem.user_id) && (
                                    <button
                                        onClick={() => setCommentModal({
                                            isOpen: true,
                                            listId: currentThreadItem.id,
                                            listTitle: currentThreadItem.title,
                                            userId: currentUserId
                                        })}
                                        className="px-3 py-2 text-slate-400 hover:text-black hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-2"
                                        title="Add your thoughts"
                                    >
                                        <MessageCircle className="h-4 w-4" />
                                        <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">Thoughts?</span>
                                    </button>
                                )}

                                {/* Owner Actions */}
                                {currentUserId === currentThreadItem.user_id && (
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setEditListId(currentThreadItem.id)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white dark:bg-white dark:text-black text-[10px] font-black uppercase tracking-widest rounded-lg hover:opacity-80 transition-opacity"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (confirm('Are you sure you want to delete your response?')) {
                                                    await deleteList(currentThreadItem.id);
                                                    toast.success('Response deleted');
                                                    onClose();
                                                    window.location.reload();
                                                }
                                            }}
                                            className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                                            title="Delete Response"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Nav: Next */}
                <div className="absolute top-1/2 -right-4 -translate-y-1/2 z-10 lg:-right-12">
                    <button
                        onClick={nextItem}
                        disabled={currentIndex === thread.length - 1}
                        className={`p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all shadow-xl backdrop-blur-md ${thread.length <= 2 ? 'invisible' : 'disabled:opacity-0'}`}
                    >
                        <ChevronRight className="h-8 w-8" />
                    </button>
                </div>

                {/* RIGHT CARD: EDITOR */}
                {isEditing && (
                    <div className="flex flex-col relative w-full h-full lg:flex-1">
                        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border-2 border-yellow-400 dark:border-yellow-500/50 flex flex-col h-full w-full">
                            {/* Header */}
                            <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-yellow-50/50 dark:bg-yellow-900/10 shrink-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">YOUR RESPONSE</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                        BY {currentDisplayName || currentUsername || 'GUEST'}
                                    </span>
                                </div>
                                <h2 className="text-xl font-black uppercase tracking-tighter leading-[0.9] text-slate-800 dark:text-slate-100 line-clamp-2">
                                    {thread[0]?.title || currentThreadItem.title}
                                </h2>
                            </div>
                            <ResponseEditor
                                listId={editListId!}
                                userId={currentUserId}
                                initialItems={thread.find(l => l.id === editListId)?.list_items || []}
                                category={currentThreadItem.category}
                                contextTitle={thread[0]?.title || currentThreadItem.title}
                                onClose={() => {
                                    setEditListId(null);
                                    if (initialDraftId) onClose();
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>

            <CommentModal
                isOpen={commentModal.isOpen}
                onClose={() => setCommentModal(prev => ({ ...prev, isOpen: false }))}
                listId={commentModal.listId || ""}
                listTitle={commentModal.listTitle}
                currentUserId={currentUserId}
            />
        </div>
    );
}
