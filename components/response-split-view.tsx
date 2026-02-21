'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, MessageCircle, Share2, Copy, Mail, Twitter, Facebook, Cloud, Trash2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { RankingList } from "./ranking-list";
import { CommentModal } from "./comment-modal";
import { getThread, deleteList } from "@/app/actions";
import { toast } from 'sonner';
import { calculateSimilarity } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface ResponseSplitViewProps {
    thread: any[]; // [Root, Response1, Response2...]
    initialDraftId?: string | null;
    onClose: () => void;
    currentUserId: string;
    currentUsername?: string | null;
    currentDisplayName?: string | null;
    onStartResponse?: (parentListId: string) => void;
}

export function ResponseSplitView({ thread, initialDraftId, onClose, currentUserId, currentUsername, currentDisplayName, onStartResponse }: ResponseSplitViewProps) {
    const rootList = thread[0];
    const [currentIndex, setCurrentIndex] = useState(() => {
        if (initialDraftId) {
            const index = thread.findIndex(l => l.id === initialDraftId);
            return index > 0 ? index : 1;
        }
        return thread.length > 1 ? 1 : 0; // Fallback if no responses (though shouldn't happen)
    });

    const [commentModal, setCommentModal] = useState<{ isOpen: boolean; listId: string | null; listTitle: string; userId: string | null; }>({ isOpen: false, listId: null, listTitle: "", userId: null });
    const [showShareOptions, setShowShareOptions] = useState(false);

    // Editing title state
    const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
    const [editTitleValue, setEditTitleValue] = useState("");

    const currentResponse = thread[currentIndex] || rootList;

    const matchPercentage = currentIndex > 0 && rootList
        ? calculateSimilarity(rootList.list_items, currentResponse.list_items)
        : null;

    const nextItem = () => setCurrentIndex(prev => Math.min(prev + 1, thread.length - 1));
    const prevItem = () => setCurrentIndex(prev => Math.max(prev - 1, 1)); // Don't go to 0 (root) because root is always on left

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || (document.activeElement as HTMLElement)?.isContentEditable) return;
            if (e.key === 'ArrowLeft') prevItem();
            if (e.key === 'ArrowRight') nextItem();
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [thread.length]);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    if (!rootList) return null;

    const renderListCard = (list: any, isRoot: boolean) => {
        const isOwner = currentUserId === list.user_id;

        return (
            <div className={`flex flex-col relative w-full h-full lg:w-[450px] shrink-0 max-h-[85vh]`}>
                <div className={`bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border-2 ${isRoot ? 'border-slate-200 dark:border-white/10' : 'border-blue-200 dark:border-blue-500/30'} flex flex-col h-full w-full`}>

                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] shrink-0">
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex flex-col flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${isRoot ? 'text-slate-500' : 'text-blue-500'}`}>
                                        {isRoot ? "ORIGINAL LIST" : `RESPONSE #${currentIndex}`}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        BY {list.profiles?.display_name || list.profiles?.username || 'GUEST'}
                                    </span>
                                    {!isRoot && matchPercentage !== null && (
                                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">
                                            {matchPercentage}% Match
                                        </span>
                                    )}
                                </div>

                                {editingTitleId === list.id ? (
                                    <Input
                                        autoFocus
                                        value={editTitleValue}
                                        onChange={(e) => setEditTitleValue(e.target.value.toUpperCase())}
                                        onBlur={() => {
                                            if (editTitleValue.trim() && editTitleValue.trim() !== list.title.toUpperCase()) {
                                                // Trigger update list title (could hook into app/actions here)
                                                // Skipping optimistic update for simplicity, in a real app would call updateListTitle
                                            }
                                            setEditingTitleId(null);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') setEditingTitleId(null);
                                            if (e.key === 'Escape') setEditingTitleId(null);
                                        }}
                                        className="text-xl font-black uppercase tracking-tighter leading-[0.9] h-8 p-0 border-none focus-visible:ring-0"
                                    />
                                ) : (
                                    <h2
                                        onClick={() => {
                                            if (isOwner) {
                                                setEditTitleValue(list.title.toUpperCase());
                                                setEditingTitleId(list.id);
                                            }
                                        }}
                                        className={`text-xl font-black uppercase tracking-tighter leading-[0.9] text-slate-800 dark:text-slate-100 line-clamp-2 break-words ${isOwner ? 'cursor-text hover:text-slate-500' : ''}`}
                                    >
                                        {list.title}
                                    </h2>
                                )}
                            </div>

                            {/* Share button (only needed on one, let's put it on Root or if it's the response) */}
                            {!isRoot && (
                                <div className="flex items-center gap-2 shrink-0">
                                    <Button
                                        variant="ghost" size="icon"
                                        className="h-8 w-8 text-slate-400 hover:text-slate-900"
                                        onClick={(e) => { e.stopPropagation(); setShowShareOptions(!showShareOptions); }}
                                    >
                                        <Share2 className="h-4 w-4" />
                                    </Button>
                                    {isOwner && (
                                        <Button
                                            variant="ghost" size="icon"
                                            className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                            onClick={async () => {
                                                if (confirm('Delete this response?')) {
                                                    await deleteList(list.id);
                                                    onClose();
                                                    window.location.reload();
                                                }
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Author Note */}
                    {(() => {
                        const authorNote = list.comments?.find((c: any) => c.user_id === list.user_id);
                        if (!authorNote) return null;
                        return (
                            <div className="px-6 py-3 bg-slate-50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/5">
                                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 italic">"{authorNote.content}"</p>
                            </div>
                        );
                    })()}

                    {/* List Content */}
                    <div className="flex-1 overflow-y-auto p-2 md:p-4 scrollbar-hide bg-slate-50 dark:bg-black/20">
                        <RankingList
                            listId={list.id}
                            initialItems={list.list_items?.sort((a: any, b: any) => a.rank - b.rank) || []}
                            category={list.category}
                            readOnly={!isOwner}
                        />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-hidden">
            <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors z-[60]">
                <X className="h-8 w-8" />
            </button>

            {/* Navigation top bar if thread > 2 */}
            {thread.length > 2 && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-xl">
                    <button onClick={prevItem} disabled={currentIndex === 1} className="text-white/70 hover:text-white disabled:opacity-20 transition-all">
                        <ChevronLeft className="h-6 w-6" />
                    </button>
                    <span className="text-xs font-black uppercase tracking-widest text-white/90">Response {currentIndex} of {thread.length - 1}</span>
                    <button onClick={nextItem} disabled={currentIndex === thread.length - 1} className="text-white/70 hover:text-white disabled:opacity-20 transition-all">
                        <ChevronRight className="h-6 w-6" />
                    </button>
                </div>
            )}

            <div className="w-full h-full max-h-[90vh] flex flex-col lg:flex-row items-stretch justify-center gap-4 lg:gap-8 relative max-w-[90vw] mt-12 lg:mt-0">
                {/* ROOT LIST (Always visible on left in desktop) */}
                <div className="hidden lg:flex flex-1 relative w-full h-full">
                    {renderListCard(rootList, true)}
                </div>

                {/* CURRENT RESPONSE (Right side) */}
                <div className="flex flex-1 relative w-full h-full">
                    {thread.length > 1 ? renderListCard(currentResponse, false) : renderListCard(rootList, true)}
                </div>
            </div>
        </div>
    );
}
