'use client';
import { useAuth } from '@/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated } = useAuth();
    const router = useRouter();

    useEffect(() => {
        // Strict role check for any path within this route group
        if (isAuthenticated && user?.role !== 'super_admin') {
            router.replace('/pos');
        }
    }, [isAuthenticated, user, router]);

    // Prevent rendering children for unauthorized users to avoid layout flash
    if (!isAuthenticated || user?.role !== 'super_admin') {
        return (
            <div className="flex items-center justify-center h-screen bg-[var(--bg-dark)]">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4" 
                         style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
                    <p className="text-[var(--text-secondary)] text-sm uppercase tracking-widest font-bold">Verifying Credentials...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--bg-dark)] text-[var(--foreground)]">
            {children}
        </div>
    );
}
