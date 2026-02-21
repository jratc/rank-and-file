import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface DashboardHeaderProps {
    showNameModal: boolean;
    displayName: string;
    setDisplayName: (name: string) => void;
    isSavingProfile: boolean;
    handleSaveProfile: () => void;
    activeTab: 'all' | 'following';
    setActiveTab: (tab: 'all' | 'following') => void;
    currentUserId: string | null;
    isGlobalSearchExpanded: boolean;
    setIsGlobalSearchExpanded: (expanded: boolean) => void;
    globalSearchQuery: string;
    setGlobalSearchQuery: (query: string) => void;
    globalSearchInputRef: React.RefObject<HTMLInputElement | null>;
    isLoadingFollowing: boolean;
    followingListsCount: number;
}

export function DashboardHeader({
    showNameModal,
    displayName,
    setDisplayName,
    isSavingProfile,
    handleSaveProfile,
    activeTab,
    setActiveTab,
    currentUserId,
    isGlobalSearchExpanded,
    setIsGlobalSearchExpanded,
    globalSearchQuery,
    setGlobalSearchQuery,
    globalSearchInputRef,
    isLoadingFollowing,
    followingListsCount
}: DashboardHeaderProps) {
    return (
        <>
            {/* Display Name Enforcement Modal */}
            {showNameModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                    <Card className="w-full max-w-md bg-white dark:bg-slate-900 border-none shadow-2xl">
                        <CardHeader className="text-center pb-2">
                            <CardTitle className="text-2xl font-black uppercase tracking-tighter">Welcome to the Rank</CardTitle>
                            <CardDescription>To start ranking, please set your display name.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Display Name</label>
                                <Input
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="e.g. Alex Smith"
                                    className="font-bold text-lg"
                                    autoFocus
                                />
                            </div>
                            <Button
                                onClick={handleSaveProfile}
                                disabled={!displayName.trim() || isSavingProfile}
                                className="w-full bg-black text-white hover:bg-slate-800 font-bold uppercase tracking-widest h-12"
                            >
                                {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start Ranking"}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* TAB TOGGLE & GLOBAL SEARCH */}
            <div className="flex justify-center mb-8 items-center gap-4">
                <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-full border border-slate-200 dark:border-white/10">
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'all'
                            ? 'bg-white dark:bg-slate-800 text-black dark:text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        Global
                    </button>
                    <button
                        onClick={() => {
                            if (!currentUserId) {
                                toast.error("Log in to follow people!");
                                return;
                            }
                            setActiveTab('following');
                        }}
                        className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'following'
                            ? 'bg-white dark:bg-slate-800 text-black dark:text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        Following
                    </button>
                </div>

                {/* GLOBAL SEARCH */}
                <div className={`flex items-center transition-all duration-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-full overflow-hidden ${isGlobalSearchExpanded ? 'w-64 shadow-md' : 'w-10 h-10 border-transparent bg-transparent hover:bg-slate-100'}`}>
                    {isGlobalSearchExpanded ? (
                        <div className="flex items-center w-full px-3">
                            <Search className="h-4 w-4 text-slate-400 shrink-0" />
                            <input
                                ref={globalSearchInputRef}
                                type="text"
                                value={globalSearchQuery}
                                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                                onBlur={() => {
                                    if (!globalSearchQuery.trim()) {
                                        setIsGlobalSearchExpanded(false);
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                        setGlobalSearchQuery('');
                                        setIsGlobalSearchExpanded(false);
                                    }
                                }}
                                placeholder="Search lists or people..."
                                className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium px-2 py-2 placeholder:text-slate-400"
                            />
                            {globalSearchQuery && (
                                <button
                                    onClick={() => setGlobalSearchQuery('')}
                                    className="p-1 hover:bg-slate-100 rounded-full"
                                >
                                    <X className="h-3 w-3 text-slate-400" />
                                </button>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsGlobalSearchExpanded(true)}
                            className="w-full h-full flex items-center justify-center text-slate-400 hover:text-slate-600"
                        >
                            <Search className="h-5 w-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* EMPTY STATE FOR FOLLOWING */}
            {activeTab === 'following' && !isLoadingFollowing && followingListsCount === 0 && (
                <div className="text-center py-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Users className="h-8 w-8 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight mb-2">Your feed is empty</h3>
                    <p className="text-slate-500 max-w-sm mx-auto mb-8">
                        Follow creators to see their rankings appear here. Use the search bar to find people.
                    </p>
                    <Button
                        variant="outline"
                        onClick={() => setActiveTab('all')}
                        className="font-bold uppercase tracking-widest text-xs"
                    >
                        Back to Global Feed
                    </Button>
                </div>
            )}
        </>
    );
}
