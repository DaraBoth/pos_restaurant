'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/providers/LanguageProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, LayoutGrid, Settings, History, Globe, Store, Building2, UtensilsCrossed, ChevronsLeft, ChevronsRight, Sun, Moon } from 'lucide-react';
import { getRestaurant, Restaurant } from '@/lib/tauri-commands';
import { stopSync } from '@/lib/api/system';
import { SyncStatus } from '@/components/ui/SyncStatus';
import { UpdateStatus } from '@/components/ui/UpdateStatus';
import Link from 'next/link';

const NavItem = ({
    label, icon: Icon, path, pathname, collapsed
}: { label: string; icon: React.ElementType; path: string; pathname: string; collapsed: boolean }) => {
    // /pos covers both the floor plan (/pos) and the ordering view (same page, context-driven)
    const active = path === '/pos' ? pathname.startsWith('/pos') : pathname.startsWith(path);
    const isExact = active;

    return (
        <Link
            href={path}
            className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl transition-all group active:scale-95 text-sm ${isExact
                ? 'bg-[var(--accent-blue)]/15 text-[var(--foreground)] border border-[var(--accent-blue)]/40 font-semibold'
                : 'text-[var(--text-secondary)] border border-transparent hover:text-[var(--foreground)] hover:bg-[var(--bg-elevated)] font-medium'
            } ${collapsed ? 'justify-center px-0' : ''}`}
            title={label}
        >
            <Icon size={16} strokeWidth={isExact ? 2.5 : 2} className={isExact ? 'text-[var(--accent-blue)]' : ''} />
            {!collapsed && <span className="truncate">{label}</span>}
        </Link>
    );
};

export default function SidebarNav() {
    const { t, lang, setLang } = useLanguage();
    const { user, setUser } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const router = useRouter();
    const pathname = usePathname();
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        // Re-run whenever user changes to ensure logo/name syncs with active tenant
        getRestaurant(user?.restaurant_id || undefined)
            .then(setRestaurant)
            .catch(console.error);
    }, [user?.restaurant_id]);

    function handleLogout() {
        stopSync().catch(() => {});
        setUser(null);
        router.replace('/login');
    }

    return (
        <aside
            className={`flex-shrink-0 flex flex-col py-3 h-screen sticky top-0 bg-[var(--sidebar-bg)] z-40 border-r border-[var(--border)] transition-all duration-200 ${collapsed ? 'w-14' : 'w-48'}`}
            style={{ boxShadow: '1px 0 20px rgba(2,6,23,0.12)' }}
        >
            {/* Logo + toggle */}
            <div className={`mb-4 flex items-center ${collapsed ? 'justify-center px-0' : 'px-3 gap-2.5'}`}>
                <div className="w-11 h-11 flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {restaurant?.logo_path ? (
                        <img src={restaurant.logo_path} alt="Logo" className="w-full h-full object-cover rounded-2xl" />
                    ) : (
                        <img src="/logo_dark.png" alt="DineOS Logo" className="w-full h-full object-contain" />
                    )}
                </div>
                {!collapsed && (
                    <div className="min-w-0 flex-1">
                        <h1 className="text-sm font-black text-[var(--foreground)] tracking-tight truncate leading-tight">
                            {restaurant?.name || 'DineOS'}
                        </h1>
                        <p className="text-[10px] text-[var(--text-secondary)] truncate">{user?.full_name || user?.username}</p>
                    </div>
                )}
                {!collapsed && (
                    <button
                        onClick={() => setCollapsed(true)}
                        className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--bg-elevated)] transition-colors flex-shrink-0"
                        title="Collapse sidebar"
                    >
                        <ChevronsLeft size={14} />
                    </button>
                )}
            </div>

            {/* Expand button (collapsed state) */}
            {collapsed && (
                <div className="flex justify-center mb-2">
                    <button
                        onClick={() => setCollapsed(false)}
                        className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--bg-elevated)] transition-colors"
                        title="Expand sidebar"
                    >
                        <ChevronsRight size={14} />
                    </button>
                </div>
            )}

            {/* Navigation */}
            <nav className="flex flex-col gap-0.5 w-full px-2 flex-1">
                <NavItem label={t('pos')} icon={LayoutGrid} path="/pos" pathname={pathname} collapsed={collapsed} />
                {false && (user?.role === 'admin' || user?.role === 'chef') && (
                    <NavItem label={t('kitchen')} icon={UtensilsCrossed} path="/pos/kitchen" pathname={pathname} collapsed={collapsed} />
                )}
                <NavItem label={t('history')} icon={History} path="/history" pathname={pathname} collapsed={collapsed} />
                {(user?.role === 'admin' || user?.role === 'manager') && (
                    <NavItem label={t('management')} icon={Settings} path="/management" pathname={pathname} collapsed={collapsed} />
                )}
            </nav>

            {/* Footer */}
            <div className={`mt-2 space-y-1.5 ${collapsed ? 'px-1' : 'px-2'}`}>
                {/* Sync status */}
                {!collapsed && <SyncStatus />}

                {/* Update status — only appears when update is available */}
                {!collapsed && <UpdateStatus />}

                <div className={`flex items-center rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] ${collapsed ? 'flex-col gap-1 py-2 px-1' : 'justify-between px-2.5 py-2'}`}>
                    <button
                        onClick={() => setLang(lang === 'en' ? 'km' : 'en')}
                        className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
                        title={lang === 'en' ? 'Switch to Khmer' : 'Switch to English'}
                    >
                        <Globe size={13} className="text-[var(--accent-blue)]" />
                        {!collapsed && (lang === 'en' ? 'EN' : 'ខ្មែរ')}
                    </button>
                    <button
                        onClick={toggleTheme}
                        className="p-1.5 rounded-lg transition-all hover:bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--foreground)]"
                        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    >
                        {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
                    </button>
                    <button
                        onClick={handleLogout}
                        className="p-1.5 rounded-lg transition-all hover:bg-red-500/10 text-red-500/70 hover:text-red-400"
                        title={t('logout')}
                    >
                        <LogOut size={14} strokeWidth={2.5} />
                    </button>
                </div>
            </div>
        </aside>
    );
}
