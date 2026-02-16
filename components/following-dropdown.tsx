'use client';

import { useState, useRef, useEffect } from 'react';
import { Users, ChevronDown } from 'lucide-react';
import Link from 'next/link';

interface FollowedUser {
    id: string;
    username: string;
    display_name: string | null;
}

interface FollowingDropdownProps {
    followedUsers: FollowedUser[];
}

export function FollowingDropdown({ followedUsers }: FollowingDropdownProps) {
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

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

    if (followedUsers.length === 0) return null;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setOpen(!open)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black tracking-widest uppercase border border-slate-200 rounded-lg transition-colors ${open ? 'bg-slate-50 border-slate-300' : 'hover:bg-slate-50'
                    }`}
            >
                <Users className="h-3 w-3" />
                <span className="hidden sm:inline">Following</span>
                <span className="bg-black text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">
                    {followedUsers.length}
                </span>
                <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                    <div className="px-4 pt-3 pb-2">
                        <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">Following</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        {followedUsers.map((user) => (
                            <Link
                                key={user.id}
                                href={`/@${user.username}`}
                                onClick={() => setOpen(false)}
                                className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors group"
                            >
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xs group-hover:bg-black group-hover:text-white transition-colors">
                                    {(user.display_name || user.username)?.[0]?.toUpperCase()}
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-bold text-slate-800 truncate">
                                        {user.display_name || user.username}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-mono">@{user.username}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
