import { FollowButton } from '@/components/follow-button';

interface ProfileHeaderProps {
    profile: any;
    currentUserId?: string | null;
    isFollowingProfile?: boolean;
}

export function ProfileHeader({ profile, currentUserId, isFollowingProfile = false }: ProfileHeaderProps) {
    const isOwnProfile = currentUserId === profile.id;

    return (
        <section className="flex flex-col items-center text-center gap-4 max-w-4xl mx-auto mb-8 group">
            <h1 className="text-6xl font-black tracking-tighter sm:text-7xl text-black dark:text-white uppercase leading-[0.8] mb-2 cursor-default">
                {profile.display_name || `@${profile.username}`}
            </h1>
            {profile.display_name && (
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight opacity-50">
                    @{profile.username}
                </p>
            )}
            {profile.bio && (
                <p className="text-lg font-medium text-slate-400 max-w-xl italic">
                    &quot;{profile.bio}&quot;
                </p>
            )}

            {/* Follow Button (only shown on other users' profiles, when logged in) */}
            {currentUserId && !isOwnProfile && (
                <FollowButton
                    targetUserId={profile.id}
                    targetDisplayName={profile.display_name || profile.username}
                    initialIsFollowing={isFollowingProfile}
                />
            )}

            <div className="flex gap-8 mt-4 font-mono text-[10px] font-black tracking-widest text-slate-300 uppercase">
                <div className="flex flex-col">
                    <span className="text-slate-900 dark:text-white text-lg">--</span>
                    <span>RANKINGS</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-slate-900 dark:text-white text-lg">--</span>
                    <span>RESPONSES</span>
                </div>
            </div>
        </section>
    );
}
