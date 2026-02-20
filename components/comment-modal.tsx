
'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Trash2, Loader2, Send, X, Reply } from "lucide-react";
import { getComments, addComment, deleteComment } from "@/app/actions";
import { Comment } from "@/lib/types";
import { toast } from 'sonner';

interface CommentModalProps {
    isOpen: boolean;
    onClose: () => void;
    listId: string;
    listTitle: string;
    currentUserId: string | null;
}

export function CommentModal({ isOpen, onClose, listId, listTitle, currentUserId }: CommentModalProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [newComment, setNewComment] = useState("");
    const [isPosting, setIsPosting] = useState(false);
    const [replyingTo, setReplyingTo] = useState<Comment | null>(null);

    // Fetch comments when opened
    useEffect(() => {
        if (isOpen && listId) {
            loadComments();
        }
    }, [isOpen, listId]);

    const loadComments = async () => {
        setIsLoading(true);
        try {
            // @ts-ignore
            const rawData = await getComments(listId);
            const formattedData = (rawData || []).map((c: any) => ({
                ...c,
                profiles: Array.isArray(c.profiles) ? c.profiles[0] : c.profiles
            }));
            setComments(formattedData);
        } catch (error) {
            console.error("Failed to load comments", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddComment = async () => {
        if (!newComment.trim()) return;
        setIsPosting(true);
        try {
            // @ts-ignore
            const added = await addComment(listId, newComment, replyingTo?.id);
            setComments(prev => [...prev, added]);
            setNewComment("");
            setReplyingTo(null);
            toast.success(replyingTo ? "Reply added" : "Comment added");
        } catch (error) {
            toast.error("Failed to post comment");
        } finally {
            setIsPosting(false);
        }
    };

    // Simple thread organizer
    const commentThreads = comments.filter(c => !c.parent_id);
    const getReplies = (parentId: string) => comments.filter(c => c.parent_id === parentId);

    const handleDeleteComment = async (commentId: string) => {
        // Optimistic update
        const originalComments = [...comments];
        setComments(prev => prev.filter(c => c.id !== commentId));

        try {
            await deleteComment(commentId);
            toast.success("Comment deleted");
        } catch (error) {
            setComments(originalComments);
            toast.error("Failed to delete comment");
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="uppercase font-black text-xl tracking-tighter">
                        Thoughts: {listTitle}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto min-h-[200px] space-y-4 p-1">
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                        </div>
                    ) : comments.length === 0 ? (
                        <div className="text-center text-slate-400 text-sm py-8 italic">
                            No thoughts yet. Be the first to share!
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {commentThreads.map((comment) => (
                                <div key={comment.id} className="space-y-4">
                                    <CommentItem
                                        comment={comment}
                                        currentUserId={currentUserId}
                                        onReply={() => setReplyingTo(comment)}
                                        onDelete={() => handleDeleteComment(comment.id)}
                                    />
                                    {/* Replies */}
                                    {getReplies(comment.id).length > 0 && (
                                        <div className="ml-8 space-y-4 border-l-2 border-slate-100 pl-4">
                                            {getReplies(comment.id).map(reply => (
                                                <CommentItem
                                                    key={reply.id}
                                                    comment={reply}
                                                    currentUserId={currentUserId}
                                                    onReply={() => setReplyingTo(comment)} // Always reply to thread root or can we nest deeper? Let's stick to 1 level for now for simplicity
                                                    onDelete={() => handleDeleteComment(reply.id)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="border-t pt-4 mt-2">
                    {currentUserId ? (
                        <div className="space-y-2">
                            {replyingTo && (
                                <div className="flex items-center justify-between bg-slate-50 px-3 py-1.5 rounded-lg text-xs">
                                    <span className="text-slate-500">
                                        Replying to <span className="font-bold text-slate-900">{replyingTo.profiles?.display_name || replyingTo.profiles?.username}</span>
                                    </span>
                                    <button
                                        onClick={() => setReplyingTo(null)}
                                        className="text-slate-400 hover:text-slate-600"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            )}
                            <div className="flex gap-2">
                                <Textarea
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder={replyingTo ? "Write your reply..." : "Add your thoughts..."}
                                    className="min-h-[80px] resize-none"
                                    autoFocus={!!replyingTo}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleAddComment();
                                        }
                                        if (e.key === 'Escape' && replyingTo) {
                                            setReplyingTo(null);
                                        }
                                    }}
                                />
                                <Button
                                    onClick={handleAddComment}
                                    disabled={isPosting || !newComment.trim()}
                                    size="icon"
                                    className="h-auto aspect-square self-end"
                                >
                                    {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-sm text-slate-500 bg-slate-50 p-3 rounded">
                            Log in to share your thoughts.
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function CommentItem({ comment, currentUserId, onReply, onDelete }: {
    comment: Comment;
    currentUserId: string | null;
    onReply: () => void;
    onDelete: () => void;
}) {
    return (
        <div className="group flex gap-3 text-sm">
            <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">
                        {comment.profiles?.display_name || comment.profiles?.username || "Unknown"}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                        {new Date(comment.created_at).toLocaleDateString()}
                    </span>
                </div>
                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {comment.content}
                </p>
                <div className="flex items-center gap-3 pt-1">
                    <button
                        onClick={onReply}
                        className="text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-700 transition-colors flex items-center gap-1"
                    >
                        <Reply size={10} />
                        Reply
                    </button>
                    {currentUserId === comment.user_id && (
                        <button
                            onClick={onDelete}
                            className="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-red-500 transition-colors flex items-center gap-1"
                        >
                            <Trash2 size={10} />
                            Delete
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
