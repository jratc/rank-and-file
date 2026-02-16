'use client'

import { updatePassword } from '@/app/login/actions'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Outfit } from "next/font/google";
import { useState } from 'react'

const outfit = Outfit({ subsets: ["latin"] });

export default function ResetPasswordPage() {
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleUpdatePassword = async (formData: FormData) => {
        setIsSubmitting(true)
        const result = await updatePassword(formData)
        setIsSubmitting(false)

        if (result?.error) {
            toast.error(result.error)
        } else {
            toast.success("Password updated successfully")
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-black/90">
            {/* Background Dashboard - Static bg for simple page */}
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1614149162883-504ce4d13909?q=80&w=2574&auto=format&fit=crop')] bg-cover bg-center opacity-10 blur-xl pointer-events-none"></div>

            <Card className="w-full max-w-md bg-white/90 dark:bg-black/80 backdrop-blur-md shadow-2xl border-slate-200 dark:border-white/10 relative z-10">
                <CardHeader className="text-center space-y-2 pb-6">
                    <CardTitle className={`text-3xl font-black uppercase tracking-tighter ${outfit.className}`}>
                        Reset Password
                    </CardTitle>
                    <CardDescription className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        Enter your new password below.
                    </CardDescription>
                </CardHeader>
                <form action={handleUpdatePassword}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password" className="uppercase text-xs font-bold tracking-widest text-slate-500">New Password</Label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className="bg-white dark:bg-black font-medium"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="uppercase text-xs font-bold tracking-widest text-slate-500">Confirm Password</Label>
                            <Input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                required
                                className="bg-white dark:bg-black font-medium"
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-3 pt-2">
                        <Button disabled={isSubmitting} className="w-full font-bold uppercase tracking-widest h-11 text-xs">
                            {isSubmitting ? "Updating..." : "Update Password"}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
