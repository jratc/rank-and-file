import React from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, X, Plus, Sparkles, Pencil, Loader2, Share2, Copy, Mail, MessageCircle, Twitter, Facebook, Cloud, MessageSquare, Search, Reply, Send } from 'lucide-react';
import { toast } from 'sonner';
import { RankingList } from "@/components/ranking-list";
import { categoryConfig, EditSession, ResponseView } from './shared';
import { PlacesMap, itemsToPlaces } from '@/components/places-map';
import { PlaylistExport } from '@/components/music-link';
import { getThread, upsertComment, addComment } from "@/app/actions";
import { ResponseBtn } from '@/components/response-btn';

interface ExpandedListOverlayProps {
    expandedList: any;
    expandedListId: string | null;
    closeExpandedView: () => void;
    creationStep: string | null;
    setCreationStep: (step: any) => void;
    editSession: EditSession;
    setEditSession: React.Dispatch<React.SetStateAction<EditSession>>;
    handleUpdateTitle: (id: string) => Promise<void>;
    pendingListAfterCreate: any;
    startEarlyPopulation: (list: any) => Promise<void>;
    freeFormItems: string[];
    setFreeFormItems: (items: string[]) => void;
    handleCreateFreeForm: () => void;
    isUpdatingTitle: boolean;
    isPopulating: boolean;
    isBackgroundPopulating: boolean;
    populatedCount: number;
    currentUserId: string | null;
    currentUsername: string | null;
    currentDisplayName: string | null;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    handleSearch: (query: string, append?: boolean, pageNum?: number) => void;
    searchInputRef: React.RefObject<HTMLInputElement | null>;
    isSearching: boolean;
    searchResults: any[];
    setSearchResults: (results: any[]) => void;
    searchResultsRef: React.RefObject<HTMLDivElement | null>;
    hasMore: boolean;
    page: number;
    setPage: (page: number) => void;
    showMap: boolean;
    setShowMap: (show: boolean) => void;
    handleAddItem: (item: any) => void;
    waitingComment: string;
    setWaitingComment: (comment: string) => void;
    isWaitingForComment: boolean;
    commentValueRef: React.MutableRefObject<string>;
    isCommentDirty: React.MutableRefObject<boolean>;
    setLists: React.Dispatch<React.SetStateAction<any[]>>;
    showShareOptions: boolean;
    setShowShareOptions: (show: boolean) => void;
    handleCopyLink: (list: any) => void;
    handleShareTwitter: (list: any) => void;
    handleSubmitWaitingComment: () => void;
    allComments: any[];
    refreshComments: () => Promise<void>;
    setResponseView: (view: ResponseView) => void;
    router: any;
}

export function ExpandedListOverlay({
    expandedList,
    expandedListId,
    closeExpandedView,
    creationStep,
    setCreationStep,
    editSession,
    setEditSession,
    handleUpdateTitle,
    pendingListAfterCreate,
    startEarlyPopulation,
    freeFormItems,
    setFreeFormItems,
    handleCreateFreeForm,
    isUpdatingTitle,
    isPopulating,
    isBackgroundPopulating,
    populatedCount,
    currentUserId,
    currentUsername,
    currentDisplayName,
    searchQuery,
    setSearchQuery,
    handleSearch,
    searchInputRef,
    isSearching,
    searchResults,
    setSearchResults,
    searchResultsRef,
    hasMore,
    page,
    setPage,
    showMap,
    setShowMap,
    handleAddItem,
    waitingComment,
    setWaitingComment,
    isWaitingForComment,
    commentValueRef,
    isCommentDirty,
    setLists,
    showShareOptions,
    setShowShareOptions,
    handleCopyLink,
    handleShareTwitter,
    handleSubmitWaitingComment,
    allComments,
    refreshComments,
    setResponseView,
    router,
}: ExpandedListOverlayProps) {
    const [replyContent, setReplyContent] = React.useState("");
    const [isPostingReply, setIsPostingReply] = React.useState(false);

    const handleReplySubmit = async () => {
        if (!replyContent.trim()) return;
        setIsPostingReply(true);
        try {
            await addComment(expandedList.id, replyContent.trim());
            setReplyContent("");
            toast.success("Thought added!");
            await refreshComments();
        } catch (error) {
            toast.error("Failed to post comment");
        } finally {
            setIsPostingReply(false);
        }
    };

    React.useEffect(() => {
        const handleToggleMap = (e: any) => {
            if (e.detail?.show !== undefined) {
                setShowMap(e.detail.show);
            }
        };
        window.addEventListener('toggle-map', handleToggleMap);
        return () => window.removeEventListener('toggle-map', handleToggleMap);
    }, [setShowMap]);

    if (!expandedListId || !expandedList) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-[2px]">
            <div
                className="fixed inset-0"
                onClick={closeExpandedView}
            />
            <Card className="relative w-full max-w-xl flex flex-col h-auto max-h-[90vh] border-slate-200 bg-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom-4 duration-300">
                <button
                    onClick={closeExpandedView}
                    className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 transition-colors z-20"
                >
                    <X className="h-4 w-4" />
                </button>

                {creationStep === 'naming' || creationStep === 'choosing' || creationStep === 'drafting' ? (
                    <div className="flex-1 flex flex-col min-h-0 relative">
                        <CardHeader className="p-5 pb-2 text-center pt-8 shrink-0">
                            <Plus className="h-8 w-8 text-slate-200 mx-auto mb-4" />
                            <CardTitle className="text-xl font-black uppercase tracking-tighter">Name your list</CardTitle>
                            <div className="mt-4 px-6">
                                <Input
                                    autoFocus
                                    value={editSession.title || ''}
                                    onChange={(e) => setEditSession(s => ({ ...s, title: e.target.value.toUpperCase() }))}
                                    placeholder="LIST TITLE"
                                    className="h-12 border-2 border-slate-100 rounded-xl font-black text-center text-lg focus-visible:ring-black uppercase placeholder:text-slate-200"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleUpdateTitle(expandedList.id);
                                    }}
                                />
                            </div>
                            <CardDescription className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-4 px-8 leading-relaxed">
                                Give your list a name to get started.
                            </CardDescription>
                        </CardHeader>

                        {creationStep === 'choosing' && (
                            <CardContent className="p-6 pt-2 grid grid-cols-1 gap-3 shrink-0">
                                <button
                                    onClick={() => {
                                        if (!editSession.title || !editSession.title.trim()) {
                                            toast.error("Please name your list first!");
                                            return;
                                        }
                                        // Save title, then trigger AI
                                        handleUpdateTitle(expandedList.id).then(() => {
                                            if (pendingListAfterCreate) {
                                                setCreationStep('waiting');
                                                startEarlyPopulation(pendingListAfterCreate);
                                            }
                                        });
                                    }}
                                    disabled={!editSession.title?.trim()}
                                    className="group w-full p-4 border-2 border-slate-100 disabled:opacity-50 disabled:cursor-not-allowed hover:border-black rounded-xl transition-all text-left flex items-start gap-4 bg-white"
                                >
                                    <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                                        <Sparkles className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <div className="font-black text-sm uppercase tracking-tight">Find some results</div>
                                        <div className="text-[10px] font-bold text-slate-400 leading-tight mt-0.5 uppercase">We'll magically find items for you.</div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => {
                                        if (!editSession.title || !editSession.title.trim()) {
                                            toast.error("Please name your list first!");
                                            return;
                                        }
                                        // Don't auto-save title yet, just switch to drafting mode
                                        setCreationStep('drafting');
                                    }}
                                    disabled={!editSession.title?.trim()}
                                    className="group w-full p-4 border-2 border-slate-100 disabled:opacity-50 disabled:cursor-not-allowed hover:border-black rounded-xl transition-all text-left flex items-start gap-4 bg-white"
                                >
                                    <div className="p-2 bg-purple-50 rounded-lg group-hover:bg-purple-100 transition-colors">
                                        <Pencil className="h-5 w-5 text-purple-600" />
                                    </div>
                                    <div>
                                        <div className="font-black text-sm uppercase tracking-tight">Type them in</div>
                                        <div className="text-[10px] font-bold text-slate-400 leading-tight mt-0.5 uppercase">Draft your own list from scratch.</div>
                                    </div>
                                </button>
                            </CardContent>
                        )}

                        {creationStep === 'drafting' && (
                            <CardContent className="p-5 pt-2 space-y-2 overflow-y-auto min-h-0 flex-1 custom-scrollbar">
                                {freeFormItems.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-3">
                                        <span className="w-6 text-[10px] font-black text-slate-300">#{idx + 1}</span>
                                        <Input
                                            value={item}
                                            onChange={(e) => {
                                                const newItems = [...freeFormItems];
                                                newItems[idx] = e.target.value;
                                                setFreeFormItems(newItems);
                                            }}
                                            placeholder={`Item #${idx + 1}`}
                                            className="h-10 border-2 border-slate-50 rounded-lg font-bold text-sm focus-visible:ring-black uppercase"
                                            autoFocus={idx === 0}
                                        />
                                    </div>
                                ))}
                                <div className="pt-4 pb-4 space-y-3">
                                    <Button
                                        onClick={handleCreateFreeForm}
                                        disabled={isUpdatingTitle || !freeFormItems.some(i => i.trim())}
                                        className="w-full h-14 bg-black hover:bg-slate-800 text-white font-black uppercase tracking-widest text-sm rounded-xl transition-all shadow-md active:scale-[0.98]"
                                    >
                                        {isUpdatingTitle ? <Loader2 className="h-5 w-5 animate-spin" /> : "CREATE LIST"}
                                    </Button>
                                    <button
                                        onClick={() => setCreationStep('choosing')}
                                        className="w-full text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-slate-500 transition-colors py-2"
                                    >
                                        Go Back
                                    </button>
                                </div>
                            </CardContent>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col min-h-0 relative">
                        {/* WHILE YOU WAIT VIEW - Hidden but keeps RankingList mounted if we want, 
                            actually we want the LIST to be mounted to catch events. */}
                        <div className="flex-1 flex flex-col min-h-0 relative">
                            <CardHeader className="p-5 pb-3 shrink-0">
                                <div className="flex flex-col gap-2">
                                    <div className="flex flex-row items-center justify-between gap-4">
                                        <div className="space-y-0 flex-1 min-w-0">
                                            <div className={`text-[9px] font-black tracking-widest uppercase mb-0.5 ${categoryConfig[expandedList.category as keyof typeof categoryConfig]?.color || categoryConfig.other.color}`}>
                                                {categoryConfig[expandedList.category as keyof typeof categoryConfig]?.label || expandedList.category}
                                            </div>
                                            {editSession.isExpanded && editSession.title !== null ? (
                                                <div className="flex flex-col">
                                                    <Textarea
                                                        autoFocus
                                                        value={editSession.title}
                                                        placeholder="NAME YOUR LIST"
                                                        onChange={(e) => {
                                                            setEditSession(s => ({ ...s, title: e.target.value }));
                                                            e.target.style.height = 'auto';
                                                            e.target.style.height = e.target.scrollHeight + 'px';
                                                        }}
                                                        onBlur={() => handleUpdateTitle(expandedList.id)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleUpdateTitle(expandedList.id);
                                                            }
                                                            if (e.key === 'Escape') {
                                                                setEditSession({ id: null, title: null, isExpanded: false });
                                                            }
                                                        }}
                                                        className={`text-3xl font-black tracking-tighter leading-tight min-h-[1.2em] h-auto p-0 border-none bg-transparent focus-visible:ring-0 uppercase resize-none placeholder:text-slate-300 placeholder:font-black placeholder:uppercase ${expandedList.id === 'temp-pending' && !editSession.title?.trim() ? 'text-slate-300' : 'text-slate-900'}`}
                                                        rows={1}
                                                    />
                                                    {isUpdatingTitle && <span className="text-[8px] font-mono text-slate-400">FETCHING LIST...</span>}
                                                </div>
                                            ) : (
                                                <CardTitle
                                                    onClick={() => {
                                                        if (currentUserId !== expandedList.user_id) return;
                                                        setEditSession({ id: expandedList.id, title: expandedList.title.toUpperCase(), isExpanded: true });
                                                    }}
                                                    className={`text-3xl font-black tracking-tighter text-slate-900 leading-[0.9] py-0.5 rounded break-words line-clamp-2 ${currentUserId === expandedList.user_id ? 'cursor-text hover:text-slate-500 transition-colors' : 'cursor-default'}`}
                                                >
                                                    {expandedList.title.toUpperCase()}
                                                </CardTitle>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1.5 relative shrink-0">
                                            {/* Share / Respond controls */}
                                            {expandedList.id !== 'temp-pending' && !isPopulating && (
                                                <div className="relative">
                                                    <Button
                                                        variant="default"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowShareOptions(!showShareOptions);
                                                        }}
                                                        className="h-8 px-4 text-[10px] font-black tracking-widest uppercase bg-slate-900 hover:bg-black text-white rounded-md flex items-center gap-2 shadow-sm transition-all"
                                                    >
                                                        <Share2 className="h-3 w-3" />
                                                        SHARE
                                                    </Button>

                                                    {showShareOptions && (
                                                        <>
                                                            <div
                                                                className="fixed inset-0 z-30"
                                                                onClick={() => setShowShareOptions(false)}
                                                            />
                                                            <div className="absolute top-full right-0 mt-2 w-40 bg-white border border-slate-200 rounded-lg shadow-xl z-40 p-1 animate-in fade-in zoom-in-95 duration-100">
                                                                <button
                                                                    onClick={() => { handleCopyLink(expandedList); setShowShareOptions(false); }}
                                                                    className="w-full flex items-center gap-2 p-2 rounded hover:bg-slate-50 text-[10px] font-bold text-slate-700 transition-colors"
                                                                >
                                                                    <Copy className="h-3 w-3" />
                                                                    COPY LINK
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        const authorName = expandedList.profiles?.display_name || expandedList.profiles?.username || 'Someone';
                                                                        const text = `${authorName} made a list on Rank and File. Take a look, and respond.`;
                                                                        const url = window.location.href;
                                                                        window.open(`mailto:?subject=${encodeURIComponent(expandedList.title)}&body=${encodeURIComponent(text + '\n' + url)}`);
                                                                        setShowShareOptions(false);
                                                                    }}
                                                                    className="w-full flex items-center gap-2 p-2 rounded hover:bg-slate-50 text-[10px] font-bold text-slate-700 transition-colors"
                                                                >
                                                                    <Mail className="h-3 w-3" />
                                                                    EMAIL
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        const authorName = expandedList.profiles?.display_name || expandedList.profiles?.username || 'Someone';
                                                                        const text = `${authorName} made a list on Rank and File. Take a look, and respond.`;
                                                                        const url = window.location.href;
                                                                        window.open(`sms:?&body=${encodeURIComponent(text + ' ' + url)}`);
                                                                        setShowShareOptions(false);
                                                                    }}
                                                                    className="w-full flex items-center gap-2 p-2 rounded hover:bg-slate-50 text-[10px] font-bold text-slate-700 transition-colors"
                                                                >
                                                                    <MessageCircle className="h-3 w-3" />
                                                                    TEXT
                                                                </button>
                                                                <button
                                                                    onClick={() => { handleShareTwitter(expandedList); setShowShareOptions(false); }}
                                                                    className="w-full flex items-center gap-2 p-2 rounded hover:bg-slate-50 text-[10px] font-bold text-slate-700 transition-colors"
                                                                >
                                                                    <Twitter className="h-3 w-3" />
                                                                    TWEET
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        const url = encodeURIComponent(`${window.location.origin}?listId=${expandedList.id}`);
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
                                                                        const authorName = expandedList.profiles?.display_name || expandedList.profiles?.username || 'Someone';
                                                                        const text = encodeURIComponent(`${authorName} made a list on Rank and File: "${expandedList.title}"`);
                                                                        const url = encodeURIComponent(`${window.location.origin}?listId=${expandedList.id}`);
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
                                            )}

                                            {/* Respond Button (Only for Non-Owners) */}
                                            {currentUserId !== expandedList.user_id && (
                                                <ResponseBtn
                                                    parentListId={expandedList.id}
                                                    parentTitle={expandedList.title}
                                                    onResponseCreated={async (newList: any) => {
                                                        setLists((prev: any[]) => prev.map(list => {
                                                            if (list.id === expandedList.id) {
                                                                return { ...list, response_count: (list.response_count || 0) + 1 };
                                                            }
                                                            return list;
                                                        }));

                                                        try {
                                                            const thread = await getThread(expandedList.id);
                                                            router.refresh();

                                                            if (thread) {
                                                                setResponseView({
                                                                    isOpen: true,
                                                                    threadData: thread,
                                                                    draftId: newList.id
                                                                });
                                                                closeExpandedView();
                                                            } else {
                                                                closeExpandedView();
                                                            }
                                                        } catch (err) {
                                                            console.error('Failed to load thread:', err);
                                                            toast.error('Failed to open response view');
                                                            closeExpandedView();
                                                        }
                                                    }}
                                                />
                                            )}

                                            {/* View Responses Button (Owner with responses) */}
                                            {currentUserId === expandedList.user_id && expandedList.response_count > 0 && (
                                                <Button
                                                    size="sm"
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        try {
                                                            const thread = await getThread(expandedList.id);
                                                            if (thread) {
                                                                closeExpandedView();
                                                                setShowMap(false);
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
                                                    }}
                                                    className="h-7 px-3 text-[9px] font-black tracking-widest uppercase bg-blue-500 hover:bg-blue-600 text-white rounded-md flex items-center gap-1.5"
                                                >
                                                    <MessageSquare className="h-2.5 w-2.5" />
                                                    {expandedList.response_count} {expandedList.response_count === 1 ? 'RESPONSE' : 'RESPONSES'}
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* INTEGRATED COMMENT AREA (Description) */}
                                    {currentUserId === expandedList.user_id ? (
                                        <div className="mt-2 group">
                                            <div className="relative">
                                                <Textarea
                                                    placeholder={isPopulating ? "Building your list... jot down some notes?" : "Jot down some notes-what should people know about your list?"}
                                                    value={waitingComment}
                                                    autoFocus={isWaitingForComment}
                                                    onChange={(e) => {
                                                        setWaitingComment(e.target.value);
                                                        commentValueRef.current = e.target.value;
                                                        isCommentDirty.current = true;
                                                    }}
                                                    onBlur={() => {
                                                        const commentToSave = commentValueRef.current.trim();
                                                        if (isCommentDirty.current && expandedList.id !== 'temp-pending') {
                                                            isCommentDirty.current = false;
                                                            setLists((prev: any[]) => prev.map(l => l.id === expandedList.id ? {
                                                                ...l,
                                                                comments: commentToSave ? [...(l.comments || []).filter((c: any) => c.user_id !== currentUserId), {
                                                                    id: `temp-${Date.now()}`,
                                                                    user_id: currentUserId,
                                                                    list_id: expandedList.id,
                                                                    content: commentToSave,
                                                                    created_at: new Date().toISOString(),
                                                                    profiles: { username: currentUsername, display_name: currentDisplayName }
                                                                }] : [...(l.comments || []).filter((c: any) => c.user_id !== currentUserId)]
                                                            } : l));
                                                            upsertComment(expandedList.id, commentToSave).then(() => refreshComments()).catch(e => console.error("Save error", e));
                                                        }
                                                    }}
                                                    className="min-h-[60px] max-h-[120px] font-bold text-sm resize-none border-none bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus-visible:ring-1 focus-visible:ring-slate-100 rounded-xl p-3 placeholder:opacity-40 transition-all overflow-y-auto"
                                                />
                                                {isCommentDirty.current && (
                                                    <div className="flex justify-end mt-1">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-6 text-[9px] px-2 uppercase tracking-widest font-black text-slate-400 hover:text-green-600 hover:border-green-600 hover:bg-green-50 transition-colors"
                                                            onMouseDown={(e) => e.preventDefault()}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const commentToSave = commentValueRef.current.trim();
                                                                if (expandedList.id !== 'temp-pending') {
                                                                    isCommentDirty.current = false;
                                                                    upsertComment(expandedList.id, commentToSave)
                                                                        .then(() => {
                                                                            toast.success("Comment saved!");
                                                                            refreshComments();
                                                                        })
                                                                        .catch(() => {
                                                                            toast.error("Failed to save");
                                                                            isCommentDirty.current = true;
                                                                        });
                                                                }
                                                            }}
                                                        >
                                                            Save Note
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Thread View for Owners */}
                                            {allComments.filter(c => c.content !== waitingComment || c.user_id !== expandedList.user_id).length > 0 && (
                                                <div className="space-y-3 pt-4 border-t border-slate-100 mt-4">
                                                    <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-300 px-1">Conversation</h4>
                                                    <div className="space-y-3">
                                                        {allComments
                                                            .filter(c => c.content !== waitingComment || c.user_id !== expandedList.user_id)
                                                            .map((comment) => (
                                                                <div key={comment.id} className="flex flex-col gap-1 group/comment pl-2 border-l-2 border-slate-100/50">
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[10px] font-black uppercase text-slate-900">
                                                                                {comment.profiles?.display_name || comment.profiles?.username || 'Guest'}
                                                                            </span>
                                                                            <span className="text-[8px] font-bold text-slate-400">
                                                                                {new Date(comment.created_at).toLocaleDateString()}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <p className="text-xs text-slate-600 leading-tight pr-4">
                                                                        {comment.content}
                                                                    </p>
                                                                </div>
                                                            ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* QUICK REPLY BOX FOR OWNER (Optional but helpful) */}
                                            {allComments.filter(c => c.user_id !== currentUserId).length > 0 && (
                                                <div className="mt-4 bg-white/50 border border-slate-100 rounded-2xl p-2 transition-all focus-within:ring-2 focus-within:ring-blue-100">
                                                    <div className="flex gap-2 min-h-[40px]">
                                                        <Textarea
                                                            placeholder="Respond to thoughts..."
                                                            value={replyContent}
                                                            onChange={(e) => setReplyContent(e.target.value)}
                                                            className="flex-1 min-h-[40px] max-h-[100px] text-xs font-medium border-none bg-transparent focus-visible:ring-0 p-2 resize-none"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                                    e.preventDefault();
                                                                    if (replyContent.trim()) handleReplySubmit();
                                                                }
                                                            }}
                                                        />
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            disabled={!replyContent.trim() || isPostingReply}
                                                            onClick={handleReplySubmit}
                                                            className="h-8 w-8 self-end rounded-xl hover:bg-blue-50 text-blue-500 transition-all shrink-0"
                                                        >
                                                            {isPostingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="mt-2 space-y-4">
                                            {waitingComment ? (
                                                <div className="px-3 py-2 bg-slate-50/50 rounded-xl border border-slate-100/50">
                                                    <p className="text-xs font-medium text-slate-600 italic leading-relaxed">
                                                        &quot;{waitingComment}&quot;
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="px-3 py-2 bg-slate-50/20 rounded-xl border border-dashed border-slate-100/50">
                                                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-tight">No notes from the creator yet.</p>
                                                </div>
                                            )}

                                            {/* Thread View for Viewers */}
                                            {allComments.filter(c => c.content !== waitingComment || c.user_id !== expandedList.user_id).length > 0 && (
                                                <div className="space-y-3 pt-2">
                                                    <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-300 px-1">Conversation</h4>
                                                    <div className="space-y-3">
                                                        {allComments
                                                            .filter(c => c.content !== waitingComment || c.user_id !== expandedList.user_id)
                                                            .map((comment) => (
                                                                <div key={comment.id} className="flex flex-col gap-1 group/comment pl-2 border-l-2 border-slate-100/50">
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[10px] font-black uppercase text-slate-900">
                                                                                {comment.profiles?.display_name || comment.profiles?.username || 'Guest'}
                                                                            </span>
                                                                            <span className="text-[8px] font-bold text-slate-400">
                                                                                {new Date(comment.created_at).toLocaleDateString()}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <p className="text-xs text-slate-600 leading-tight pr-4">
                                                                        {comment.content}
                                                                    </p>
                                                                </div>
                                                            ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* QUICK REPLY BOX */}
                                            {currentUserId && (
                                                <div className="mt-4 bg-white/50 border border-slate-100 rounded-2xl p-2 transition-all focus-within:ring-2 focus-within:ring-blue-100">
                                                    <div className="flex gap-2 min-h-[40px]">
                                                        <Textarea
                                                            placeholder="Add a thought..."
                                                            value={replyContent}
                                                            onChange={(e) => setReplyContent(e.target.value)}
                                                            className="flex-1 min-h-[40px] max-h-[100px] text-xs font-medium border-none bg-transparent focus-visible:ring-0 p-2 resize-none"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                                    e.preventDefault();
                                                                    if (replyContent.trim()) handleReplySubmit();
                                                                }
                                                            }}
                                                        />
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            disabled={!replyContent.trim() || isPostingReply}
                                                            onClick={handleReplySubmit}
                                                            className="h-8 w-8 self-end rounded-xl hover:bg-blue-50 text-blue-500 transition-all shrink-0"
                                                        >
                                                            {isPostingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                            {/* Feature: Music Playlist Export - Moved to Header */}
                                            {expandedList.category === 'music' && expandedList.list_items.length > 0 && (
                                                <div className="mt-3 bg-slate-50/50 rounded-xl p-2 border border-slate-100/50">
                                                    <PlaylistExport items={expandedList.list_items} listTitle={expandedList.title} />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Search Section Inside Header - Only for Owner, only after list is named, and not while populating */}
                                    {
                                        currentUserId === expandedList.user_id && expandedList.id !== 'temp-pending' && !isPopulating && (
                                            <div className="mt-4">
                                                <form onSubmit={(e) => { e.preventDefault(); handleSearch(searchQuery); }} className="relative group">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300 group-focus-within:text-black transition-colors" />
                                                    <Input
                                                        ref={searchInputRef}
                                                        placeholder={`Add to list...`}
                                                        value={searchQuery}
                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                        className="h-8 pl-9 pr-20 bg-slate-50 border-none rounded-lg text-xs font-bold focus:bg-white focus:ring-1 focus:ring-slate-200 transition-all"
                                                    />
                                                    <div className="absolute right-1 top-1 bottom-1">
                                                        <Button
                                                            type="submit"
                                                            size="sm"
                                                            disabled={isSearching || !searchQuery.trim()}
                                                            className="h-full px-3 rounded-md font-black text-[9px] tracking-widest uppercase bg-white border border-slate-200 text-slate-900 hover:bg-slate-50"
                                                        >
                                                            {isSearching ? <Loader2 className="h-3 w-3 animate-spin text-slate-400" /> : 'SEARCH'}
                                                        </Button>
                                                    </div>
                                                </form>

                                                {/* Search Results Dropdown-style */}
                                                {searchResults.length > 0 && (
                                                    <div
                                                        ref={searchResultsRef}
                                                        className="absolute left-5 right-5 mt-1 bg-white border border-slate-100 rounded-xl shadow-2xl z-50 p-1 max-h-[300px] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in duration-200"
                                                        onScroll={(e) => {
                                                            const target = e.currentTarget;
                                                            if (target.scrollHeight - target.scrollTop <= target.clientHeight + 50 && !isSearching && hasMore) {
                                                                const nextPage = page + 1;
                                                                setPage(nextPage);
                                                                handleSearch(searchQuery, true, nextPage);
                                                            }
                                                        }}
                                                    >
                                                        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-50 mb-1">
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Search Results</span>
                                                            <div className="flex items-center gap-3">
                                                                {searchResults.length > 0 && itemsToPlaces(searchResults).length > 0 && (
                                                                    <button
                                                                        onClick={() => setShowMap(!showMap)}
                                                                        className="text-[9px] font-black uppercase tracking-widest text-green-600 hover:text-green-700 flex items-center gap-1"
                                                                    >
                                                                        <MapPin className="h-2.5 w-2.5" />
                                                                        {showMap ? 'Hide Map' : 'View on Map'}
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => setSearchResults([])}
                                                                    className="text-[9px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-700"
                                                                >
                                                                    Close
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            {searchResults.map((item) => (
                                                                <div
                                                                    key={item.id}
                                                                    onClick={() => handleAddItem(item)}
                                                                    className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer group border border-transparent"
                                                                >
                                                                    <div className="w-7 h-7 rounded bg-slate-100 overflow-hidden shrink-0">
                                                                        {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="font-bold text-[11px] text-slate-900 truncate group-hover:text-black">{item.name}</div>
                                                                        <div className="text-[9px] text-slate-600 truncate uppercase font-medium">{item.subtitle}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {isSearching && page > 1 && (
                                                                <div className="p-2 text-center text-[10px] text-slate-400">Loading more...</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    }
                                </div>
                            </CardHeader>

                            <CardContent className="p-5 pt-0 flex-1 overflow-y-auto min-h-0 custom-scrollbar">
                                {/* INLINE AI NUDGE - Only for Owner, only for More/Places category, only when empty and not populating */}
                                {currentUserId === expandedList.user_id && expandedList.list_items.length === 0 && !isPopulating && !isBackgroundPopulating && (['other', 'places', 'more'].includes(expandedList.category?.toLowerCase() || '')) && (
                                    <div className="mb-6 p-6 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-center text-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500 shadow-sm mt-4">
                                        <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-50">
                                            <Sparkles className="w-6 h-6 text-indigo-500 animate-pulse" />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-base font-black uppercase tracking-tight text-slate-900 leading-tight">Need a starting point?</h4>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest max-w-[240px]">Our Magic AI can build a draft for you based on the title.</p>
                                        </div>
                                        <div className="flex flex-col w-full gap-2">
                                            <Button
                                                onClick={() => startEarlyPopulation(expandedList)}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest h-12 rounded-xl shadow-md transition-all active:scale-95"
                                            >
                                                Use Magic AI
                                            </Button>
                                            <button
                                                onClick={() => searchInputRef.current?.focus()}
                                                className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors py-2"
                                            >
                                                I&apos;ll add items manually
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <RankingList
                                    initialItems={expandedList.list_items}
                                    listId={expandedList.id}
                                    category={expandedList.category}
                                    title={expandedList.title}
                                    isPopulating={isPopulating || isBackgroundPopulating}
                                    showMap={showMap}
                                    mapItems={itemsToPlaces(expandedList.list_items.slice(0, 10))}
                                    onChange={(newItems) => {
                                        // Prevent updates to temp lists
                                        if (expandedList.id === 'temp-pending') return;
                                        setLists((prev: any[]) => prev.map(l =>
                                            l.id === expandedList.id ? { ...l, list_items: newItems } : l
                                        ));
                                    }}
                                />

                                {/* POPULATION FEEDBACK - Subtle Indicator */}
                                {isPopulating && (
                                    <div className="mt-4 px-4 py-2 border border-slate-100 rounded-lg bg-slate-50/50 flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                        <div className="w-full h-1 bg-slate-200/50 rounded-full overflow-hidden relative">
                                            <div
                                                className="absolute top-0 bottom-0 w-[40%] bg-slate-400/30 rounded-full"
                                                style={{
                                                    animation: 'slide-puck-modal 2s ease-in-out infinite alternate'
                                                }}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between w-full">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                                {populatedCount > 0 ? `Found ${populatedCount} items` : ""}
                                            </span>
                                            {populatedCount > 0 && (
                                                <button
                                                    onClick={() => handleSubmitWaitingComment()}
                                                    className="text-[9px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-700"
                                                >
                                                    Done
                                                </button>
                                            )}
                                        </div>
                                        <style dangerouslySetInnerHTML={{
                                            __html: `
                                            @keyframes slide-puck-modal {
                                                0% { left: 0%; }
                                                100% { left: 60%; }
                                            }
                                        `}} />
                                    </div>
                                )}

                                {/* FEATURE: Music Playlist Export - Removed from bottom */}
                            </CardContent>
                        </div>
                    </div >
                )
                }
            </Card >
        </div >
    );
}
