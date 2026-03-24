'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { getSetupStatus, triggerSync } from '@/lib/tauri-commands';

const PUBLIC_PATHS = ['/login'];
const SUPER_ADMIN_PATH = '/super-admin';
const SETUP_PATH = '/setup';

export default function RouteGuard({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    // `checking` is only true during the very first auth check (login → session).
    // Once initialised, subsequent tab/route changes never block rendering.
    const [checking, setChecking] = useState(true);
    const initialCheckDone = useRef(false);
    const syncTriggered = useRef(false);

    useEffect(() => {
        let cancelled = false;

        async function checkAccess() {
            if (!isAuthenticated) {
                if (!PUBLIC_PATHS.includes(pathname)) {
                    router.replace('/login');
                }
                if (!cancelled) {
                    setChecking(false);
                    initialCheckDone.current = true;
                }
                return;
            }

            // Super admin bypasses all restaurant checks
            if (user?.role === 'super_admin') {
                if (!pathname.startsWith(SUPER_ADMIN_PATH)) {
                    router.replace(SUPER_ADMIN_PATH);
                    return;
                }
                if (!cancelled) {
                    setChecking(false);
                    initialCheckDone.current = true;
                }
                return;
            }

            // Block super-admin routes for non-super_admin users
            if (pathname.startsWith(SUPER_ADMIN_PATH)) {
                router.replace('/login');
                return;
            }

            // Only call the Tauri setup-status IPC once per auth session.
            // After the first check, navigating between tabs skips the spinner
            // and goes straight to rendering children.
            if (initialCheckDone.current) {
                return;
            }

            try {
                // restaurant_id is now mandatory in the backend commands
                const status = await getSetupStatus(user?.restaurant_id || '');
                if (cancelled) return;

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
                initialCheckDone.current = true;

                // Ensure sync daemon starts for currently logged in restaurant
                if (user?.restaurant_id && !syncTriggered.current) {
                    syncTriggered.current = true;
                    triggerSync(user.restaurant_id).catch(() => { /* offline or no remote */ });
                }
            }
        }

        // Only show the spinner if we haven't completed the first check yet.
        if (!initialCheckDone.current) {
            setChecking(true);
        }
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