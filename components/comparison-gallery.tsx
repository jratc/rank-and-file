'use client';

/* ── FEATURE FLAG ──────────────────────────────────────────────
   To disable, comment out or remove the /compare/[list-id] route
   ──────────────────────────────────────────────────────────── */

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface ComparisonGalleryProps {
    thread: any[]; // [Root list, Response1, Response2, ...]
    onClose?: () => void;
}

/**
 * Find items that appear in multiple lists (by name, case-insensitive).
 * Returns a Set of lowercased item names that are "shared".
 */
function findSharedItems(thread: any[]): Set<string> {
    const itemCounts = new Map<string, number>();

    thread.forEach((list) => {
        const seen = new Set<string>(); // avoid counting duplicates within same list
        (list.list_items || []).forEach((item: any) => {
            const name = (item.metadata?.name || '').toLowerCase();
            if (name && !seen.has(name)) {
                seen.add(name);
                itemCounts.set(name, (itemCounts.get(name) || 0) + 1);
            }
        });
    });

    const shared = new Set<string>();
    itemCounts.forEach((count, name) => {
        if (count > 1) shared.add(name);
    });
    return shared;
}

export function ComparisonGallery({ thread, onClose }: ComparisonGalleryProps) {
    const sharedItems = useMemo(() => findSharedItems(thread), [thread]);

    if (thread.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <p className="text-slate-400 font-bold uppercase tracking-widest">No lists to compare</p>
            </div>
        );
    }

    const rootList = thread[0];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-slate-200 px-6 py-4">
                <div className="flex items-center gap-4 max-w-screen-2xl mx-auto">
                    {onClose ? (
                        <button onClick={onClose} className="text-slate-400 hover:text-black transition-colors">
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                    ) : (
                        <Link href="/" className="text-slate-400 hover:text-black transition-colors">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    )}
                    <div>
                        <h1 className="font-black text-xl uppercase tracking-tighter text-slate-900">
                            {rootList.title}
                        </h1>
                        <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                            {thread.length} {thread.length === 1 ? 'list' : 'lists'} • {sharedItems.size} shared items
                        </p>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="px-6 pt-4 pb-2 max-w-screen-2xl mx-auto">
                <div className="flex items-center gap-4 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300"></span>
                        Shared across lists
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm bg-white border border-slate-200"></span>
                        Unique to this list
                    </span>
                </div>
            </div>

            {/* Horizontal Scroll Gallery */}
            <div className="relative">
                <div
                    className="flex gap-6 overflow-x-auto snap-x snap-mandatory px-6 py-4 pb-8 scrollbar-hide"
                    style={{ scrollBehavior: 'smooth' }}
                >
                    {thread.map((list, listIndex) => {
                        const isOriginal = listIndex === 0;
                        const username = list.profiles?.username || 'unknown';

                        return (
                            <div
                                key={list.id}
                                className="snap-center shrink-0 w-[380px]"
                            >
                                <div className={`
                                    bg-white rounded-2xl shadow-lg border overflow-hidden
                                    ${isOriginal ? 'border-black shadow-xl' : 'border-slate-200'}
                                `}>
                                    {/* Card Header */}
                                    <div className={`
                                        px-5 py-4 border-b
                                        ${isOriginal ? 'bg-black text-white border-black' : 'bg-slate-50 border-slate-100'}
                                    `}>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className={`
                                                    font-mono text-[9px] font-bold uppercase tracking-widest mb-1
                                                    ${isOriginal ? 'text-slate-400' : 'text-slate-400'}
                                                `}>
                                                    {isOriginal ? 'ORIGINAL' : `RESPONSE #${listIndex}`}
                                                </p>
                                                <h3 className={`
                                                    font-black text-lg uppercase tracking-tighter leading-tight
                                                    ${isOriginal ? 'text-white' : 'text-slate-900'}
                                                `}>
                                                    {list.title}
                                                </h3>
                                            </div>
                                            <span className={`
                                                font-mono text-[10px] font-bold lowercase
                                                ${isOriginal ? 'text-slate-500' : 'text-slate-400'}
                                            `}>
                                                @{username}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Items */}
                                    <div className="divide-y divide-slate-50">
                                        {(list.list_items || [])
                                            .sort((a: any, b: any) => (a.rank || 0) - (b.rank || 0))
                                            .map((item: any, itemIndex: number) => {
                                                const itemName = (item.metadata?.name || '').toLowerCase();
                                                const isShared = sharedItems.has(itemName);

                                                return (
                                                    <div
                                                        key={item.id}
                                                        className={`
                                                            flex items-center gap-3 p-3 transition-colors
                                                            ${isShared ? 'bg-amber-50/80' : 'bg-white'}
                                                        `}
                                                    >
                                                        <span className="font-mono font-black text-lg text-slate-200 w-8 text-right tabular-nums shrink-0">
                                                            {itemIndex + 1}
                                                        </span>

                                                        {item.metadata?.imageUrl && (
                                                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                                                                <img
                                                                    src={item.metadata.imageUrl}
                                                                    alt={item.metadata.name}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            </div>
                                                        )}

                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-bold text-sm text-slate-900 truncate uppercase">
                                                                {item.metadata?.name}
                                                            </div>
                                                            <div className="text-[9px] text-slate-400 font-mono uppercase tracking-wider truncate">
                                                                {item.metadata?.subtitle}
                                                            </div>
                                                        </div>

                                                        {isShared && (
                                                            <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest bg-amber-100 px-2 py-0.5 rounded-full shrink-0">
                                                                match
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                    </div>

                                    {/* Footer */}
                                    <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
                                        <p className="text-[9px] font-mono font-bold text-slate-300 uppercase tracking-widest">
                                            {(list.list_items || []).length} items
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
