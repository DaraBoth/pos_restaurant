'use client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, LayoutGrid, Settings, History, Globe, TableProperties, ChefHat } from 'lucide-react';
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
            className={`flex items-center gap-4 w-full px-5 py-3.5 rounded-2xl transition-all group active:scale-95 ${isExactMatch
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
        </Link>
    );
};

export default function SidebarNav() {
    const { t, lang, setLang } = useLanguage();
    const { user, setUser } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    function handleLogout() {
        setUser(null);
        router.replace('/login');
    }

    return (
        <aside
            className="w-64 flex-shrink-0 flex flex-col items-start py-8 h-screen sticky top-0 bg-[var(--background)] z-40 border-r border-[var(--border)]"
            style={{ boxShadow: '15px 0 40px rgba(249,115,22,0.05)' }}
        >
            {/* Logo */}
            <div className="mb-10 px-8 flex flex-col items-start gap-3 w-full">
                <div className="flex items-center gap-4">
                    <div
                        className="w-11 h-11 rounded-[1.25rem] flex items-center justify-center shadow-lg"
                        style={{ background: 'var(--accent)' }}
                    >
                        <ChefHat size={22} color="#fff" strokeWidth={2.5} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xl font-black tracking-tighter text-[var(--foreground)] leading-none">
                            DineOS
                        </span>
                        <span className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-[0.2em] mt-1 opacity-80">
                            Summer Edition
                        </span>
                    </div>
                </div>
            </div>

            {/* Primary Navigation */}
            <nav className="flex flex-col gap-2 w-full px-4 flex-1">
                <NavItem label={t('pos')} icon={LayoutGrid} path="/pos" pathname={pathname} />
                <NavItem label="Floor Plan" icon={TableProperties} path="/pos/tables" pathname={pathname} />
                <NavItem label={t('orderHistory')} icon={History} path="/history" pathname={pathname} />
                {(user?.role === 'admin' || user?.role === 'manager') && (
                    <NavItem label={t('management')} icon={Settings} path="/management" pathname={pathname} />
                )}
            </nav>

            {/* Footer / Utilities */}
            <div className="flex flex-col items-start gap-4 w-full mt-auto p-5 space-y-2">
                <div className="px-4 w-full">
                    <OfflineIndicator />
                </div>
                
                <div className="w-full flex items-center justify-between px-3 py-2 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)]">
                    <button
                        onClick={() => setLang(lang === 'en' ? 'km' : 'en')}
                        className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)] transition-all hover:text-[var(--foreground)]"
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
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-40">
                        Summer v1.0.0
                    </p>
                </div>
            </div>
        </aside>
    );
}
