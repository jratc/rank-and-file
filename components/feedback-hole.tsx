'use client';

import { useState, useRef } from 'react';
import { useDraggable, useDroppable, DndContext, DragOverlay } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { submitFeedback } from '@/app/actions';
import { toast } from 'sonner';
import { Send, Trash2, Ghost } from 'lucide-react';

export function FeedbackHole() {
    const [feedback, setFeedback] = useState('');
    const [isHovered, setIsHovered] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleDragEnd = async (event: any) => {
        const { over } = event;
        if (over && over.id === 'feedback-hole') {
            await handleSubmit();
        }
    };

    const handleSubmit = async () => {
        if (!feedback.trim()) return;

        try {
            await submitFeedback(feedback);
            toast.success("Feedback tossed into the void!", {
                icon: <Ghost className="w-4 h-4" />
            });
            setIsSubmitted(true);
            setTimeout(() => {
                setFeedback('');
                setIsSubmitted(false);
            }, 1000);
        } catch (error) {
            toast.error("The void rejected your feedback.");
        }
    };

    return (
        <div className="fixed right-8 bottom-24 z-50 flex flex-col items-end gap-4 pointer-events-none">
            <DndContext onDragEnd={handleDragEnd}>
                {/* Feedback Input / Scrap */}
                {feedback && !isSubmitted && (
                    <DraggableScrap text={feedback} onTextChange={setFeedback} />
                )}

                {!feedback && (
                    <div className="pointer-events-auto bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl shadow-2xl transition-all duration-500 hover:scale-105 group">
                        <textarea
                            placeholder="Feedback hole..."
                            className="bg-transparent border-none outline-none text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 w-48 h-24 resize-none font-medium"
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                        />
                        <div className="text-[10px] uppercase tracking-widest font-black text-slate-400 mt-2 opacity-50 group-hover:opacity-100 transition-opacity">
                            Drag the scrap to submit
                        </div>
                    </div>
                )}

                {/* The Hole */}
                <DroppableHole isHovered={isHovered} onHover={setIsHovered} isActive={!!feedback} />

                <DragOverlay>
                    {feedback ? (
                        <div className="p-4 bg-amber-50 shadow-xl border border-amber-200 -rotate-3 scale-110 opacity-90 cursor-grabbing">
                            <p className="text-xs font-serif text-slate-700 leading-tight">
                                {feedback.length > 100 ? feedback.substring(0, 100) + '...' : feedback}
                            </p>
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
}

function DraggableScrap({ text, onTextChange }: { text: string; onTextChange: (s: string) => void }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: 'feedback-scrap',
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className="pointer-events-auto p-4 bg-amber-50/90 shadow-lg border border-amber-200 -rotate-2 w-48 min-h-[100px] cursor-grab active:cursor-grabbing hover:scale-105 transition-transform"
        >
            <textarea
                className="bg-transparent border-none outline-none text-xs font-serif text-slate-700 w-full h-full resize-none pointer-events-auto"
                value={text}
                onChange={(e) => onTextChange(e.target.value)}
                onClick={(e) => e.stopPropagation()}
            />
        </div>
    );
}

function DroppableHole({ isHovered, onHover, isActive }: { isHovered: boolean; onHover: (b: boolean) => void; isActive: boolean }) {
    const { setNodeRef, isOver } = useDroppable({
        id: 'feedback-hole',
    });

    return (
        <div
            ref={setNodeRef}
            className={`pointer-events-auto relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-700 overflow-hidden
                ${isActive ? 'opacity-100 scale-100' : 'opacity-30 scale-75 grayscale blur-[1px] pointer-events-none'}
                ${isOver ? 'bg-black scale-110 shadow-[0_0_40px_rgba(0,0,0,0.5)]' : 'bg-slate-900/10'}
            `}
        >
            {/* The infinite void effect */}
            <div className={`absolute inset-0 rounded-full transition-all duration-1000
                ${isOver ? 'bg-black shadow-inner' : 'bg-gradient-to-br from-slate-900 to-black'}
            `}>
                <div className={`absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] from-indigo-500/20 to-transparent transition-opacity duration-1000 ${isOver ? 'opacity-100' : 'opacity-0'}`} />
            </div>

            <div className={`relative flex flex-col items-center gap-1 transition-all duration-500 ${isOver ? 'scale-75 opacity-20 rotate-180' : 'scale-100'}`}>
                <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/20 animate-spin-slow flex items-center justify-center">
                    <Ghost className="text-white/40 w-6 h-6" />
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 10s linear infinite;
                }
            `}} />
        </div>
    );
}
