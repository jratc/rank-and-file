'use client';

import { useState, useRef, useCallback } from 'react';
import { Outfit } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'] });

const WORDS = [
    { text: 'Rank.', color: 'rgb(37, 99, 235)' },     // blue-600
    { text: 'Respond.', color: 'rgb(147, 51, 234)' },  // purple-600
    { text: 'Provoke.', color: 'rgb(234, 88, 12)' },   // orange-600
];

const GREY = 'rgb(203, 213, 225)'; // slate-300
const FADE_DURATION = 3000; // ms per word — matches the title's 3000ms transition

export function Tagline() {
    // Track which words are currently colored (vs grey)
    const [activeWords, setActiveWords] = useState<boolean[]>([false, false, false]);
    // Whether we're mid-cycle (ignore hovers)
    const animatingRef = useRef(false);
    const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

    const clearTimeouts = () => {
        timeoutsRef.current.forEach(clearTimeout);
        timeoutsRef.current = [];
    };

    const handleMouseEnter = useCallback(() => {
        if (animatingRef.current) return;
        animatingRef.current = true;

        // Phase 1: Sequentially fade each word to its color
        WORDS.forEach((_, index) => {
            const t = setTimeout(() => {
                setActiveWords(prev => {
                    const next = [...prev];
                    next[index] = true;
                    return next;
                });
            }, index * FADE_DURATION);
            timeoutsRef.current.push(t);
        });

        // Phase 2: After all three have faded in, wait for last transition to finish,
        // then fade all back to grey simultaneously
        const totalColorTime = WORDS.length * FADE_DURATION; // time until last word starts fading
        const resetDelay = totalColorTime + FADE_DURATION;    // + time for last word's transition to complete

        const resetTimeout = setTimeout(() => {
            setActiveWords([false, false, false]);
            // Allow re-trigger after the grey fade-back completes
            const unlockTimeout = setTimeout(() => {
                animatingRef.current = false;
            }, FADE_DURATION);
            timeoutsRef.current.push(unlockTimeout);
        }, resetDelay);
        timeoutsRef.current.push(resetTimeout);
    }, []);

    return (
        <span
            onMouseEnter={handleMouseEnter}
            className={`block mt-[50px] font-black tracking-tighter text-2xl md:text-3xl uppercase cursor-default ${outfit.className}`}
        >
            {WORDS.map((word, i) => (
                <span
                    key={i}
                    className="inline-block mr-[0.3em] last:mr-0"
                    style={{
                        color: activeWords[i] ? word.color : GREY,
                        transition: `color ${FADE_DURATION}ms ease-in-out`,
                    }}
                >
                    {word.text}
                </span>
            ))}
        </span>
    );
}
