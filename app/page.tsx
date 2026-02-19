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

  let username = null;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, display_name')
      .eq('id', user.id)
      .single();
    username = profile?.username || null;
    var displayName = profile?.display_name || null;
  }
  const respondedListIds = user ? await getUserResponseIds(user.id) : [];

  return (
    <>
      <Header />
      <main className="container px-4 mx-auto max-w-7xl pb-24 min-h-[calc(100vh-4rem)]">
        <div className="flex flex-col gap-12 py-8 px-4 max-w-[1600px] mx-auto">
          <section className="flex flex-col items-center text-center gap-6 max-w-4xl mx-auto mb-16 group">
            <h1 className="text-7xl font-black tracking-tighter sm:text-8xl text-black dark:text-white opacity-20 hover:opacity-100 transition-opacity duration-[3000ms] ease-in-out uppercase leading-[0.8] mb-4 cursor-default">
              Rank and File
            </h1>
            <h2 className={`text-lg md:text-xl text-slate-500 mb-12 max-w-3xl mx-auto ${outfit.className} font-bold tracking-tight mt-[-20px]`}>
              Opinionated lists for music, movies, and everything else.
              <Tagline />
            </h2>
          </section>

          <Dashboard
            initialLists={allLists}
            currentUserId={user?.id || null}
            currentUsername={username}
            currentDisplayName={displayName}
            respondedListIds={respondedListIds}
          />
        </div>
        <FeedbackHole />
      </main>
    </>
  );
}
