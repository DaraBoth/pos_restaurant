'use client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, LayoutGrid, Settings, History, Globe, TableProperties, ChefHat } from 'lucide-react';
import OfflineIndicator from '../ui/OfflineIndicator';

export default function SidebarNav() {
    const { t, lang, setLang } = useLanguage();
    const { user, setUser } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    function handleLogout() {
        setUser(null);
        router.replace('/login');
    }

    const NavItem = ({
        label, icon: Icon, path
    }: { label: string; icon: React.ElementType; path: string }) => {
        const active = pathname.startsWith(path);
        
        // Match the exact /pos route securely so it doesn't highlight when in /pos/tables
        const isExactMatch = path === '/pos' ? pathname === '/pos' : active;

        return (
            <button
                onClick={() => router.push(path)}
                className={`flex items-center gap-4 w-full px-5 py-3.5 rounded-2xl transition-all group ${isExactMatch
                    ? 'bg-[var(--accent)] text-black shadow-[0_0_20px_rgba(204,255,0,0.25)] font-bold'
                    : 'text-[#8a8a99] hover:text-white hover:bg-white/5 font-medium'
                    }`}
            >
                <div className={`p-2 rounded-xl transition-all ${isExactMatch ? 'bg-black/10' : 'bg-white/5 group-hover:bg-white/10'}`}>
                    <Icon size={20} strokeWidth={isExactMatch ? 2.5 : 2} className={isExactMatch ? 'text-black' : 'group-hover:scale-110 transition-transform'} />
                </div>
                <span className="text-sm tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                    {label}
                </span>
            </button>
        );
    };

    return (
        <aside
            className="w-64 flex-shrink-0 flex flex-col items-start py-8 h-screen sticky top-0 bg-black z-40 border-r border-white/5"
            style={{ boxShadow: '15px 0 40px rgba(0,0,0,0.6)' }}
        >
            {/* Logo */}
            <div className="mb-10 px-8 flex flex-col items-start gap-3 w-full">
                <div className="flex items-center gap-4">
                    <div
                        className="w-11 h-11 rounded-[1.25rem] flex items-center justify-center shadow-lg"
                        style={{ background: 'var(--accent)' }}
                    >
                        <ChefHat size={22} color="#000" strokeWidth={2.5} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xl font-black tracking-tighter text-white leading-none">
                            DineOS
                        </span>
                        <span className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-[0.2em] mt-1 opacity-80">
                            Premium POS
                        </span>
                    </div>
                </div>
            </div>

            {/* Primary Navigation */}
            <nav className="flex flex-col gap-2 w-full px-4 flex-1">
                <NavItem label={t('pos')} icon={LayoutGrid} path="/pos" />
                <NavItem label="Floor Plan" icon={TableProperties} path="/pos/tables" />
                <NavItem label={t('orderHistory')} icon={History} path="/history" />
                {(user?.role === 'admin' || user?.role === 'manager') && (
                    <NavItem label={t('management')} icon={Settings} path="/management" />
                )}
            </nav>

            {/* Footer / Utilities */}
            <div className="flex flex-col items-start gap-4 w-full mt-auto p-5 space-y-2">
                <div className="px-4 w-full">
                    <OfflineIndicator />
                </div>
                
                <div className="w-full flex items-center justify-between px-3 py-2 rounded-2xl bg-white/5 border border-white/5">
                    <button
                        onClick={() => setLang(lang === 'en' ? 'km' : 'en')}
                        className="flex items-center gap-2 text-xs font-bold text-[#8a8a99] transition-all hover:text-white"
                    >
                        <Globe size={14} className="text-[var(--accent)]" />
                        {lang === 'en' ? 'English' : 'ភាសាខ្មែរ'}
                    </button>

                    <button
                        onClick={handleLogout}
                        className="p-2 rounded-xl transition-all hover:bg-red-500/10 text-red-500/80 hover:text-red-400"
                        title={t('logout')}
                    >
                        <LogOut size={18} strokeWidth={2.5} />
                    </button>
                </div>

                <div className="px-4">
                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                        Core System v0.1.0
                    </p>
                </div>
            </div>
        </aside>
    );
}
