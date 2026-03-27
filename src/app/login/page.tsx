'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { login, getSetupStatus } from '@/lib/tauri-commands';
import { triggerSync } from '@/lib/api/system';
import { ArrowRight, Lock, User, Globe, ChefHat, AlertTriangle } from 'lucide-react';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const { setUser } = useAuth();
    const { t, lang, setLang } = useLanguage();
    const router = useRouter();

    const handleOpenSupport = async () => {
        try {
            const { open } = await import('@tauri-apps/plugin-shell');
            await open('https://t.me/l3oth');
        } catch (e) {
            window.open('https://t.me/l3oth', '_blank');
        }
    };

    useEffect(() => {
        const saved = localStorage.getItem('dineos_remembered_creds');
        if (saved) {
            try {
                const { u, p } = JSON.parse(saved);
                setUsername(u || '');
                setPassword(p || '');
                setRememberMe(true);
            } catch (e) {
                localStorage.removeItem('dineos_remembered_creds');
            }
        }

        import('@tauri-apps/api/core').then(({ invoke }) => {
            invoke('get_restaurant').catch(() => {/* ignore errors */ });
        }).catch(() => {/* not in Tauri env */ });
    }, []);

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const session = await login(username, password);
            setUser(session);
            if (session.restaurant_id) {
                triggerSync(session.restaurant_id).catch(() => { });
            }
            if (session.role === 'super_admin') {
                router.replace('/super-admin');
                return;
            }
            try {
                const status = await getSetupStatus();
                if (status.needs_restaurant_setup) {
                    router.replace('/setup');
                    return;
                }
            } catch { }
            if (rememberMe) {
                localStorage.setItem('dineos_remembered_creds', JSON.stringify({ u: username, p: password }));
            } else {
                localStorage.removeItem('dineos_remembered_creds');
            }

            router.replace('/pos/tables');
        } catch (err: any) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex font-sans selection:bg-emerald-500/30">
            {/* Left Side: Branding */}
            <div className="hidden lg:flex lg:w-1/2 bg-emerald-600 relative overflow-hidden items-center justify-center border-r border-emerald-500/20">
                {/* Decorative Pattern / Abstract shape */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] border-[2px] border-white rounded-full translate-x-12" />
                    <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] border-[2px] border-white rounded-full -translate-x-12" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] border-[1px] border-white rounded-full scale-150" />
                </div>

                <div className="relative z-10 text-center px-12">
                    <div className="inline-flex items-center justify-center w-32 h-32 rounded-3xl bg-white shadow-2xl mb-8 overflow-hidden p-3">
                        <img src="/logo.png" alt="DineOS Logo" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-6xl font-black text-white tracking-tighter mb-4 italic">
                        Dine<span className="opacity-70">OS</span>
                    </h1>
                    <p className="text-emerald-50 text-xl font-medium max-w-md mx-auto leading-relaxed">
                        {t('businessManagement')}
                    </p>
                </div>
            </div>

            {/* Right Side: Form (DARK) */}
            <div className="w-full lg:w-1/2 bg-[#0a0c10] flex flex-col relative">
                {/* Mobile Identity */}
                <div className="lg:hidden p-8 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white overflow-hidden p-1">
                            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain brightness-0 invert" />
                        </div>
                        <span className="font-black text-xl tracking-tighter uppercase text-white">Dine<span className="text-emerald-600">OS</span></span>
                    </div>
                </div>

                {/* Language Switcher */}
                <div className="absolute top-8 right-8">
                    <button
                        onClick={() => setLang(lang === 'en' ? 'km' : 'en')}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest text-white/50 hover:text-white border border-white/10 hover:border-emerald-500/30 transition-all bg-white/[0.03] hover:bg-white/[0.08] backdrop-blur-md"
                    >
                        <Globe size={14} className={lang === 'en' ? 'text-emerald-400' : 'text-blue-400'} />
                        {lang === 'en' ? 'ភាសាខ្មែរ' : 'English'}
                    </button>
                </div>

                {/* Main Form Area */}
                <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-24 max-w-[640px] mx-auto w-full">
                    <div className="mb-12">
                        <h2 className="text-4xl font-black text-white tracking-tight mb-3">Sign In</h2>
                        <p className="text-white/25 text-sm font-medium tracking-tight mt-3 max-w-md">
                            {t('firstLoginDesc')}
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-8">
                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-white/20 uppercase ml-1">
                                {t('username')}
                            </label>
                            <div className="relative group">
                                <User size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-emerald-400 transition-colors" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    required
                                    className="w-full bg-white/[0.02] border border-white/10 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5 rounded-2xl pl-12 pr-4 py-3 text-base text-white placeholder:text-white/10 outline-none transition-all font-medium"
                                    placeholder="Enter username"
                                    autoComplete="username"
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-white/20 uppercase ml-1">
                                {t('password')}
                            </label>
                            <div className="relative group">
                                <Lock size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-emerald-400 transition-colors" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    className="w-full bg-white/[0.02] border border-white/10 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5 rounded-2xl pl-12 pr-4 py-3 text-base text-white placeholder:text-white/10 outline-none transition-all font-medium"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between px-1">
                            <label className="flex items-center gap-3 cursor-pointer group/check">
                                <div className="relative flex items-center justify-center">
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={e => setRememberMe(e.target.checked)}
                                        className="peer sr-only"
                                    />
                                    <div className="w-5 h-5 rounded-md border-2 border-white/10 bg-white/5 peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-all group-hover/check:border-emerald-500/50" />
                                    <svg
                                        className="absolute w-3.5 h-3.5 text-white scale-0 peer-checked:scale-100 transition-transform pointer-events-none"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    >
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                </div>
                                <span className="text-[11px] font-black text-white/40 uppercase tracking-widest group-hover/check:text-white/60 transition-colors">
                                    Remember Me
                                </span>
                            </label>

                            <span 
                                onClick={handleOpenSupport}
                                className="text-[11px] font-black text-emerald-500/50 uppercase tracking-widest hover:text-emerald-500 cursor-pointer transition-colors"
                            >
                                Forgot Password?
                            </span>
                        </div>

                        {error && (
                            <div className="bg-red-500/5 border border-red-500/20 text-red-400 p-5 rounded-2xl text-[13px] font-bold flex items-center gap-4 animate-in shake duration-500">
                                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                                    <AlertTriangle size={18} />
                                </div>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="relative group w-full py-3 text-lg font-black uppercase tracking-widest text-white overflow-hidden rounded-2xl transition-all active:scale-[0.98] disabled:opacity-50 mt-4 shadow-xl shadow-emerald-500/10"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-emerald-500 transition-all group-hover:scale-105" />
                            <div className="relative flex items-center justify-center gap-3">
                                {loading ? (
                                    <div className="w-6 h-6 border-3 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        {t('login')}
                                        <ArrowRight size={22} className="opacity-70 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </div>
                        </button>
                    </form>

                    <div className="mt-12 text-center">
                        <p className="text-white/20 text-sm font-medium">
                            Need help? <span 
                                onClick={handleOpenSupport}
                                className="text-emerald-500 font-bold hover:underline cursor-pointer"
                            >
                                Contact Support
                            </span>
                        </p>
                    </div>
                </div>

                <div className="p-8 text-center text-white/10 text-[10px] font-bold uppercase tracking-[0.3em] mt-auto">
                    &copy; 2026 &bull; Copy right by DineOS System
                </div>
            </div>
        </div>
    );
}
