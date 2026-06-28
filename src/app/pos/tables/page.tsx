'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// The floor plan now lives at /pos. This page redirects old bookmarks.
export default function TablesRedirect() {
    const router = useRouter();
    useEffect(() => { router.replace('/pos'); }, [router]);
    return (
        <div className="flex items-center justify-center flex-1 h-screen" style={{ background: 'var(--bg-dark)' }}>
            <div
                className="w-12 h-12 border-4 rounded-full animate-spin"
                style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
            />
        </div>
    );
}