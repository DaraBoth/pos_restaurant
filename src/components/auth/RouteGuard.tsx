'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { getSetupStatus, triggerSync } from '@/lib/tauri-commands';
import { verifyRestaurantLicense } from '@/lib/api/restaurant';
import { isRestaurantSynced } from '@/lib/api/system';
import type { RestaurantLicenseStatus } from '@/types';
import { AlertTriangle, WifiOff, CloudUpload } from 'lucide-react';

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
    const [initialSyncPending, setInitialSyncPending] = useState(false);
    const [licenseStatus, setLicenseStatus] = useState<RestaurantLicenseStatus | null>(null);
    const initialCheckDone = useRef(false);
    const syncTriggered = useRef(false);
    // Track the PREVIOUS auth state so we only reset the check on real login/logout
    // transitions, NOT on every path change. Resetting on every path change caused a
    // full-screen spinner (checking=true) to appear on every tab/route click.
    const wasAuthenticatedRef = useRef(false);

    useEffect(() => {
        let cancelled = false;

        // Only reset the initial-check gate when auth state actually transitions
        // (false→true on login, true→false on logout). Path changes must be ignored.
        if (isAuthenticated !== wasAuthenticatedRef.current) {
            wasAuthenticatedRef.current = isAuthenticated;
            initialCheckDone.current = false;
        }

        async function checkAccess() {
            // console.log(`[RouteGuard] Checking access for ${pathname}, auth=${isAuthenticated}`);
            if (!isAuthenticated) {
                setLicenseStatus(null);
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
                setLicenseStatus(null);
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
                    const dest = status.needs_restaurant_setup ? SETUP_PATH : '/pos/tables';
                    // console.log(`[RouteGuard] Auth success at login, redirecting to ${dest}`);
                    router.replace(dest);
                    return;
                }
            } catch (err) {
                // console.error(`[RouteGuard] Setup check failed:`, err);
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

    useEffect(() => {
        if (!isAuthenticated || user?.role === 'super_admin' || !user?.restaurant_id) {
            setLicenseStatus(null);
            return;
        }

        const restaurantId = user.restaurant_id;

        let cancelled = false;
        let intervalId: ReturnType<typeof setInterval> | null = null;

        async function checkLicense() {
            if (typeof window !== 'undefined' && !navigator.onLine) {
                return;
            }

            try {
                const status = await verifyRestaurantLicense(restaurantId);
                if (!cancelled) {
                    setLicenseStatus(status);
                }
            } catch {
                if (!cancelled) {
                    setLicenseStatus(prev => prev?.status === 'expired' ? prev : null);
                }
            }
        }

        checkLicense();
        const onOnline = () => checkLicense();
        window.addEventListener('online', onOnline);
        intervalId = setInterval(checkLicense, 60_000);

        return () => {
            cancelled = true;
            if (intervalId) {
                clearInterval(intervalId);
            }
            window.removeEventListener('online', onOnline);
        };
    }, [isAuthenticated, user?.restaurant_id, user?.role]);

    useEffect(() => {
        if (!isAuthenticated || user?.role === 'super_admin' || !user?.restaurant_id) {
            setInitialSyncPending(false);
            return;
        }

        const restaurantId = user.restaurant_id;
        let cancelled = false;

        async function waitForInitialSync() {
            setInitialSyncPending(true);
            const deadline = Date.now() + 60_000;

            while (!cancelled && Date.now() < deadline) {
                try {
                    const ready = await isRestaurantSynced(restaurantId);
                    if (ready) {
                        if (!cancelled) {
                            setInitialSyncPending(false);
                        }
                        return;
                    }
                } catch {
                    if (!cancelled) {
                        setInitialSyncPending(false);
                    }
                    return;
                }

                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            if (!cancelled) {
                setInitialSyncPending(false);
            }
        }

        waitForInitialSync();

        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, user?.restaurant_id, user?.role]);

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

    if (initialSyncPending) {
        return <InitialSyncScreen />;
    }

    if (licenseStatus?.status === 'expired') {
        return <LicenseExpiredScreen status={licenseStatus} />;
    }

    return <>{children}</>;
}

function LicenseExpiredScreen({ status }: { status: RestaurantLicenseStatus }) {
    return (
        <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--bg-dark)' }}>
            <div className="w-full max-w-lg rounded-3xl border border-red-500/25 bg-[#10151d] shadow-2xl p-8 space-y-6 text-center">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                    <AlertTriangle size={28} />
                </div>
                <div className="space-y-2">
                    <h1 className="text-2xl font-black text-white uppercase tracking-wider">License Expired</h1>
                    <p className="text-sm text-[var(--text-secondary)]">
                        {status.restaurant_name || 'This restaurant'} needs a renewed subscription before it can continue while online.
                    </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2 text-left">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-red-300">
                        <AlertTriangle size={14} /> Expiry Details
                    </div>
                    <p className="text-sm text-white">
                        Expiry date: <span className="font-bold">{status.license_expires_at || 'Not set'}</span>
                    </p>
                    <p className="text-sm text-white">
                        Contact service team: <span className="font-bold">{status.license_support_contact || 'Please contact our service team to renew your subscription.'}</span>
                    </p>
                </div>
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-left text-sm text-amber-200 flex gap-3">
                    <WifiOff size={18} className="mt-0.5 flex-shrink-0" />
                    <p>
                        Offline use is still tolerated when no internet is available. Once the app comes online and confirms the license is expired, access is locked until renewal.
                    </p>
                </div>
            </div>
        </div>
    );
}

function InitialSyncScreen() {
    return (
        <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-dark)' }}>
            <div className="text-center max-w-md px-6">
                <div className="mx-auto mb-4 w-16 h-16 rounded-2xl border border-blue-500/30 bg-blue-500/10 flex items-center justify-center text-blue-300">
                    <CloudUpload size={28} />
                </div>
                <h2 className="text-xl font-black text-white uppercase tracking-widest">Syncing Setup Data</h2>
                <p className="text-sm text-[var(--text-secondary)] mt-3">
                    Preparing restaurant data for this device. Please wait a moment before opening POS features.
                </p>
                <div className="w-56 h-2 rounded-full bg-white/10 mx-auto mt-6 overflow-hidden">
                    <div className="h-full bg-blue-400/80 animate-[syncBar_1.6s_ease-in-out_infinite]" style={{ width: '40%' }} />
                </div>
            </div>
        </div>
    );
}