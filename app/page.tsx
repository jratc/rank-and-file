import { Dashboard } from "@/components/dashboard";
import { Header } from "@/components/header";
import { Tagline } from "@/components/tagline";
import { FeedbackHole } from "@/components/feedback-hole";
import { getLists, getUserResponseIds } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { Outfit } from "next/font/google";

const outfit = Outfit({ subsets: ["latin"] });

export default async function Home() {
  const allLists = await getLists();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const IS_AUTH_DISABLED = true; // Match actions.ts toggle
  const MOCK_USER = {
    id: '00000000-0000-0000-0000-000000000000',
    email: 'jim@example.com',
    user_metadata: { display_name: 'Jim' }
  };

  let activeUser = user;
  if (!user && IS_AUTH_DISABLED) {
    activeUser = MOCK_USER as any;
  }

  let username = null;
  let displayName = null;
  if (activeUser) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, display_name')
      .eq('id', activeUser.id)
      .single();
    username = profile?.username || null;
    displayName = profile?.display_name || 'Jim';
  }
  const respondedListIds = activeUser ? await getUserResponseIds(activeUser.id) : [];

  return (
    <>
      <Header />
      <main className="container px-4 mx-auto max-w-7xl pb-24 min-h-[calc(100vh-4rem)]">
        <div className="flex flex-col gap-12 py-8 px-4 max-w-[1600px] mx-auto">
          <section className="flex flex-col items-center text-center gap-6 max-w-4xl mx-auto mb-16 group relative">
            <div className="flex items-center gap-12">
              <h1 className="text-7xl font-black tracking-tighter sm:text-8xl text-black dark:text-white opacity-20 group-hover:opacity-100 transition-opacity duration-[3000ms] ease-in-out uppercase leading-[0.8] cursor-default">
                Rank and File
              </h1>
              <FeedbackHole />
            </div>
            <h2 className={`text-lg md:text-xl text-slate-500 mb-12 max-w-3xl mx-auto ${outfit.className} font-bold tracking-tight mt-[-20px]`}>
              Opinionated lists for music, movies, and everything else.
              <Tagline />
            </h2>
          </section>

          <Dashboard
            initialLists={allLists}
            currentUserId={activeUser?.id || null}
            currentUsername={username || 'jim'}
            currentDisplayName={displayName || 'Jim'}
            respondedListIds={respondedListIds}
          />
        </div>
      </main>
    </>
  );
}
