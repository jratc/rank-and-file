import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ResponseBtn } from '@/components/response-btn';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowLeft } from 'lucide-react';
import { Metadata, ResolvingMetadata } from 'next';
import { ShareButton } from '@/components/share-button';

type Props = {
    params: Promise<{ id: string }>
}

export async function generateMetadata(
    { params }: Props,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const { id } = await params;
    const supabase = await createClient();

    const { data: list } = await supabase
        .from('lists')
        .select(`*, profiles:user_id (username, display_name)`)
        .eq('id', id)
        .single();

    if (!list) {
        return {
            title: 'List Not Found',
        };
    }

    const displayName = list.profiles?.display_name || list.profiles?.username || 'Someone';
    const title = `${list.title} by ${displayName}`;
    const description = `Check out this ${list.category} list on Rank and File.`;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            type: 'article',
            // images: is handled automatically by opengraph-image.tsx
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
        }
    };
}

export default async function ListPage({ params }: Props) {
    const supabase = await createClient();
    const { id } = await params;

    // Fetch List + Profile + Items
    const { data: list, error } = await supabase
        .from('lists')
        .select(`
            *,
            profiles:user_id (username, display_name, avatar_url),
            list_items (*)
        `)
        .eq('id', id)
        .single();

    if (error || !list) {
        notFound();
    }

    // Sort items by rank
    const sortedItems = list.list_items?.sort((a: any, b: any) => a.rank - b.rank) || [];

    // Fetch Responses
    const { data: responses } = await supabase
        .from('lists')
        .select('*, profiles(username)')
        .eq('parent_id', id)
        .order('created_at', { ascending: false });

    // Check if current user is owner
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const isOwner = currentUser?.id === list.user_id;
    const authorName = list.profiles?.display_name || list.profiles?.username || 'Someone';

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-12">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header / Nav */}
                <div className="flex items-center justify-between">
                    <Link href="/" className="inline-flex items-center text-sm font-bold text-slate-400 hover:text-slate-900 transition-colors">
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        BACK TO DASHBOARD
                    </Link>

                    {/* Share Button */}
                    <ShareButton
                        title={`${list.title} by ${authorName}`}
                        text={`${authorName} made a list on Rank and File. What do you think? Respond now.`}
                    />
                </div>

                {/* Hero List Card */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden border border-slate-100 dark:border-white/5 p-8 md:p-12">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-12">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3 mb-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-widest uppercase bg-slate-100 text-slate-500`}>
                                    {list.category}
                                </span>
                                <span className="text-xs text-slate-400 font-mono">
                                    {new Date(list.created_at).toLocaleDateString()}
                                </span>
                            </div>
                            <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase leading-[0.9]">
                                {list.title}
                            </h1>
                            <div className="flex items-center gap-2 pt-2">
                                <span className="text-sm font-bold text-slate-400">BY</span>
                                <Link href={`/@${list.profiles?.username}`} className="text-lg font-bold hover:underline">
                                    @{list.profiles?.username}
                                </Link>
                            </div>
                        </div>

                        {!isOwner && <ResponseBtn parentListId={list.id} parentTitle={list.title} />}
                    </div>

                    {/* Wrapper for items */}
                    <div className="space-y-2">
                        {sortedItems.map((item: any, index: number) => (
                            <div key={item.id} className="group relative flex items-center bg-slate-50 dark:bg-white/5 rounded-lg p-3 pr-6 border border-slate-100 dark:border-white/5">
                                <span className="text-4xl font-black text-slate-200 dark:text-white/10 w-16 text-center shrink-0 leading-none">
                                    {index + 1}
                                </span>

                                {/* Image if available */}
                                {item.metadata?.imageUrl && (
                                    <img
                                        src={item.metadata.imageUrl}
                                        alt={item.metadata.name}
                                        className="h-12 w-12 rounded object-cover mr-4 bg-slate-200"
                                    />
                                )}

                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-black uppercase tracking-tight truncate">
                                        {item.metadata?.name || 'Unknown Item'}
                                    </h3>
                                    {item.metadata?.subtitle && (
                                        <p className="text-xs font-bold text-slate-400 truncate uppercase tracking-wider">
                                            {item.metadata.subtitle}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Responses Section */}
                {responses && responses.length > 0 && (
                    <div className="space-y-6 pt-12 border-t border-slate-200 dark:border-white/10">
                        <h2 className="text-2xl font-black tracking-tighter uppercase">Responses to this list</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {responses.map((resp: any) => (
                                <Link key={resp.id} href={`/list/${resp.id}`}>
                                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 hover:border-black transition-colors group cursor-pointer h-full flex flex-col">
                                        <div className="mb-4">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                RESPONSE BY @{resp.profiles?.username}
                                            </span>
                                        </div>
                                        <h3 className="text-xl font-black uppercase leading-none group-hover:underline">
                                            {resp.title}
                                        </h3>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
