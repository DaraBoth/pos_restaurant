'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { login } from '@/lib/tauri-commands';
import { ArrowRight, Lock, User, Globe, ChefHat } from 'lucide-react';

export default function LoginPage() {
    const [username, setUsername] = useState('admin');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { setUser } = useAuth();
    const { t, lang, setLang } = useLanguage();
    const router = useRouter();

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const session = await login(username, password);
            setUser(session);
            router.replace('/pos');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-[#0f1115]">
            
            {/* Language toggle */}
            <button
                onClick={() => setLang(lang === 'en' ? 'km' : 'en')}
                className="absolute top-6 right-6 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all z-10 bg-[#181a20] border border-white/5 hover:bg-white/5"
            >
                <Globe size={16} className="text-[var(--accent)]"/>
                {lang === 'en' ? 'ភាសាខ្មែរ' : 'English'}
            </button>

            {/* Main Login Container */}
            <div className="relative z-10 w-full max-w-sm mx-auto px-4 animate-fade-in">
                
                {/* Logo & Headline */}
                <div className="flex flex-col items-center mb-10">
                    <div className="relative mb-6">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-[var(--accent)] shadow-lg shadow-[var(--accent)]/20">
                            <ChefHat size={32} color="#fff" strokeWidth={2} />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">
                        DineOS
                    </h1>
                    <div className="mt-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-widest font-bold text-[var(--accent)]">
                        v0.1.0-cloud-test
                    </div>
                    <p className="text-sm mt-2 font-medium text-[var(--text-secondary)]">
                        Sign in to your dashboard
                    </p>
                </div>

                {/* Login Card */}
                <div className="bg-[#181a20] border border-white/10 rounded-2xl p-8 shadow-2xl">
                    <form onSubmit={handleLogin} className="space-y-6">
                        {/* Username */}
                        <div className="space-y-2">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                                {t('username')}
                            </label>
                            <div className="relative">
                                <User
                                    size={18}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
                                />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    required
                                    className="input-bento w-full pl-12 pr-4 py-3 text-sm font-medium"
                                    placeholder="admin"
                                    autoComplete="username"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-2">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                                {t('password')}
                            </label>
                            <div className="relative">
                                <Lock
                                    size={18}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
                                />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    className="input-bento w-full pl-12 pr-4 py-3 text-sm font-medium"
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                />
                            </div>
                        </div>

                        {/* Error Bubble */}
                        {error && (
                            <div className="rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400">
                                <span>⚠</span> {error}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full py-3.5 text-sm mt-2 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    {t('loading')}
                                </div>
                            ) : (
                                <>
                                    {t('login')}
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Bottom Footer Hint */}
                <div className="mt-8 text-center space-y-2">
                    <p className="text-xs font-medium text-[var(--text-secondary)]">
                        Default Credentials
                    </p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/5 bg-[#181a20]">
                        <span className="font-mono text-xs font-semibold text-white">admin</span>
                        <span className="text-[var(--text-secondary)]">/</span>
                        <span className="font-mono text-xs font-semibold text-[var(--accent)]">admin123</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
