'use client'

import { resetPassword } from '@/app/login/actions'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import Link from "next/link"
import { Outfit } from "next/font/google";
import { useState } from 'react'

const outfit = Outfit({ subsets: ["latin"] });

export default function ForgotPasswordPage() {
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleResetPassword = async (formData: FormData) => {
        setIsSubmitting(true)
        const result = await resetPassword(formData)
        setIsSubmitting(false)

        if (result?.error) {
            toast.error(result.error)
        } else {
            toast.success("Check your email for the reset link")
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-black/90">
            {/* Background Dashboard - Same as login but easier to just use a static bg for this simple page */}
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1614149162883-504ce4d13909?q=80&w=2574&auto=format&fit=crop')] bg-cover bg-center opacity-10 blur-xl pointer-events-none"></div>

            <Card className="w-full max-w-md bg-white/90 dark:bg-black/80 backdrop-blur-md shadow-2xl border-slate-200 dark:border-white/10 relative z-10">
                <CardHeader className="text-center space-y-2 pb-6">
                    <CardTitle className={`text-3xl font-black uppercase tracking-tighter ${outfit.className}`}>
                        Recover Account
                    </CardTitle>
                    <CardDescription className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        Enter your email to receive a password reset link.
                    </CardDescription>
                </CardHeader>
                <form action={handleResetPassword}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="uppercase text-xs font-bold tracking-widest text-slate-500">Email</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="m@example.com"
                                required
                                className="bg-white dark:bg-black font-medium"
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-3 pt-2">
                        <Button disabled={isSubmitting} className="w-full font-bold uppercase tracking-widest h-11 text-xs">
                            {isSubmitting ? "Sending..." : "Send Reset Link"}
                        </Button>
                        <Link href="/login" className="w-full">
                            <Button variant="ghost" type="button" className="w-full font-bold uppercase tracking-widest text-xs text-slate-500 hover:text-black dark:hover:text-white">
                                Back to Login
                            </Button>
                        </Link>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
