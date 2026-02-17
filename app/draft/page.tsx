'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getDraftList } from './actions';
import { RankingList } from '@/components/ranking-list';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Plus } from 'lucide-react';

function EditPageContent() {
    const searchParams = useSearchParams();
    const listId = searchParams.get('listId');
    const [list, setList] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!listId) {
            setLoading(false);
            return;
        }

        getDraftList(listId).then((data) => {
            setList(data);
            setLoading(false);
        }).catch(err => {
            console.error(err);
            toast.error("Failed to load list");
            setLoading(false);
        });
    }, [listId]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground animate-pulse">Loading your ranking...</p>
        </div>
    );

    if (!list) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 text-center">
                <div className="p-4 rounded-full bg-muted">
                    <Plus className="h-12 w-12 text-muted-foreground opacity-50" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">List Not Found</h2>
                    <p className="text-muted-foreground max-w-xs mx-auto mt-2">
                        We couldn't find the list you're looking for. It might have been deleted or moved.
                    </p>
                </div>
                <Button asChild variant="secondary" size="lg">
                    <Link href="/">Return to Dashboard</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="container max-w-4xl p-6 mx-auto">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-6 pb-6 border-b border-white/10">
                <div className="flex flex-col gap-2">
                    <Link href="/" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors mb-2">
                        <ArrowLeft className="h-3 w-3" /> Back to Dashboard
                    </Link>
                    <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                        {list.title}
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Drag and drop items to re-rank. Your changes are saved in real-time.
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button asChild variant="outline" size="lg" className="bg-white/5 border-white/10 backdrop-blur-md hover:bg-white/10">
                        <Link href={`/search?listId=${list.id}&category=${list.category}`} className="flex items-center gap-2">
                            <Plus className="h-5 w-5" /> Add More Items
                        </Link>
                    </Button>
                    <Button asChild size="lg" className="shadow-lg hover:shadow-xl transition-all">
                        <Link href="/">Done Editing</Link>
                    </Button>
                </div>
            </div>

            <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-xl font-bold opacity-80">Ranked Items</h2>
                    <span className="text-xs font-mono px-2 py-1 rounded bg-white/5 text-muted-foreground">
                        {list.list_items?.length || 0} Total
                    </span>
                </div>
                <RankingList initialItems={list.list_items} listId={list.id} title={list.title} />
            </div>
        </div>
    );
}

export default function EditPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center">Loading edit page...</div>}>
            <EditPageContent />
        </Suspense>
    );
}
