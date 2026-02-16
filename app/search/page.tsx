'use client'

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { searchEntities, addToList } from './actions';
import { RankedItem, Category } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Search, Plus, Loader2, Music, Film, Beer, Utensils, MoreHorizontal } from 'lucide-react';

const categoryConfig = {
    music: { label: "Songs/Albums", icon: <Music className="h-4 w-4" />, placeholder: "Search for artists or albums..." },
    movies: { label: "Movies", icon: <Film className="h-4 w-4" />, placeholder: "Search for movie titles..." },
    bars: { label: "Bars", icon: <Beer className="h-4 w-4" />, placeholder: "Search for bars or lounges..." },
    restaurants: { label: "Restaurants", icon: <Utensils className="h-4 w-4" />, placeholder: "Search for food or restaurants..." },
    other: { label: "Items", icon: <MoreHorizontal className="h-4 w-4" />, placeholder: "Search for anything..." },
};

function SearchContent() {
    const searchParams = useSearchParams();
    const listId = searchParams.get('listId');
    const categoryUrl = searchParams.get('category') as Category || 'music';
    type ConfigKey = keyof typeof categoryConfig;
    const category: ConfigKey = categoryUrl in categoryConfig ? categoryUrl as ConfigKey : 'other';

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<RankedItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [addingId, setAddingId] = useState<string | null>(null);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const items = await searchEntities(query, category);
            setResults(items);
            if (items.length === 0) {
                toast.info('No results found');
            }
        } catch (error) {
            toast.error('Search failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (item: RankedItem) => {
        if (!listId) {
            toast.error('No active list found. Please select a list from the home page first.');
            return;
        }

        setAddingId(item.id);
        const result = await addToList(item, listId);
        setAddingId(null);

        if (result?.error) {
            toast.error(result.error);
        } else {
            toast.success(`Added "${item.name}" to your list`);
        }
    };

    return (
        <div className="container max-w-5xl p-6 mx-auto">
            <div className="flex flex-col gap-2 mb-8">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        {categoryConfig[category].icon}
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">Add to your {categoryConfig[category].label} Ranking</h1>
                </div>
                <p className="text-muted-foreground">Search for {categoryConfig[category].label.toLowerCase()} to add to your list.</p>
            </div>

            <form onSubmit={handleSearch} className="flex gap-4 mb-8">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={categoryConfig[category].placeholder}
                        className="pl-10 text-lg h-12 bg-white/5 dark:bg-gray-900/50 backdrop-blur-md"
                    />
                </div>
                <Button type="submit" disabled={loading} size="lg" className="h-12 px-8">
                    {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Search'}
                </Button>
            </form>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {results.map((item) => (
                    <Card key={item.id} className="group overflow-hidden transition-all hover:border-primary/50 bg-white/5 dark:bg-gray-900/40 backdrop-blur-md">
                        <div className="relative aspect-square">
                            {item.imageUrl ? (
                                <img
                                    src={item.imageUrl}
                                    alt={item.name}
                                    className="absolute inset-0 object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                                />
                            ) : (
                                <div className="flex items-center justify-center w-full h-full bg-muted text-muted-foreground">
                                    No Image
                                </div>
                            )}
                        </div>
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-sm font-bold truncate" title={item.name}>{item.name}</CardTitle>
                            <CardDescription className="text-xs truncate">{item.subtitle}</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-2">
                            <Button
                                onClick={() => handleAdd(item)}
                                disabled={addingId === item.id}
                                variant="secondary"
                                className="w-full h-9 text-xs"
                            >
                                {addingId === item.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <><Plus className="mr-2 h-4 w-4" /> Add to List</>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {results.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-3xl border-white/5 bg-white/[0.02]">
                    <Search className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                    <h3 className="text-xl font-medium text-muted-foreground">Start your search</h3>
                    <p className="text-sm text-muted-foreground/60 max-w-xs mx-auto">
                        Your search results will appear here. Add as many items as you like to your ranking.
                    </p>
                </div>
            )}
        </div>
    );
}

export default function SearchPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center">Loading search...</div>}>
            <SearchContent />
        </Suspense>
    );
}
