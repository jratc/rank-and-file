import { getProfileByUsername, getPublicListsByUserId } from "@/lib/profiles";
import { getUserResponseIds, isFollowing } from "@/app/actions";
import { Dashboard } from "@/components/dashboard";
import { Header } from "@/components/header";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ProfileHeader } from "@/components/profile-header";

interface ProfilePageProps {
    params: Promise<{
        username: string;
    }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
    const { username } = await params;

    // Remove the @ prefix if it exists (though Next.js routing might handle this if named @[username])
    const cleanUsername = username.startsWith('%40') ? username.substring(3) :
        username.startsWith('@') ? username.substring(1) : username;

    const profile = await getProfileByUsername(cleanUsername);

    if (!profile) {
        notFound();
    }

    const userLists = await getPublicListsByUserId(profile.id);
    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    // Fetch current user's profile to get their own username (for the dashboard props)
    let currentUsername = null;
    let currentDisplayName = null;
    let isFollowingProfile = false;

    if (currentUser) {
        const { data: currentProfile } = await supabase
            .from('profiles')
            .select('username, display_name')
            .eq('id', currentUser.id)
            .single();
        currentUsername = currentProfile?.username || null;
        currentDisplayName = currentProfile?.display_name || null;

        // Check follow status (wrapped in try/catch in case follows table doesn't exist yet)
        try {
            isFollowingProfile = await isFollowing(profile.id);
        } catch (e) {
            console.error('Failed to check follow status:', e);
        }
    }
    const respondedListIds = currentUser ? await getUserResponseIds(currentUser.id) : [];

    return (
        <>
            <Header />
            <main className="container px-4 mx-auto max-w-7xl pb-24 min-h-[calc(100vh-4rem)]">
                <div className="flex flex-col gap-8 py-8 px-4 max-w-[1600px] mx-auto">
                    <ProfileHeader
                        profile={profile}
                        currentUserId={currentUser?.id || null}
                        isFollowingProfile={isFollowingProfile}
                    />
                    <Dashboard
                        initialLists={userLists}
                        currentUserId={currentUser?.id || null}
                        currentUsername={currentUsername}
                        currentDisplayName={currentDisplayName}
                        respondedListIds={respondedListIds}
                    />
                </div>
            </main>
        </>
    );
}
