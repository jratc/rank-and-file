'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { MessageSquarePlus, Loader2 } from "lucide-react";
import { createResponse } from "@/app/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ResponseBtnProps {
    parentListId: string;
    parentTitle: string;
    onResponseCreated?: (newList: any) => void;
    className?: string;
}

export function ResponseBtn({ parentListId, parentTitle, onResponseCreated, existingResponseId, className }: ResponseBtnProps & { existingResponseId?: string | null }) {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleRespond = async () => {
        setIsLoading(true);
        try {
            if (existingResponseId) {
                // If response exists, just notify parent to open it
                // We mock a list object with the ID so standard flow works
                if (onResponseCreated) {
                    onResponseCreated({ id: existingResponseId, isExisting: true });
                }
                return;
            }

            const newList = await createResponse(parentListId);

            // If the backend returned an existing list (race condition or re-fetch), handle it
            const isExisting = newList.created_at < new Date(Date.now() - 10000).toISOString();

            if (!isExisting) {
                toast.success(`Started response to "${parentTitle}"`);
            } else {
                toast.info(`Opened your existing response`);
            }

            if (onResponseCreated) {
                onResponseCreated(newList);
            } else {
                router.push('/');
            }

        } catch (error) {
            console.error(error);
            toast.error("Failed to create response");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Button
            onClick={handleRespond}
            disabled={isLoading}
            variant={existingResponseId ? "default" : "outline"}
            size="sm"
            className={`h-8 px-4 text-[10px] font-black tracking-widest uppercase rounded-md flex items-center gap-2 shadow-sm transition-all ${existingResponseId ? 'bg-yellow-400 hover:bg-yellow-500 text-black border-yellow-400' : ''} ${className || ''}`}
        >
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquarePlus className="h-3 w-3" />}
            {existingResponseId ? "YOUR RESPONSE" : "RESPOND"}
        </Button>
    );
}
