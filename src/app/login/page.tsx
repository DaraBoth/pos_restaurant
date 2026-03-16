'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { login } from '@/lib/tauri-commands';
import { ShoppingBag, Lock, User, Globe } from 'lucide-react';

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
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #0f1117 0%, #13161e 50%, #1a1030 100%)' }}>

            {/* Background decorations */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10"
                    style={{ background: 'radial-gradient(circle, #f59e0b, transparent)' }} />
                <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-10"
                    style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }} />
            </div>

            {/* Language toggle */}
            <button
                onClick={() => setLang(lang === 'en' ? 'km' : 'en')}
                className="absolute top-6 right-6 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all btn-ghost"
            >
                <Globe size={14} />
                {lang === 'en' ? 'ខ្មែរ' : 'English'}
            </button>

            {/* Login card */}
            <div className="glass rounded-2xl p-8 w-full max-w-md relative z-10 animate-slide-up">
                {/* Logo */}
                <div className="flex items-center justify-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                        <ShoppingBag size={24} color="#000" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>KH POS</h1>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Cambodia Restaurant System</p>
                    </div>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                            {t('username')}
                        </label>
                        <div className="relative">
                            <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2"
                                style={{ color: 'var(--text-secondary)' }} />
                            <input
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                required
                                className="input-dark w-full pl-10 pr-4 py-3 rounded-xl text-sm"
                                placeholder="admin"
                                autoComplete="username"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                            {t('password')}
                        </label>
                        <div className="relative">
                            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2"
                                style={{ color: 'var(--text-secondary)' }} />
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                className="input-dark w-full pl-10 pr-4 py-3 rounded-xl text-sm"
                                placeholder="••••••••"
                                autoComplete="current-password"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-xl p-3 text-sm animate-fade-in"
                            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full py-3 rounded-xl text-base flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {loading
                            ? <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> {t('loading')}</>
                            : t('login')
                        }
                    </button>
                </form>

                <p className="text-center text-xs mt-6" style={{ color: 'var(--text-secondary)' }}>
                    Default: <span className="font-mono">admin / admin123</span>
                </p>
            </div>
        </div>
    );
}
