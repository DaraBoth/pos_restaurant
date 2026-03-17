'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getSetupStatus } from '@/lib/tauri-commands';

const PUBLIC_PATHS = ['/login'];
const SETUP_PATH = '/setup';

export default function RouteGuard({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated } = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        let cancelled = false;

        async function checkAccess() {
            if (!isAuthenticated) {
                if (!PUBLIC_PATHS.includes(pathname)) {
                    router.replace('/login');
                }
                if (!cancelled) {
                    setChecking(false);
                }
                return;
            }

            try {
                const status = await getSetupStatus();
                if (cancelled) {
                    return;
                }

                if (status.needs_restaurant_setup && pathname !== SETUP_PATH) {
                    router.replace(SETUP_PATH);
                    return;
                }

                if (!status.needs_restaurant_setup && pathname === SETUP_PATH) {
                    router.replace('/pos');
                    return;
                }

                if (pathname === '/login' && user) {
                    router.replace(status.needs_restaurant_setup ? SETUP_PATH : '/pos');
                    return;
                }
            } catch {
                if (!cancelled && pathname !== SETUP_PATH && pathname !== '/login') {
                    router.replace(SETUP_PATH);
                    return;
                }
            }

            if (!cancelled) {
                setChecking(false);
            }
        }

        setChecking(true);
        checkAccess();

        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, pathname, router, user]);

    if (checking) {
        return (
            <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-dark)' }}>
                <div className="text-center">
                    <div
                        className="w-16 h-16 border-4 rounded-full animate-spin mx-auto mb-4"
                        style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
                    />
                    <p style={{ color: 'var(--text-secondary)' }}>Preparing workspace...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}