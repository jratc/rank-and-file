import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/logout/actions'
import { Button } from '@/components/ui/button'
import { LogOut, User, Home } from 'lucide-react'
import Link from 'next/link'
import { SettingsDropdown } from '@/components/settings-dropdown'
import { FollowingDropdown } from '@/components/following-dropdown'
import { getFollowedUsers } from '@/app/actions'

export async function Header() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let displayName = null;
    let username = null;
    let bio = '';
    let followedUsers: any[] = [];

    if (user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('username, display_name, bio')
            .eq('id', user.id)
            .single();
        username = profile?.username;
        displayName = profile?.display_name;
        bio = profile?.bio || '';

        // Fetch followed users (wrapped in try/catch in case table doesn't exist yet)
        try {
            followedUsers = await getFollowedUsers();
        } catch (e) {
            console.error('Failed to fetch followed users:', e);
        }
    }

    return (
        <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
            <div className="container flex h-14 max-w-screen-2xl items-center justify-between px-4 mx-auto">
                <div className="flex items-center gap-6">
                    <Link href="/" className="flex items-center space-x-2">
                        <span className="font-black text-xl tracking-tighter uppercase">RANK AND FILE</span>
                    </Link>
                </div>

                <nav className="flex items-center gap-1 sm:gap-3">
                    <Link href="/" className="p-2 text-slate-400 hover:text-black transition-colors" title="Home">
                        <Home className="h-5 w-5" />
                    </Link>

                    {user && username ? (
                        <>
                            {/* Following Dropdown */}
                            <FollowingDropdown followedUsers={followedUsers} />

                            {/* Profile Link */}
                            <Link
                                href={`/@${username}`}
                                className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-black tracking-widest uppercase border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                <User className="h-3 w-3" />
                                <span className="hidden sm:inline">{displayName || `@${username}`}</span>
                            </Link>

                            {/* Settings Dropdown */}
                            <SettingsDropdown
                                initialDisplayName={displayName || ''}
                                initialBio={bio}
                                username={username}
                            />

                            {/* Logout */}
                            <form action={logout}>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    type="submit"
                                    className="h-9 w-9 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                    title="Logout"
                                >
                                    <LogOut className="h-4 w-4" />
                                </Button>
                            </form>
                        </>
                    ) : (
                        <Link href="/login" className="text-xs font-black tracking-widest uppercase px-4 py-2 bg-black text-white rounded-lg hover:bg-slate-800 transition-colors">
                            SIGN IN
                        </Link>
                    )}
                </nav>
            </div>
        </header>
    )
}
