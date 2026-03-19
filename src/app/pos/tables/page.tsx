'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// The floor plan now lives at /pos. This page redirects old bookmarks.
export default function TablesRedirect() {
    const router = useRouter();
    useEffect(() => { router.replace('/pos'); }, [router]);
    return null;
}