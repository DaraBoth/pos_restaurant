'use client';
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { UserSession } from '@/lib/tauri-commands';
import { normalizeRole } from '@/lib/permissions';
import { useLanguage } from '@/providers/LanguageProvider';

export const SESSION_TIMEOUT_KEY = 'dineos.session.timeout';
// Default: a full shift. Cashiers must not be logged out mid-shift.
export const DEFAULT_SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000;
const IDLE_WARNING_SECONDS = 30;

// Returns the configured auto-logout timeout in ms. 0 means "Never".
export function getSessionTimeoutMs(): number {
    if (typeof window === 'undefined') return DEFAULT_SESSION_TIMEOUT_MS;
    const raw = window.localStorage.getItem(SESSION_TIMEOUT_KEY);
    if (raw == null) return DEFAULT_SESSION_TIMEOUT_MS;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_SESSION_TIMEOUT_MS;
}

interface AuthContextValue {
    user: UserSession | null;
    setUser: (u: UserSession | null) => void;
    isAuthenticated: boolean;
    loading: boolean;
    // OrderProvider reports whether the cart currently has items so the
    // idle-logout warning can be made stronger when an order is in progress.
    reportActiveOrder: (hasItems: boolean) => void;
    licenseExpiredPending: boolean;
    setLicenseExpiredPending: (v: boolean) => void;
}

const AuthContext = createContext<AuthContextValue>({
    user: null,
    setUser: () => { },
    isAuthenticated: false,
    loading: true,
    reportActiveOrder: () => { },
    licenseExpiredPending: false,
    setLicenseExpiredPending: () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { t } = useLanguage();
    const [user, setUserState] = useState<UserSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [settingsVersion, setSettingsVersion] = useState(0);
    const [showIdleWarning, setShowIdleWarning] = useState(false);
    const [idleCountdown, setIdleCountdown] = useState(IDLE_WARNING_SECONDS);
    const [idleActiveOrder, setIdleActiveOrder] = useState(false);
    const [licenseExpiredPending, setLicenseExpiredPending] = useState(false);

    const lastActivityRef = useRef<number>(0);
    const activeOrderRef = useRef<boolean>(false);

    const reportActiveOrder = useCallback((hasItems: boolean) => {
        activeOrderRef.current = hasItems;
    }, []);

    // Initial load + absolute session-age check (logged_in_at).
    React.useEffect(() => {
        // Drop an over-age session (absolute timeout) before restoring it.
        try {
            const raw = localStorage.getItem('dineos_session');
            if (raw) {
                const prev = JSON.parse(raw) as { logged_in_at?: number };
                const tm = getSessionTimeoutMs();
                if (tm > 0 && typeof prev.logged_in_at === 'number' && (Date.now() - prev.logged_in_at) > tm) {
                    localStorage.removeItem('dineos_session');
                }
            }
        } catch { /* ignore malformed prior session */ }

        const saved = localStorage.getItem('dineos_session');
        if (saved) {
            try {
                const parsed = JSON.parse(saved) as UserSession;
                setUserState({ ...parsed, role: normalizeRole(parsed.role) });
            } catch (e) {
                console.error('Failed to parse saved session', e);
                localStorage.removeItem('dineos_session');
            }
        }
        setLoading(false);
    }, []);

    const setUser = useCallback((u: UserSession | null) => {
        const normalized = u ? { ...u, role: normalizeRole(u.role) } : null;
        setUserState(normalized);
        if (normalized) {
            // Preserve logged_in_at across profile updates; reset only on a new login.
            let loggedInAt = Date.now();
            try {
                const prev = JSON.parse(localStorage.getItem('dineos_session') || 'null');
                if (prev && prev.id === normalized.id && typeof prev.logged_in_at === 'number') {
                    loggedInAt = prev.logged_in_at;
                }
            } catch { /* ignore malformed prior session */ }
            lastActivityRef.current = Date.now();
            localStorage.setItem('dineos_session', JSON.stringify({ ...normalized, logged_in_at: loggedInAt }));
        } else {
            localStorage.removeItem('dineos_session');
        }
        setShowIdleWarning(false);
    }, []);

    // React to the admin changing the auto-logout setting at runtime.
    useEffect(() => {
        function onChange() { setSettingsVersion(v => v + 1); }
        window.addEventListener('session-timeout-changed', onChange);
        return () => window.removeEventListener('session-timeout-changed', onChange);
    }, []);

    // Idle detection: warn 30s before, count down, then auto-logout.
    useEffect(() => {
        const timeoutMs = getSessionTimeoutMs();
        if (!user || timeoutMs <= 0) return;

        lastActivityRef.current = Date.now();
        const onActivity = () => {
            lastActivityRef.current = Date.now();
            setShowIdleWarning(prev => (prev ? false : prev));
        };
        const events: (keyof DocumentEventMap)[] = ['mousedown', 'keydown', 'touchstart', 'click', 'scroll'];
        events.forEach(ev => document.addEventListener(ev, onActivity, { passive: true }));

        const warnMs = IDLE_WARNING_SECONDS * 1000;
        const interval = window.setInterval(() => {
            const idle = Date.now() - lastActivityRef.current;
            if (idle >= timeoutMs) {
                setShowIdleWarning(false);
                setUser(null); // RouteGuard redirects to /login when user becomes null
            } else if (idle >= timeoutMs - warnMs) {
                setIdleActiveOrder(activeOrderRef.current);
                setIdleCountdown(Math.max(0, Math.ceil((timeoutMs - idle) / 1000)));
                setShowIdleWarning(true);
            }
        }, 1000);

        return () => {
            events.forEach(ev => document.removeEventListener(ev, onActivity));
            window.clearInterval(interval);
        };
    }, [user, settingsVersion, setUser]);

    const dismissIdle = useCallback(() => {
        lastActivityRef.current = Date.now();
        setShowIdleWarning(false);
    }, []);

    return (
        <AuthContext.Provider value={{ user, setUser, isAuthenticated: !!user, loading, reportActiveOrder, licenseExpiredPending, setLicenseExpiredPending }}>
            {children}
            {showIdleWarning && user && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-sm p-6">
                        <h3 className="text-sm font-black text-[var(--foreground)] uppercase tracking-widest mb-3">
                            {t('autoLogout')}
                        </h3>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                            {t('idleWarning')}
                        </p>
                        {idleActiveOrder && (
                            <p className="text-xs text-red-400 font-bold leading-relaxed mt-2">
                                {t('logoutActiveOrderWarning')}
                            </p>
                        )}
                        <p className="text-4xl font-black font-mono text-center text-[var(--accent-blue)] my-5">
                            {idleCountdown}s
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setUser(null)}
                                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--bg-elevated)] transition-colors"
                            >
                                {t('logout')}
                            </button>
                            <button
                                onClick={dismissIdle}
                                className="flex-1 py-2.5 rounded-xl text-xs font-black text-white bg-[var(--accent)] hover:brightness-110 active:scale-95 transition-all"
                            >
                                {t('stayLoggedIn')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
