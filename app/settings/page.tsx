import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { updateProfile } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    return (
        <>
            <Header />
            <main className="container px-4 mx-auto max-w-2xl py-12">
                <Card className="border-none shadow-none bg-transparent">
                    <CardHeader className="px-0">
                        <CardTitle className="text-4xl font-black tracking-tighter uppercase mb-2">
                            Settings
                        </CardTitle>
                        <p className="text-slate-400 font-medium">Customize your public profile</p>
                    </CardHeader>
                    <CardContent className="px-0 pt-6">
                        <form action={updateProfile} className="space-y-8">
                            <div className="space-y-2">
                                <Label htmlFor="username" className="text-[10px] font-black tracking-widest uppercase text-slate-400">Username</Label>
                                <Input
                                    id="username"
                                    disabled
                                    value={`@${profile?.username}`}
                                    className="bg-slate-50 border-none font-bold"
                                />
                                <p className="text-[10px] text-slate-300 font-mono uppercase">Usernames cannot be changed yet.</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="displayName" className="text-[10px] font-black tracking-widest uppercase text-slate-400">Display Name</Label>
                                <Input
                                    id="displayName"
                                    name="displayName"
                                    defaultValue={profile?.display_name || ''}
                                    placeholder="Enter your public name"
                                    className="border-slate-200 focus:border-black focus:ring- black font-bold"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="bio" className="text-[10px] font-black tracking-widest uppercase text-slate-400">Bio</Label>
                                <Textarea
                                    id="bio"
                                    name="bio"
                                    defaultValue={profile?.bio || ''}
                                    placeholder="Tell the world about your taste..."
                                    className="border-slate-200 focus:border-black focus:ring-black min-h-[120px]"
                                />
                            </div>

                            <Button type="submit" className="w-full bg-black text-white hover:bg-slate-800 font-black tracking-widest uppercase h-12">
                                SAVE CHANGES
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </main>
        </>
    );
}
