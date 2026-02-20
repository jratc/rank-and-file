'use client';

import { useState } from 'react';
import { useDraggable, useDroppable, DndContext, DragOverlay } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { submitFeedback } from '@/app/actions';
import { toast } from 'sonner';
import { Ghost, Move, Send, X } from 'lucide-react';

export function FeedbackHole() {
    const [feedback, setFeedback] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

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
        <div
            className="fixed right-8 top-32 z-50 flex flex-col items-center gap-4 group pointer-events-none"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => !feedback && setIsVisible(false)}
        >
            <DndContext onDragEnd={handleDragEnd}>
                {/* The Hole (Now on Top) */}
                <div
                    onClick={() => setIsVisible(!isVisible)}
                    className="pointer-events-auto cursor-pointer relative z-10"
                >
                    <DroppableHole isActive={!!feedback || isVisible} />
                </div>

                {/* STABLE INPUT CONTAINER (Now Below) */}
                <div
                    className={`pointer-events-auto bg-slate-900/5 dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 p-4 rounded-3xl shadow-2xl transition-all duration-500 w-64 ${isSubmitted ? 'scale-90 opacity-0 blur-lg' : isVisible ? 'scale-100 opacity-100 translate-y-0' : 'scale-75 opacity-0 pointer-events-none -translate-y-8'} relative`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={() => { setIsVisible(false); setFeedback(''); }}
                        className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    <textarea
                        placeholder="Feedback hole..."
                        className="bg-transparent border-none outline-none text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 w-full h-32 resize-none font-medium custom-scrollbar mt-4"
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        disabled={isSubmitted}
                    />

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/50 dark:border-white/10">
                        <div className="text-[10px] uppercase tracking-widest font-black text-slate-400">
                            {feedback.length > 0 ? "Drag handle to toss" : "Feed the void"}
                        </div>
                        {feedback.length > 0 && (
                            <TossHandle />
                        )}
                    </div>
                </div>

                <DragOverlay>
                    {feedback ? (
                        <div className="w-12 h-12 bg-black dark:bg-white rounded-full flex items-center justify-center shadow-2xl scale-110 cursor-grabbing border-4 border-indigo-500">
                            <Send className="w-5 h-5 text-indigo-500 animate-pulse" />
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
}

function TossHandle() {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: 'feedback-handle',
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.3 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg cursor-grab active:cursor-grabbing transition-colors"
            title="Drag me to the hole"
        >
            <Move className="w-4 h-4" />
        </div>
    );
}

function DroppableHole({ isActive }: { isActive: boolean }) {
    const { setNodeRef, isOver } = useDroppable({
        id: 'feedback-hole',
    });

    return (
        <div
            ref={setNodeRef}
            className={`pointer-events-auto relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-700 overflow-hidden
                ${isActive ? 'opacity-100 scale-100 rotate-0' : 'opacity-20 scale-75 grayscale blur-[2px] pointer-events-none rotate-45'}
                ${isOver ? 'bg-black scale-110 shadow-[0_0_50px_rgba(79,70,229,0.4)]' : 'bg-slate-900/10'}
            `}
        >
            {/* The infinite void effect */}
            <div className={`absolute inset-0 rounded-full transition-all duration-1000
                ${isOver ? 'bg-black shadow-inner' : 'bg-gradient-to-br from-slate-900 to-black'}
            `}>
                <div className={`absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] from-indigo-500/40 to-transparent transition-opacity duration-1000 ${isOver ? 'opacity-100' : 'opacity-0'}`} />
            </div>

            <div className={`relative flex flex-col items-center gap-1 transition-all duration-500 ${isOver ? 'scale-50 opacity-10 rotate-180' : 'scale-100'}`}>
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
                    animation: spin-slow 15s linear infinite;
                }
            `}} />
        </div>
    );
}
