'use client'

import { login, signup } from './actions'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import Link from "next/link"
import { Outfit } from "next/font/google";
import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"

const outfit = Outfit({ subsets: ["latin"] });

export default function LoginForm() {
    const [showPassword, setShowPassword] = useState(false)

    const handleLogin = async (formData: FormData) => {
        const result = await login(formData)
        if (result?.error) {
            toast.error(result.error)
        }
    }

    const handleSignup = async (formData: FormData) => {
        const result = await signup(formData)
        if (result?.error) {
            toast.error(result.error)
        }
    }

    return (
        <Card className="w-full max-w-md bg-white/90 dark:bg-black/90 backdrop-blur-md shadow-2xl border-slate-200 dark:border-white/10">
            <CardHeader className="text-center space-y-2 pb-6">
                <CardTitle className="text-3xl font-black uppercase text-center tracking-tighter text-slate-900">
                    Rank and File
                </CardTitle>
                <CardDescription className="text-center space-y-1">
                    <p className="font-mono text-xs uppercase tracking-widest text-slate-500 font-bold">Welcome to our Ranks</p>
                    <p className="text-slate-400 text-xs">Create a display name to get started</p>
                </CardDescription>
            </CardHeader>
            <form>
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
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="password" className="uppercase text-xs font-bold tracking-widest text-slate-500">Password</Label>
                            <Link
                                href="/forgot-password"
                                className="text-xs font-bold text-slate-400 hover:text-black dark:hover:text-white transition-colors"
                            >
                                Forgot password?
                            </Link>
                        </div>
                        <div className="relative">
                            <Input
                                id="password"
                                name="password"
                                type={showPassword ? "text" : "password"}
                                required
                                className="bg-white dark:bg-black font-medium pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black dark:hover:text-white transition-colors"
                            >
                                {showPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3 pt-2">
                    <Button formAction={handleLogin} className="w-full font-bold uppercase tracking-widest h-11 text-xs">
                        Sign In
                    </Button>
                    <Button formAction={handleSignup} variant="ghost" className="w-full font-bold uppercase tracking-widest text-xs text-slate-500 hover:text-black dark:hover:text-white">
                        Create Account
                    </Button>
                </CardFooter>
            </form>
        </Card>
    )
}
