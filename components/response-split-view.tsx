'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Trash2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { FollowButton } from "./follow-button";
import { RankingList } from "./ranking-list";
import { ResponseEditor } from "./response-editor";
import { getThread, deleteList } from "@/app/actions";
import { toast } from 'sonner';

interface ResponseSplitViewProps {
    thread: any[]; // [Root, Response1, Response2...]
    initialDraftId?: string | null; // null = browse mode, string = editing a response
    onClose: () => void;
    currentUserId: string;
    onStartResponse?: (parentListId: string) => void;
}

export function ResponseSplitView({ thread, initialDraftId, onClose, currentUserId, onStartResponse }: ResponseSplitViewProps) {
    const [currentIndex, setCurrentIndex] = useState(() => {
        // If viewing thread (not editing) and there are responses, start at first response
        if (!initialDraftId && thread.length > 1) {
            return 1;
        }
        return 0;
    });

    const currentThreadItem = thread[currentIndex];

    // Navigation handlers
    const nextItem = () => setCurrentIndex(prev => Math.min(prev + 1, thread.length - 1));
    const prevItem = () => setCurrentIndex(prev => Math.max(prev - 1, 0));

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if user is typing in an input
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

    const isEditing = !!initialDraftId;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-8 animate-in fade-in duration-200 overflow-y-auto">

            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors z-50"
            >
                <X className="h-8 w-8" />
            </button>

            <div className={`w-full h-full max-h-[90vh] grid gap-4 md:gap-8 lg:gap-12 relative ${isEditing ? 'max-w-7xl grid-cols-1 lg:grid-cols-2' : 'max-w-3xl grid-cols-1'}`}>

                {/* LEFT CARD: CAROUSEL (Thread) */}
                <div className="relative h-full flex flex-col group/carousel">

                    {/* Nav: Previous */}
                    <div className="absolute top-1/2 -left-4 -translate-y-1/2 z-10 lg:-left-12">
                        <button
                            onClick={prevItem}
                            disabled={currentIndex === 0}
                            className="p-2 bg-white/10 text-white rounded-full hover:bg-white/20 disabled:opacity-0 transition-all shadow-xl backdrop-blur-md"
                        >
                            <ChevronLeft className="h-8 w-8" />
                        </button>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10 flex flex-col h-full transform transition-all hover:scale-[1.005]">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                                    {currentIndex === 0 ? "ORIGINAL LIST" : `RESPONSE #${currentIndex}`}
                                </span>
                                <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter leading-[0.9] text-slate-800 dark:text-slate-100 line-clamp-1">
                                    {currentThreadItem.title}
                                </h2>
                            </div>
                            <div className="text-xs font-mono font-bold text-slate-400 bg-slate-100 dark:bg-white/10 px-2 py-1 rounded">
                                {currentIndex + 1} / {thread.length}
                            </div>
                        </div>

                        {/* List Content */}
                        <div className="flex-1 overflow-y-auto p-2 md:p-4 scrollbar-hide bg-slate-50 dark:bg-black/20">
                            <RankingList
                                listId={currentThreadItem.id}
                                initialItems={currentThreadItem.list_items?.sort((a: any, b: any) => a.rank - b.rank) || []}
                                category={currentThreadItem.category}
                                readOnly={true}
                            />
                        </div>

                        {/* User Footer */}
                        <div className="p-4 bg-white dark:bg-white/5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center font-bold text-slate-500 text-xs">
                                    {currentThreadItem.profiles?.username?.[0]?.toUpperCase()}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ranked By</span>
                                    <div className="font-bold text-sm text-slate-900 dark:text-white leading-none">
                                        {currentThreadItem.profiles?.display_name || `@${currentThreadItem.profiles?.username}` || 'unknown'}
                                    </div>
                                </div>
                                {/* Follow Button (for other users' responses) */}
                                {currentUserId && currentUserId !== currentThreadItem.user_id && (
                                    <FollowButton
                                        targetUserId={currentThreadItem.user_id}
                                        targetDisplayName={currentThreadItem.profiles?.display_name || currentThreadItem.profiles?.username}
                                        initialIsFollowing={false}
                                        size="sm"
                                    />
                                )}
                            </div>
                            {/* Respond button in browse mode */}
                            {!isEditing && currentUserId !== currentThreadItem.user_id && onStartResponse && (
                                <button
                                    onClick={() => onStartResponse(thread[0].id)}
                                    className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black text-xs font-black uppercase tracking-widest rounded-lg transition-colors"
                                >
                                    Respond
                                </button>
                            )}

                            {/* Owner Actions (Edit/Delete) */}
                            {currentUserId === currentThreadItem.user_id && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={async () => {
                                            if (confirm('Are you sure you want to delete your response?')) {
                                                await deleteList(currentThreadItem.id);
                                                toast.success('Response deleted');
                                                onClose();
                                                window.location.reload(); // Refresh to update list
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

                    {/* Nav: Next */}
                    <div className="absolute top-1/2 -right-4 -translate-y-1/2 z-10 lg:-right-12">
                        <button
                            onClick={nextItem}
                            disabled={currentIndex === thread.length - 1}
                            className="p-2 bg-white/10 text-white rounded-full hover:bg-white/20 disabled:opacity-0 transition-all shadow-xl backdrop-blur-md"
                        >
                            <ChevronRight className="h-8 w-8" />
                        </button>
                    </div>
                </div>


                {/* RIGHT CARD: EDITOR — only when actively editing a response */}
                {isEditing && initialDraftId && (
                    <div className="h-full flex flex-col relative w-full">
                        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border-4 border-yellow-400/50 dark:border-yellow-500/30 flex flex-col h-full w-full">
                            {/* Header */}
                            <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-yellow-50/50 dark:bg-yellow-900/10">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">YOUR RESPONSE TO</span>
                                <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter leading-[0.9] text-slate-800 dark:text-slate-100 line-clamp-2">
                                    {thread[0]?.title || currentThreadItem.title}
                                </h2>
                            </div>
                            <ResponseEditor
                                listId={initialDraftId}
                                userId={currentUserId}
                                initialItems={thread.find(l => l.id === initialDraftId)?.list_items || []}
                                category={currentThreadItem.category}
                                contextTitle={thread[0]?.title || currentThreadItem.title}
                                onClose={onClose}
                            />
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
