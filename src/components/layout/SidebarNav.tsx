'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/providers/LanguageProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { LogOut, LayoutGrid, Settings, History, Globe, Store, Building2, UtensilsCrossed, ArrowLeftToLine, ArrowRightToLine, Sun, Moon, Download } from 'lucide-react';
import { getRestaurant, Restaurant } from '@/lib/tauri-commands';
import { stopSync } from '@/lib/api/system';
import { SyncStatus } from '@/components/ui/SyncStatus';
import { UpdateStatus } from '@/components/ui/UpdateStatus';
import Link from 'next/link';
import MySettingsModal from '@/components/layout/MySettingsModal';

const NavItem = ({
    label, icon: Icon, path, pathname, searchParams, collapsed
}: { label: string; icon: React.ElementType; path: string; pathname: string; searchParams: string; collapsed: boolean }) => {
    // Check if the current route matches the exact path (including query params if provided)
    const active = pathname.startsWith(path.split('?')[0]);
    
    // For tabs like "Product" (?mode=direct), we want a more specific match
    const isExact = path.includes('?') 
        ? (active && searchParams === '?' + path.split('?')[1])
        : (active && !searchParams.includes('mode=direct') && !searchParams.includes('mode=table'));

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
    const searchParams = useSearchParams();
    const searchStr = searchParams.toString() ? '?' + searchParams.toString() : '';
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [collapsed, setCollapsed] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [userAvatar, setUserAvatar] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            setUserAvatar(localStorage.getItem(`dineos_user_avatar_${user.id}`));
        } else {
            setUserAvatar(null);
        }
    }, [user]);

    useEffect(() => {
        function reloadBusiness() {
            getRestaurant(user?.restaurant_id || undefined)
                .then(setRestaurant)
                .catch(console.error);
        }

        function reloadAvatar() {
            if (user) {
                setUserAvatar(localStorage.getItem(`dineos_user_avatar_${user.id}`));
            }
        }

        reloadBusiness();

        window.addEventListener('business-updated', reloadBusiness);
        window.addEventListener('user-avatar-updated', reloadAvatar);

        return () => {
            window.removeEventListener('business-updated', reloadBusiness);
            window.removeEventListener('user-avatar-updated', reloadAvatar);
        };
    }, [user]);

    // Auto redirect if user is on table view but it is disabled
    useEffect(() => {
        if (!restaurant) return;
        const tablesDisabled = restaurant.business_type === 'Mart/Accessories Shop/Pharmacy/Bakery' || 
            (restaurant.business_type === 'Coffee Shop' && restaurant.disable_tables === 1);
        
        if (tablesDisabled && pathname === '/pos' && searchParams.get('mode') === 'table') {
            router.replace('/pos?mode=direct');
        }
    }, [restaurant, pathname, searchParams, router]);

    function handleLogout() {
        stopSync().catch(() => {});
        setUser(null);
        router.replace('/login');
    }

    const showTablesTab = restaurant 
        ? restaurant.business_type !== 'Mart/Accessories Shop/Pharmacy/Bakery' && !(restaurant.business_type === 'Coffee Shop' && restaurant.disable_tables === 1)
        : true;

    return (
        <aside
            className={`relative flex-shrink-0 flex flex-col py-3 h-screen sticky top-0 bg-[var(--sidebar-bg)] z-40 border-r border-[var(--border)] transition-all duration-200 ${collapsed ? 'w-14' : 'w-48'}`}
            style={{ boxShadow: '1px 0 20px rgba(2,6,23,0.12)' }}
        >
            {/* Floating Border Toggle Button */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-[var(--accent-blue)] text-white shadow-md border border-[var(--border)] flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 cursor-pointer"
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
                {collapsed ? <ArrowRightToLine size={12} /> : <ArrowLeftToLine size={12} />}
            </button>

            {/* Logo + toggle */}
            <div className="mb-4 flex items-center px-3">
                {!collapsed && (
                    <div className="min-w-0 flex-1 pl-1">
                        <h1 className="text-sm font-black text-[var(--foreground)] tracking-tight truncate leading-tight">
                            {restaurant?.name || 'DineOS'}
                        </h1>
                        <p className="text-[10px] text-[var(--text-secondary)] truncate">{user?.full_name || user?.username}</p>
                    </div>
                )}
            </div>

            <nav className="flex flex-col gap-0.5 w-full px-2 flex-1">
                {showTablesTab && (
                    <NavItem label={t('pos')} icon={LayoutGrid} path="/pos?mode=table" pathname={pathname} searchParams={searchStr} collapsed={collapsed} />
                )}
                <NavItem label={t('buyProduct')} icon={Store} path="/pos?mode=direct" pathname={pathname} searchParams={searchStr} collapsed={collapsed} />
                {false && (user?.role === 'admin' || user?.role === 'chef') && (
                    <NavItem label={t('kitchen')} icon={UtensilsCrossed} path="/pos/kitchen" pathname={pathname} searchParams={searchStr} collapsed={collapsed} />
                )}
                <NavItem label={t('history')} icon={History} path="/history" pathname={pathname} searchParams={searchStr} collapsed={collapsed} />
                
                <div className="mt-auto flex flex-col gap-0.5 w-full">
                    <NavItem label={t('downloads')} icon={Download} path="/downloads" pathname={pathname} searchParams={searchStr} collapsed={collapsed} />
                    {(user?.role === 'admin' || user?.role === 'manager') && (
                        <NavItem label={t('management')} icon={Settings} path="/management" pathname={pathname} searchParams={searchStr} collapsed={collapsed} />
                    )}
                </div>
            </nav>

            {/* Footer */}
            <div className={`mt-2 space-y-1.5 ${collapsed ? 'px-1' : 'px-2'}`}>
                {/* Sync status */}
                {!collapsed && <SyncStatus />}

                {/* Update status — only appears when update is available */}
                {!collapsed && <UpdateStatus />}

                {/* Unified profile settings button */}
                <button
                    onClick={() => setIsSettingsOpen(true)}
                    className={`flex items-center gap-2.5 px-3 py-2 w-full rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)] hover:border-[var(--accent-blue)]/50 transition-all cursor-pointer ${collapsed ? 'justify-center' : ''}`}
                    title="My Settings"
                >
                    <div className="w-7 h-7 rounded-xl border border-[var(--border)] flex items-center justify-center font-black text-xs flex-shrink-0 relative overflow-hidden">
                        {userAvatar ? (
                            <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20 flex items-center justify-center font-black">
                                {user?.full_name?.charAt(0).toUpperCase() || user?.username.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                    {!collapsed && (
                        <div className="text-left min-w-0 flex-1">
                            <p className="text-[11px] font-black text-[var(--foreground)] truncate leading-none">
                                {user?.full_name || user?.username}
                            </p>
                            <p className="text-[9px] font-black text-[var(--text-secondary)] opacity-60 uppercase tracking-widest leading-none mt-1.5">
                                {user?.role}
                            </p>
                        </div>
                    )}
                </button>
            </div>

            {/* Premium Settings Modal */}
            <MySettingsModal 
                isOpen={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)} 
            />
        </aside>
    );
}
