import { getFeedback, getLatestSynthesis } from '@/app/actions';
import { Ghost, Calendar, User, ArrowLeft, Zap, MessageSquare, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function FeedbackPage() {
    // Force dynamic rendering to ensure fresh feedback
    const [feedbackList, synthesis] = await Promise.all([
        getFeedback(),
        getLatestSynthesis()
    ]);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-black p-4 md:p-8">
            <div className="max-w-[1400px] mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-900 dark:bg-white rounded-xl flex items-center justify-center shadow-xl">
                            <Ghost className="w-6 h-6 text-white dark:text-black" />
                        </div>
                        <div>
                            <Link
                                href="/"
                                className="inline-flex items-center gap-2 mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors group"
                            >
                                <ArrowLeft className="w-3 h-3 transition-transform group-hover:-translate-x-1" />
                                Back to Lists
                            </Link>
                            <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">
                                The Feedback Void
                            </h1>
                        </div>
                    </div>

                    {synthesis && (
                        <div className="flex items-center gap-3 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-full border border-indigo-100 dark:border-indigo-500/20">
                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                                AI Pulse Active
                            </span>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* LEFT COLUMN: THE PULSE (Synthesis) */}
                    <div className="lg:col-span-5 sticky top-8 space-y-6">
                        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-100 dark:border-white/5">
                            <div className="flex items-center gap-2 mb-6">
                                <Zap className="w-5 h-5 text-indigo-500" />
                                <h2 className="text-xl font-black uppercase tracking-tight">The Pulse</h2>
                            </div>

                            {synthesis ? (
                                <div className="space-y-8">
                                    <div className="p-4 bg-slate-50 dark:bg-white/[0.02] rounded-2xl border border-slate-100 dark:border-white/5">
                                        <p className="text-sm font-bold text-slate-600 dark:text-slate-300 leading-relaxed italic">
                                            "{synthesis.summary}"
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        {synthesis.categories.map((cat: any, i: number) => (
                                            <div key={i} className="group">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                                                        {cat.name}
                                                    </span>
                                                    {cat.sentiment === 'positive' ? (
                                                        <TrendingUp className="w-3 h-3 text-green-500" />
                                                    ) : cat.sentiment === 'negative' ? (
                                                        <TrendingDown className="w-3 h-3 text-red-500" />
                                                    ) : (
                                                        <Minus className="w-3 h-3 text-slate-300" />
                                                    )}
                                                </div>
                                                <ul className="space-y-2">
                                                    {cat.issues.map((issue: string, j: number) => (
                                                        <li key={j} className="flex items-start gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                                                            <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-white/20 mt-1.5 shrink-0" />
                                                            {issue}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                                            Analyzed by Gemini
                                        </span>
                                        <span className="text-[10px] font-mono font-bold text-slate-300 uppercase">
                                            {synthesis.last_updated ? new Date(synthesis.last_updated).toLocaleDateString() : 'Real-time'}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12 text-slate-400 font-bold uppercase tracking-widest text-xs">
                                    Synthesizing data...
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: THE STREAM (Compact Feedback) */}
                    <div className="lg:col-span-7 space-y-4">
                        <div className="flex items-center gap-2 mb-2 px-2">
                            <MessageSquare className="w-4 h-4 text-slate-400" />
                            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">The Stream</h2>
                        </div>

                        {feedbackList.length === 0 ? (
                            <div className="text-center py-24 bg-white dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/10">
                                <Ghost className="w-12 h-12 text-slate-200 dark:text-white/10 mx-auto mb-4" />
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">
                                    The void is silent.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {feedbackList.map((item: any) => (
                                    <div key={item.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center">
                                                    <User className="w-2.5 h-2.5 text-slate-400" />
                                                </div>
                                                <span className="font-bold text-[10px] uppercase tracking-tight text-slate-500">
                                                    {item.profiles?.display_name || item.profiles?.username || 'Guest'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-slate-300">
                                                <Calendar className="w-2.5 h-2.5" />
                                                <span className="font-mono text-[9px] uppercase font-bold">
                                                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : '---'}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-normal pl-7">
                                            {item.content}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
