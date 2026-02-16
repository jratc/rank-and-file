'use client';

import { useState, useRef, useEffect } from 'react';
import { Settings, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface SettingsDropdownProps {
    initialDisplayName: string;
    initialBio: string;
    username: string;
}

export function SettingsDropdown({ initialDisplayName, initialBio, username }: SettingsDropdownProps) {
    const [open, setOpen] = useState(false);
    const [displayName, setDisplayName] = useState(initialDisplayName);
    const [bio, setBio] = useState(initialBio);
    const [saving, setSaving] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        if (open) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    // Close on Escape
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        if (open) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [open]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const formData = new FormData();
            formData.append('displayName', displayName);
            formData.append('bio', bio);

            const { updateProfile } = await import('@/app/settings/actions');
            await updateProfile(formData);

            toast.success('Profile updated!');
            router.refresh();
            setOpen(false);
        } catch (err: any) {
            toast.error(err.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setOpen(!open)}
                className={`p-2 transition-colors ${open ? 'text-black' : 'text-slate-400 hover:text-black'}`}
                title="Settings"
            >
                <Settings className="h-5 w-5" />
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 pt-4 pb-2">
                        <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">Settings</span>
                        <button onClick={() => setOpen(false)} className="text-slate-300 hover:text-slate-600 transition-colors">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="px-4 pb-4 space-y-4">
                        {/* Username (read-only) */}
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black tracking-widest uppercase text-slate-300">Username</Label>
                            <div className="text-sm font-bold text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
                                @{username}
                            </div>
                        </div>

                        {/* Display Name */}
                        <div className="space-y-1">
                            <Label htmlFor="settings-displayName" className="text-[10px] font-black tracking-widest uppercase text-slate-400">
                                Display Name
                            </Label>
                            <Input
                                id="settings-displayName"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Your public name"
                                className="border-slate-200 focus:border-black focus:ring-black font-bold text-sm"
                            />
                        </div>

                        {/* Bio */}
                        <div className="space-y-1">
                            <Label htmlFor="settings-bio" className="text-[10px] font-black tracking-widest uppercase text-slate-400">
                                Bio
                            </Label>
                            <Textarea
                                id="settings-bio"
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                placeholder="Tell the world about your taste..."
                                className="border-slate-200 focus:border-black focus:ring-black min-h-[80px] text-sm"
                            />
                        </div>

                        {/* Save */}
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full bg-black text-white hover:bg-slate-800 font-black tracking-widest uppercase text-[10px] h-10"
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'SAVE CHANGES'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
