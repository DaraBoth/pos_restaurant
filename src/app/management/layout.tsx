'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { canAccessAdminConsole } from '@/lib/permissions';

export default function ManagementLayout({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!canAccessAdminConsole(user?.role)) {
            router.replace('/pos');
        }
    }, [router, user?.role]);

    if (!canAccessAdminConsole(user?.role)) {
        return null;
    }

    return (
        <div className="flex-1 flex flex-col overflow-y-auto min-h-0 bg-[var(--bg-dark)]">
            {children}
        </div>
    );
}
