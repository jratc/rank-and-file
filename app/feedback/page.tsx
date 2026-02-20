import { getFeedback } from '@/app/actions';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Ghost, Calendar, User, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function FeedbackPage() {
    // Force dynamic rendering to ensure fresh feedback
    const feedbackList = await getFeedback();

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-black p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-12">
                    <div className="w-16 h-16 bg-slate-900 dark:bg-white rounded-2xl flex items-center justify-center shadow-2xl">
                        <Ghost className="w-8 h-8 text-white dark:text-black" />
                    </div>
                    <div>
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 mb-6 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors group"
                        >
                            <ArrowLeft className="w-3 h-3 transition-transform group-hover:-translate-x-1" />
                            Back to Lists
                        </Link>
                        <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">
                            The Feedback Void
                        </h1>
                        <p className="font-mono text-xs font-bold text-slate-400 tracking-widest uppercase mt-1">
                            Messages retrieved from the beyond
                        </p>
                    </div>
                </div>

                {feedbackList.length === 0 ? (
                    <div className="text-center py-24 bg-white dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/10">
                        <Ghost className="w-12 h-12 text-slate-200 dark:text-white/10 mx-auto mb-4" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">
                            The void is silent... for now.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {feedbackList.map((item: any) => (
                            <Card key={item.id} className="bg-white dark:bg-slate-900 border-none shadow-xl hover:shadow-2xl transition-all rounded-3xl overflow-hidden group">
                                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 dark:border-white/5 py-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center">
                                            <User className="w-4 h-4 text-slate-400" />
                                        </div>
                                        <span className="font-bold text-xs uppercase tracking-tight text-slate-500">
                                            {item.profiles?.display_name || item.profiles?.username || 'Guest'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-300">
                                        <Calendar className="w-3 h-3" />
                                        <span className="font-mono text-[10px] uppercase font-bold">
                                            {item.created_at ? new Intl.DateTimeFormat('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                hour12: false
                                            }).format(new Date(item.created_at)) : 'Date Unknown'}
                                        </span>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <p className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed whitespace-pre-wrap">
                                        {item.content}
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
