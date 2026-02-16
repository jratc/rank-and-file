import { Dashboard } from "@/components/dashboard";
import { getLists } from "@/app/actions";
import LoginForm from "./login-form";

export default async function LoginPage() {
    const allLists = await getLists();

    return (
        <main className="relative min-h-screen overflow-hidden">
            {/* Background Dashboard - Interactive but blurred/overlayed */}
            <div className="absolute inset-0 z-0 animate-blur-in">
                <div className="container px-4 mx-auto max-w-7xl pb-24 opacity-50 pointer-events-none select-none">
                    <div className="flex flex-col gap-12 py-8 px-4 max-w-[1600px] mx-auto">
                        <section className="flex flex-col items-center text-center gap-6 max-w-4xl mx-auto mb-16 group opacity-0">
                            {/* Placeholder for layout stability */}
                            <h1 className="text-7xl">Rank and File</h1>
                        </section>
                        <Dashboard
                            initialLists={allLists}
                            currentUserId={null}
                            currentUsername={null}
                            currentDisplayName={null}
                        />
                    </div>
                </div>
            </div>

            {/* Login Form Overlay */}
            <div className="relative z-10 flex items-center justify-center min-h-screen bg-black/20 backdrop-blur-sm animate-in fade-in duration-700">
                <LoginForm />
            </div>
        </main>
    );
}
