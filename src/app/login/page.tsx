'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { login, getSetupStatus, triggerSync } from '@/lib/tauri-commands';
import { ArrowRight, Lock, User, Globe, ChefHat, AlertTriangle } from 'lucide-react';

export default function LoginPage() {
    const [username, setUsername] = useState('admin');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { setUser } = useAuth();
    const { t, lang, setLang } = useLanguage();
    const router = useRouter();

    // Pre-warm Tauri IPC bridge and SQLite pool as soon as login page mounts.
    // This runs in the background while the user types their credentials,
    // so subsequent pages (floor plan, kitchen) don't face the cold-start delay.
    useEffect(() => {
        import('@tauri-apps/api/core').then(({ invoke }) => {
            invoke('get_restaurant').catch(() => {/* ignore errors */});
        }).catch(() => {/* not in Tauri env */});
    }, []);

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const session = await login(username, password);
            setUser(session);

            // Start per-restaurant cloud sync daemon in background (non-blocking)
            if (session.restaurant_id) {
                triggerSync(session.restaurant_id).catch(() => {/* offline — ignore */});
            }

            // Super admin goes to their own console
            if (session.role === 'super_admin') {
                router.replace('/super-admin');
                return;
            }

            // Check if restaurant setup is needed (first install)
            try {
                const status = await getSetupStatus();
                if (status.needs_restaurant_setup) {
                    router.replace('/setup');
                    return;
                }
            } catch {
                // If check fails, proceed to tables
            }
            router.replace('/pos/tables');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-[var(--background)]">
            
            {/* Language toggle */}
            <button
                onClick={() => setLang(lang === 'en' ? 'km' : 'en')}
                className="absolute top-4 right-4 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all z-10 bg-[var(--bg-card)] border border-[var(--border)] hover:bg-[var(--bg-elevated)]"
            >
                <Globe size={14} className="text-[var(--accent-blue)]"/>
                {lang === 'en' ? 'ភាសាខ្មែរ' : 'English'}
            </button>

            {/* Main Login Container */}
            <div className="relative z-10 w-full max-w-sm mx-auto px-4 animate-fade-in">
                
                {/* Logo & Headline */}
                <div className="flex flex-col items-center mb-8">
                    <div className="relative mb-5">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-[var(--accent)] shadow-lg shadow-[var(--accent)]/20">
                            <ChefHat size={28} color="#fff" strokeWidth={2} />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">DineOS</h1>
                    <p className="text-xs mt-1.5 font-medium text-[var(--text-secondary)]">
                        {t('restaurantManagement')}
                    </p>
                </div>

                {/* Login Card */}
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 shadow-2xl">
                    <form onSubmit={handleLogin} className="space-y-4">
                        {/* Username */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                                {t('username')}
                            </label>
                            <div className="relative">
                                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    required
                                    className="pos-input w-full pl-10 pr-4 py-2.5 text-sm"
                                    placeholder="admin"
                                    autoComplete="username"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                                {t('password')}
                            </label>
                            <div className="relative">
                                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    className="pos-input w-full pl-10 pr-4 py-2.5 text-sm"
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-xl px-3 py-2.5 text-xs font-medium flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400">
                                <AlertTriangle size={13} strokeWidth={2.5} /> {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="pos-btn-primary w-full py-3 text-sm mt-1 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    {t('loading')}
                                </div>
                            ) : (
                                <>
                                    {t('login')}
                                    <ArrowRight size={14} />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
