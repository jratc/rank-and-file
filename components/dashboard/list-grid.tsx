import React, { useState } from 'react';
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, X, Plus, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getThread } from "@/app/actions";
import { categoryConfig, CategoryKey, EditSession, ResponseView } from './shared';

interface ListGridProps {
    categories: CategoryKey[];
    groupedLists: Record<string, any[]>;
    currentUserId: string | null;
    expandedListId: string | null;
    setExpandedListId: (id: string | null) => void;
    setShowMap: (show: boolean) => void;
    setResponseView: (view: ResponseView) => void;
    respondedListIds: string[];
    isDeleting: boolean;
    handleDelete: (id: string, confirm: boolean) => void;
    editSession: EditSession;
    setEditSession: React.Dispatch<React.SetStateAction<EditSession>>;
    handleUpdateTitle: (id: string) => Promise<void>;
    handleCreateList: (catKey: string) => void;
    showNameModal: boolean;
}

export function ListGrid({
    categories,
    groupedLists,
    currentUserId,
    expandedListId,
    setExpandedListId,
    setShowMap,
    setResponseView,
    respondedListIds,
    isDeleting,
    handleDelete,
    editSession,
    setEditSession,
    handleUpdateTitle,
    handleCreateList,
    showNameModal
}: ListGridProps) {
    const [expandedCommentsId, setExpandedCommentsId] = useState<string | null>(null);

    return (
        <div className={`
            flex flex-row overflow-x-auto snap-x snap-mandatory gap-4 pb-8 px-4 -mx-4
            md:grid md:grid-cols-2 md:gap-6 md:overflow-visible md:pb-0 md:mx-0 md:px-0 md:flex-none md:snap-none
            lg:grid-cols-3 xl:grid-cols-5 
            transition-all duration-500 
            scrollbar-hide
            ${(expandedListId || showNameModal) ? 'blur-sm scale-95 pointer-events-none' : ''}
        `}>
            {categories.map((catKey) => {
                const config = categoryConfig[catKey];
                const lists = groupedLists[catKey] || [];

                return (
                    <div key={catKey} className="
                        w-[85vw] shrink-0 snap-center
                        md:min-w-0 md:w-auto md:shrink md:snap-align-none
                        flex flex-col gap-4 group/cat
                    ">
                        <div
                            onClick={() => handleCreateList(catKey)}
                            className="flex items-end gap-3 pb-2 border-b-4 border-slate-100 hover:border-black dark:border-white/10 dark:hover:border-white transition-colors cursor-pointer group h-20"
                        >
                            <h2 className={`font-black tracking-tighter uppercase transition-all duration-300 opacity-20 group-hover:opacity-100 grayscale group-hover:grayscale-0 text-4xl whitespace-pre-line leading-[0.85] ${config.color}`}>
                                {config.label.replace(' & ', ' &\n')}
                            </h2>
                            {
                                /* No card count displayed */
                            }
                            {/* FEATURE: Places Map — Global map button for places categories */}
                            {['places', 'bars', 'restaurants', 'other'].includes(catKey) && lists.length > 0 && (
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        // Find first list in category and expand it with map
                                        const firstList = lists[0];
                                        setExpandedListId(firstList.id);
                                        setShowMap(true);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"
                                    title={`View all ${config.label.toLowerCase()} on map`}
                                >
                                    <MapPin className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        <div className="flex flex-col gap-3">
                            {lists.length > 0 ? (
                                lists.map((list: any) => (
                                    <Card
                                        key={list.id}
                                        onClick={async () => {
                                            if (currentUserId === list.user_id) {
                                                // Owner — always open editable expanded view
                                                console.log('OPENING LIST (owner):', list.id);
                                                setExpandedListId(list.id);
                                            } else if (list.response_count > 0 && window.innerWidth >= 1024) {
                                                // Non-owner with responses on desktop — open thread split view
                                                try {
                                                    const thread = await getThread(list.id);
                                                    if (thread) {
                                                        setResponseView({
                                                            isOpen: true,
                                                            threadData: thread,
                                                            draftId: null
                                                        });
                                                    }
                                                } catch (err) {
                                                    console.error('Failed to load thread:', err);
                                                    toast.error('Failed to load responses');
                                                }
                                            } else {
                                                // Non-owner, no responses — open expanded view
                                                console.log('OPENING LIST:', list.id);
                                                setExpandedListId(list.id);
                                            }
                                        }}
                                        className={`group relative cursor-pointer hover:border-black transition-all duration-200 border-2 shadow-sm overflow-hidden flex flex-col justify-between min-h-[100px] ${respondedListIds.includes(list.id) || currentUserId === list.user_id
                                            ? "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10"
                                            : "bg-white dark:bg-gray-950 border-slate-100 dark:border-white/5"
                                            }`}
                                    >
                                        {/* Quick Delete Button - Only show for owner */}
                                        {currentUserId === list.user_id && (
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    disabled={isDeleting}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(list.id, true);
                                                    }}
                                                    className="h-6 w-6 rounded-full hover:bg-red-50 hover:text-red-500 text-slate-300 transition-colors"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        )}
                                        {editSession.id === list.id && !editSession.isExpanded && editSession.title !== null ? (
                                            <CardHeader className="px-4 pt-2 pb-0">
                                                <Input
                                                    autoFocus
                                                    value={editSession.title}
                                                    onFocus={(e) => e.target.select()}
                                                    onChange={(e) => setEditSession(s => ({ ...s, title: e.target.value.toUpperCase() }))}
                                                    onBlur={() => handleUpdateTitle(list.id)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleUpdateTitle(list.id);
                                                        if (e.key === 'Escape') setEditSession({ id: null, title: null, isExpanded: false });
                                                    }}
                                                    className="text-base font-black tracking-tight leading-tight uppercase h-auto p-0 border-none bg-transparent focus-visible:ring-0"
                                                />
                                            </CardHeader>
                                        ) : (
                                            <CardHeader className="px-4 pt-2 pb-0">
                                                <CardTitle
                                                    className="text-base font-black tracking-tight leading-tight group-hover:underline underline-offset-4 decoration-2 cursor-pointer"
                                                >
                                                    {list.title.toUpperCase()}
                                                </CardTitle>
                                            </CardHeader>
                                        )}
                                        <CardContent className="px-4 pb-1 pt-4 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-auto text-right">
                                            <div className="flex flex-col gap-0.5 items-end">
                                                <Link
                                                    href={`/@${list.profiles?.username}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="hover:text-black transition-colors"
                                                >
                                                    {list.profiles?.display_name || list.profiles?.username || 'unknown'}
                                                </Link>
                                                <div className="flex items-center gap-2">
                                                    {(list.comments?.length || 0) > 0 && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setExpandedCommentsId((prev: string | null) => prev === list.id ? null : list.id);
                                                            }}
                                                            className="flex items-center gap-1 text-slate-400 hover:text-black transition-colors p-1 -m-1"
                                                            title="Toggle Comments"
                                                        >
                                                            <MessageCircle className="h-3 w-3" />
                                                            <span>{list.comments.length}</span>
                                                        </button>
                                                    )}
                                                    {['places', 'bars', 'restaurants', 'food', 'other', 'more'].includes(catKey.toLowerCase()) && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setExpandedListId(list.id);
                                                                setShowMap(true);
                                                            }}
                                                            className="text-slate-300 hover:text-red-500 transition-colors p-1 -m-1"
                                                            title="View on Map"
                                                        >
                                                            <MapPin className="h-3 w-3" />
                                                        </button>
                                                    )}
                                                    <span>{list.list_items?.length || 0} ITEMS</span>
                                                </div>
                                                {list.response_count > 0 && (
                                                    <span className="text-blue-500 dark:text-blue-400">
                                                        {list.response_count} {list.response_count === 1 ? 'RESPONSE' : 'RESPONSES'}
                                                    </span>
                                                )}
                                            </div>
                                        </CardContent>

                                        {/* INLINE COMMENT THREAD */}
                                        {expandedCommentsId === list.id && list.comments?.length > 0 && (
                                            <div
                                                className="bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 p-3 flex flex-col gap-2 cursor-auto"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {list.comments.map((comment: any) => (
                                                    <div key={comment.id} className="flex flex-col gap-0.5">
                                                        <span className={`text-[9px] font-bold uppercase tracking-widest ${comment.user_id === list.user_id ? 'text-blue-500' : 'text-slate-400'}`}>
                                                            {comment.profiles?.display_name || comment.profiles?.username || 'Unknown'}
                                                            {comment.user_id === list.user_id && ' (Author)'}
                                                        </span>
                                                        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium break-words">
                                                            "{comment.content}"
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </Card>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] text-center p-8 transition-colors hover:bg-slate-100 dark:hover:bg-white/[0.05] group/empty">
                                    <div className="w-12 h-12 bg-white dark:bg-white/5 rounded-full flex items-center justify-center mb-3 shadow-sm group-hover/empty:scale-110 transition-transform">
                                        <Plus className="h-5 w-5 text-slate-300 group-hover/empty:text-black dark:group-hover/empty:text-white transition-colors" />
                                    </div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">No {config.label.toLowerCase()} lists</p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleCreateList(catKey)}
                                        className="h-7 text-[10px] font-black uppercase tracking-widest bg-white dark:bg-transparent hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
                                    >
                                        Create First List
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
