
'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Trash2, Loader2, Send } from "lucide-react";
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
            const added = await addComment(listId, newComment);
            setComments(prev => [...prev, added]);
            setNewComment("");
            toast.success("Explanation added");
        } catch (error) {
            toast.error("Failed to post comment");
        } finally {
            setIsPosting(false);
        }
    };

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
                        Explain: {listTitle}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto min-h-[200px] space-y-4 p-1">
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                        </div>
                    ) : comments.length === 0 ? (
                        <div className="text-center text-slate-400 text-sm py-8 italic">
                            No explanations yet. Be the first to explain yourself!
                        </div>
                    ) : (
                        comments.map((comment) => (
                            <div key={comment.id} className="group flex gap-3 text-sm">
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-900">
                                            {comment.profiles?.display_name || comment.profiles?.username || "Unknown"}
                                        </span>
                                        <span className="text-xs text-slate-400">
                                            {new Date(comment.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                                        {comment.content}
                                    </p>
                                </div>
                                {currentUserId === comment.user_id && (
                                    <button
                                        onClick={() => handleDeleteComment(comment.id)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 p-1"
                                        title="Delete comment"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>

                <div className="border-t pt-4 mt-2">
                    {currentUserId ? (
                        <div className="flex gap-2">
                            <Textarea
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Explain yourself..."
                                className="min-h-[80px] resize-none"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleAddComment();
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
                    ) : (
                        <div className="text-center text-sm text-slate-500 bg-slate-50 p-3 rounded">
                            Log in to explain yourself or comment.
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
