'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, LayoutGrid, Settings, History, Globe, TableProperties, ChefHat } from 'lucide-react';
import { getRestaurant, Restaurant } from '@/lib/tauri-commands';
import Link from 'next/link';
import OfflineIndicator from '../ui/OfflineIndicator';

const NavItem = ({
    label, icon: Icon, path, pathname
}: { label: string; icon: React.ElementType; path: string; pathname: string }) => {
    const active = pathname.startsWith(path);
    const isExactMatch = path === '/pos' ? pathname === '/pos' : active;

    return (
        <Link
            href={path}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all group active:scale-95 border ${isExactMatch
                ? 'bg-[var(--accent-blue)]/18 text-white border-[var(--accent-blue)]/50 shadow-lg shadow-[var(--accent-blue)]/20 font-bold'
                : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--foreground)] hover:bg-[var(--bg-dark)] font-medium'
                }`}
        >
            <div className={`p-1.5 rounded-lg transition-all ${isExactMatch ? 'bg-white/20' : 'bg-[#0d1721] group-hover:bg-[var(--bg-elevated)] border border-[var(--border)]'}`}>
                <Icon size={18} strokeWidth={isExactMatch ? 2.5 : 2} className={isExactMatch ? 'text-white' : 'group-hover:scale-110 transition-transform'} />
            </div>
            <span className="text-[var(--text-sm)] tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                {label}
            </span>
        </Link>
    );
};

export default function SidebarNav() {
    const { t, lang, setLang } = useLanguage();
    const { user, setUser } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);

    useEffect(() => {
        getRestaurant().then(setRestaurant).catch(console.error);
    }, []);

    function handleLogout() {
        setUser(null);
        router.replace('/login');
    }

    return (
        <aside
            className="w-[clamp(14.5rem,19vw,17rem)] flex-shrink-0 flex flex-col items-start py-6 h-screen sticky top-0 bg-[#0a1118] z-40 border-r border-[var(--border)]"
            style={{ boxShadow: '1px 0 28px rgba(2, 6, 23, 0.55)' }}
        >
            {/* Logo */}
            <div className="mb-8 px-4 flex flex-col items-start gap-3 w-full">
                <div className="flex items-center gap-4">
                    <div
                        className="w-11 h-11 rounded-[1rem] flex items-center justify-center shadow-lg overflow-hidden border border-[var(--border)]"
                        style={{ background: 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)' }}
                    >
                        {restaurant?.logo_path ? (
                            <img 
                                src={`https://asset.localhost/${restaurant.logo_path}`} 
                                alt="Logo" 
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <ChefHat size={22} color="#fff" strokeWidth={2.5} />
                        )}
                    </div>
                    <div className="hidden lg:flex flex-col min-w-0">
                        <h1 className="text-lg font-black text-[var(--foreground)] tracking-tight truncate leading-tight">
                            {restaurant?.name || 'DineOS'}
                        </h1>
                        <div className="flex items-center gap-1.5 opacity-60">
                            <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Live POS</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Primary Navigation */}
            <div className="px-4 mb-2">
                <p className="pos-label">Operations</p>
            </div>
            <nav className="flex flex-col gap-1 w-full px-3 flex-1">
                <NavItem label={t('pos')} icon={LayoutGrid} path="/pos" pathname={pathname} />
                <NavItem label="Floor Plan" icon={TableProperties} path="/pos/tables" pathname={pathname} />
                <NavItem label={t('orderHistory')} icon={History} path="/history" pathname={pathname} />
                {(user?.role === 'admin' || user?.role === 'manager') && (
                    <NavItem label={t('management')} icon={Settings} path="/management" pathname={pathname} />
                )}
            </nav>

            {/* Footer / Utilities */}
            <div className="flex flex-col items-start gap-4 w-full mt-auto p-4 space-y-2">
                <div className="px-4 w-full">
                    <OfflineIndicator />
                </div>
                
                <div className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)]">
                    <button
                        onClick={() => setLang(lang === 'en' ? 'km' : 'en')}
                        className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)] transition-all hover:text-[var(--foreground)]"
                    >
                        <Globe size={14} className="text-[var(--accent-blue)]" />
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
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-40">
                        DineOS v1.0.0
                    </p>
                </div>
            </div>
        </aside>
    );
}
