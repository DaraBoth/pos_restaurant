'use client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOrder } from '@/contexts/OrderContext';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, LayoutGrid, Settings, History, Globe, TableProperties, ChefHat } from 'lucide-react';
import OfflineIndicator from '../ui/OfflineIndicator';

export default function TopNavigation() {
    const { t, lang, setLang } = useLanguage();
    const { user, setUser } = useAuth();
    const { tableId } = useOrder();
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
        return (
            <button
                onClick={() => router.push(path)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${active
                    ? 'nav-active'
                    : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-elevated)]'
                    }`}
            >
                <Icon size={16} />
                {label}
            </button>
        );
    };

    return (
        <header className="fixed top-4 left-0 right-0 z-50 flex justify-center pointer-events-none">
            <div
                className="flex items-center justify-between px-3 py-2 rounded-full pointer-events-auto shadow-2xl transition-all"
                style={{
                    background: 'rgba(18, 18, 22, 0.75)',
                    backdropFilter: 'blur(32px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    width: '95%',
                    maxWidth: '1200px',
                }}
            >
                {/* Left: Logo + Nav */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 pl-2 pr-4 border-r border-white/5">
                        <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: 'var(--accent)' }}
                        >
                            <ChefHat size={18} color="#000" strokeWidth={3} />
                        </div>
                        <span className="text-base font-black tracking-tighter shimmer-text hidden sm:block font-space">
                            KH POS
                        </span>
                    </div>

                    <nav className="flex items-center gap-1.5">
                        <NavItem label={t('pos')} icon={LayoutGrid} path="/pos" />
                        <NavItem label="Tables" icon={TableProperties} path="/pos/tables" />
                        <NavItem label={t('orderHistory')} icon={History} path="/history" />
                        {(user?.role === 'admin' || user?.role === 'manager') && (
                            <NavItem label={t('management')} icon={Settings} path="/management" />
                        )}
                    </nav>
                </div>

                {/* Right: offline status, lang, user */}
                <div className="flex items-center gap-3 pr-2">
                    <OfflineIndicator />

                    {tableId && (
                        <div
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider animate-pulse"
                            style={{
                                background: 'rgba(204, 255, 0, 0.15)',
                                color: 'var(--accent)',
                                border: '1px solid rgba(204, 255, 0, 0.3)',
                            }}
                        >
                            <TableProperties size={12} />
                            {tableId}
                        </div>
                    )}

                    <div className="w-px h-4 bg-white/10" />

                    <button
                        onClick={() => setLang(lang === 'en' ? 'km' : 'en')}
                        className="px-3 py-1.5 rounded-full flex gap-1.5 items-center text-[11px] font-black uppercase transition-colors hover:bg-white/5 hover:text-white text-[#8a8a99]"
                    >
                        <Globe size={14} />
                        {lang === 'en' ? 'KH' : 'EN'}
                    </button>

                    <div className="flex items-center gap-3 pl-3 border-l border-white/10">
                        <div className="text-right hidden sm:block mt-0.5">
                            <p className="text-[13px] font-bold leading-none text-white font-space">
                                {user?.full_name || user?.username}
                            </p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#8a8a99] mt-1">
                                {user?.role}
                            </p>
                        </div>

                        <button
                            onClick={handleLogout}
                            className="w-8 h-8 flex items-center justify-center rounded-full transition-all hover:bg-[var(--accent-red)] hover:text-white hover:scale-105"
                            style={{ color: 'var(--accent-red)' }}
                            title={t('logout')}
                        >
                            <LogOut size={14} strokeWidth={3} />
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}
