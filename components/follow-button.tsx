'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus, UserMinus, Loader2 } from 'lucide-react';
import { followUser, unfollowUser } from '@/app/actions';
import { toast } from 'sonner';

interface FollowButtonProps {
    targetUserId: string;
    targetDisplayName?: string;
    initialIsFollowing: boolean;
    size?: 'sm' | 'default' | 'lg' | 'icon';
    className?: string;
}

export function FollowButton({ targetUserId, targetDisplayName, initialIsFollowing, size = 'sm', className = '' }: FollowButtonProps) {
    const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
    const [loading, setLoading] = useState(false);

    const handleToggle = async (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setLoading(true);

        if (isFollowing) {
            setIsFollowing(false); // Optimistic
            const result = await unfollowUser(targetUserId);
            if (result.error) {
                setIsFollowing(true); // Revert
                toast.error(result.error);
            } else {
                toast.success(`Unfollowed ${targetDisplayName || 'user'}`);
            }
        } else {
            setIsFollowing(true); // Optimistic
            const result = await followUser(targetUserId);
            if (result.error) {
                setIsFollowing(false); // Revert
                toast.error(result.error);
            } else {
                toast.success(`Following ${targetDisplayName || 'user'}`);
            }
        }

        setLoading(false);
    };

    return (
        <Button
            variant={isFollowing ? 'outline' : 'default'}
            size={size}
            onClick={handleToggle}
            disabled={loading}
            className={`font-black tracking-widest uppercase text-[10px] transition-all ${isFollowing
                    ? 'border-slate-300 text-slate-500 hover:border-red-300 hover:text-red-500 hover:bg-red-50'
                    : 'bg-black text-white hover:bg-slate-800'
                } ${className}`}
        >
            {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
            ) : isFollowing ? (
                <>
                    <UserMinus className="h-3 w-3 mr-1" />
                    Following
                </>
            ) : (
                <>
                    <UserPlus className="h-3 w-3 mr-1" />
                    Follow
                </>
            )}
        </Button>
    );
}
