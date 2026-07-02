'use client';
import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/providers/LanguageProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { LogOut, LayoutGrid, Settings, History, Globe, Store, Building2, UtensilsCrossed, ArrowLeftToLine, ArrowRightToLine, Sun, Moon, Pencil, Hash, ArrowLeftRight, X, AlertTriangle, ChevronUp } from 'lucide-react';
import { getRestaurant, Restaurant } from '@/lib/tauri-commands';
import { stopSync } from '@/lib/api/system';
import { loginWithPin, resetWindowTitle } from '@/lib/api/auth';
import { getInventoryItems } from '@/lib/api/inventory';
import { SyncStatus } from '@/components/ui/SyncStatus';
import { UpdateStatus } from '@/components/ui/UpdateStatus';
import { canAccessAdminConsole, roleI18nKey } from '@/lib/permissions';
import Link from 'next/link';
import { useOrder } from '@/providers/OrderProvider';

const NavItem = ({
    label, icon: Icon, path, pathname, searchParams, collapsed, onClick, badge
}: {
    label: string;
    icon: React.ElementType;
    path: string;
    pathname: string;
    searchParams: string;
    collapsed: boolean;
    onClick?: () => void;
    badge?: number;
}) => {
    // Check if the current route matches the exact path (including query params if provided)
    const active = pathname.startsWith(path.split('?')[0]);
    
    // For tabs like "Product" (?mode=direct), we want a more specific match
    const isExact = path.includes('?') 
        ? (active && searchParams === '?' + path.split('?')[1])
        : (active && !searchParams.includes('mode=direct') && !searchParams.includes('mode=table'));

    return (
        <Link
            href={path}
            onClick={onClick}
            className={`flex items-center gap-2.5 w-full px-2.5 py-2 min-h-[44px] rounded-xl transition-all group active:scale-95 text-sm ${isExact
                ? 'bg-[var(--accent-blue)]/15 text-[var(--foreground)] border border-[var(--accent-blue)]/40 font-semibold'
                : 'text-[var(--text-secondary)] border border-transparent hover:text-[var(--foreground)] hover:bg-[var(--bg-elevated)] font-medium'
            } ${collapsed ? 'justify-center px-0' : ''}`}
            title={label}
        >
            <span className="relative flex-shrink-0">
                <Icon size={16} strokeWidth={isExact ? 2.5 : 2} className={isExact ? 'text-[var(--accent-blue)]' : ''} />
                {collapsed && badge != null && badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-0.5 leading-none">
                        {badge > 99 ? '99+' : badge}
                    </span>
                )}
            </span>
            {!collapsed && <span className="truncate flex-1">{label}</span>}
            {!collapsed && badge != null && badge > 0 && (
                <span className="flex-shrink-0 min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1">
                    {badge > 99 ? '99+' : badge}
                </span>
            )}
        </Link>
    );
};

export default function SidebarNav() {
    const { t, lang, setLang } = useLanguage();
    const { user, setUser } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { clearOrder, exchangeRate, items, localCart } = useOrder();
    const [lowStockCount, setLowStockCount] = useState(0);
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const searchStr = searchParams.toString() ? '?' + searchParams.toString() : '';
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [collapsed, setCollapsed] = useState(false);
    const [isLogoutOpen, setIsLogoutOpen] = useState(false);
    const [userAvatar, setUserAvatar] = useState<string | null>(null);
    const [isSwitchOpen, setIsSwitchOpen] = useState(false);
    const [switchPin, setSwitchPin] = useState('');
    const [switchError, setSwitchError] = useState('');
    const [switchLoading, setSwitchLoading] = useState(false);
    const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
    const accountMenuRef = useRef<HTMLDivElement>(null);
    const cartHasItems = items.length > 0 || localCart.length > 0;

    // Close the account popover on outside-click or Escape
    useEffect(() => {
        if (!isAccountMenuOpen) return;
        function onPointerDown(e: MouseEvent) {
            if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
                setIsAccountMenuOpen(false);
            }
        }
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') setIsAccountMenuOpen(false);
        }
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [isAccountMenuOpen]);

    useEffect(() => {
        if (user) {
            setUserAvatar(localStorage.getItem(`dineos_user_avatar_${user.id}`));
        } else {
            setUserAvatar(null);
        }
    }, [user]);

    useEffect(() => {
        if (!user?.restaurant_id) return;
        getInventoryItems(user.restaurant_id)
            .then(items => setLowStockCount(items.filter(i => i.stock_qty <= i.min_stock_qty).length))
            .catch(() => setLowStockCount(0));
    }, [user?.restaurant_id]);

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

    // Reflect the restaurant's own name in the OS window/taskbar title so staff
    // (incl. Khmer-only users) can identify the app; falls back to the product name.
    useEffect(() => {
        const name = restaurant ? (lang === 'km' ? (restaurant.khmer_name || restaurant.name) : restaurant.name) : '';
        const title = name ? `${name} — DineOS` : 'DineOS';
        let cancelled = false;
        import('@tauri-apps/api/window')
            .then(({ getCurrentWindow }) => { if (!cancelled) getCurrentWindow().setTitle(title); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [restaurant, lang]);

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
        setIsLogoutOpen(true);
    }

    function confirmLogout() {
        stopSync().catch(() => {});
        resetWindowTitle().catch(() => {});
        setUser(null);
        setIsLogoutOpen(false);
        router.replace('/login');
    }

    async function handleSwitchUser(e: React.FormEvent) {
        e.preventDefault();
        setSwitchError('');
        setSwitchLoading(true);
        try {
            const restaurantId = user?.restaurant_id ?? '';
            const session = await loginWithPin(restaurantId, switchPin);
            setUser(session);
            setIsSwitchOpen(false);
            setSwitchPin('');
        } catch {
            setSwitchError(t('wrongPin'));
        } finally {
            setSwitchLoading(false);
        }
    }

    const showTablesTab = restaurant 
        ? restaurant.business_type !== 'Mart/Accessories Shop/Pharmacy/Bakery' && !(restaurant.business_type === 'Coffee Shop' && restaurant.disable_tables === 1)
        : true;

    return (
        <aside
            className={`relative flex-shrink-0 flex flex-col py-3 h-screen sticky top-0 bg-[var(--sidebar-bg)] z-40 border-r border-[var(--border)] transition-all duration-200 ${collapsed ? 'w-14' : 'w-48'}`}
            style={{ boxShadow: '1px 0 20px rgba(2,6,23,0.12)' }}
        >
            {/* Floating Border Toggle Button — min 44px effective tap area via padding */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="absolute -right-5 top-14 w-10 h-10 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 cursor-pointer"
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
                <span className="w-6 h-6 rounded-full bg-[var(--accent-blue)] text-white shadow-md border border-[var(--border)] flex items-center justify-center">
                    {collapsed ? <ArrowRightToLine size={12} /> : <ArrowLeftToLine size={12} />}
                </span>
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
                    <NavItem label={t('pos')} icon={LayoutGrid} path="/pos?mode=table" pathname={pathname} searchParams={searchStr} collapsed={collapsed} onClick={clearOrder} />
                )}
                <NavItem label={t('buyProduct')} icon={Store} path="/pos?mode=direct" pathname={pathname} searchParams={searchStr} collapsed={collapsed} onClick={clearOrder} />
                {canAccessAdminConsole(user?.role) && (
                    <NavItem label={t('kitchen')} icon={UtensilsCrossed} path="/pos/kitchen" pathname={pathname} searchParams={searchStr} collapsed={collapsed} />
                )}
                <NavItem label={t('history')} icon={History} path="/history" pathname={pathname} searchParams={searchStr} collapsed={collapsed} />
                
                <div className="mt-auto flex flex-col gap-0.5 w-full">
                    {canAccessAdminConsole(user?.role) && (
                        <NavItem label={t('management')} icon={Settings} path="/management" pathname={pathname} searchParams={searchStr} collapsed={collapsed} badge={lowStockCount > 0 ? lowStockCount : undefined} />
                    )}
                </div>
            </nav>

            {/* Footer */}
            <div className={`mt-2 space-y-2 ${collapsed ? 'px-1' : 'px-2'}`}>
                {/* ── Status cluster: ambient info, grouped & visually distinct from actions ── */}
                <div className={`rounded-xl bg-[var(--bg-dark)] border border-[var(--border)] ${collapsed ? 'p-1 space-y-1' : 'p-1.5 space-y-1'}`}>
                    <SyncStatus collapsed={collapsed} />
                    <UpdateStatus collapsed={collapsed} />
                    {exchangeRate > 0 && (
                        <Link
                            href="/settings/business/exchange-rate"
                            className={`flex items-center gap-2 px-2 py-2 min-h-[40px] w-full rounded-lg hover:bg-[var(--bg-elevated)] transition-all group ${collapsed ? 'justify-center' : ''}`}
                            title={`1 USD = ${Math.round(exchangeRate).toLocaleString()} ៛`}
                        >
                            {!collapsed ? (
                                <>
                                    <span className="text-[10px] font-mono font-bold text-[var(--text-secondary)] flex-1 truncate">
                                        1 USD = {Math.round(exchangeRate).toLocaleString()} ៛
                                    </span>
                                    <Pencil size={10} className="text-[var(--text-secondary)] opacity-40 group-hover:opacity-80 flex-shrink-0" />
                                </>
                            ) : (
                                <span className="text-[9px] font-mono font-black text-[var(--text-secondary)]">៛</span>
                            )}
                        </Link>
                    )}
                </div>

                {/* ── Account: single entry point, actions grouped in a popover ── */}
                <div className="relative" ref={accountMenuRef}>
                    <button
                        onClick={() => setIsAccountMenuOpen(o => !o)}
                        aria-label={t('accountMenu')}
                        aria-haspopup="menu"
                        aria-expanded={isAccountMenuOpen}
                        className={`group flex items-center gap-2.5 px-3 py-2 min-h-[44px] w-full rounded-2xl bg-[var(--bg-elevated)] border transition-all cursor-pointer ${isAccountMenuOpen ? 'border-[var(--accent-blue)]/50' : 'border-[var(--border)] hover:border-[var(--accent-blue)]/50'} ${collapsed ? 'justify-center' : ''}`}
                        title={t('accountMenu')}
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
                            <>
                                <div className="text-left min-w-0 flex-1">
                                    <p className="text-[11px] font-black text-[var(--foreground)] truncate leading-none">
                                        {user?.full_name || user?.username}
                                    </p>
                                    <p className="text-[9px] font-black text-[var(--text-secondary)] opacity-60 uppercase tracking-widest leading-none mt-1.5">
                                        {t(roleI18nKey(user?.role))}
                                    </p>
                                </div>
                                <ChevronUp size={13} className={`text-[var(--text-secondary)] opacity-50 flex-shrink-0 transition-transform ${isAccountMenuOpen ? '' : 'rotate-180'}`} />
                            </>
                        )}
                    </button>

                    {isAccountMenuOpen && (
                        <div
                            role="menu"
                            className={`absolute bottom-full mb-2 z-50 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-2xl p-1.5 ${collapsed ? 'left-0 w-52' : 'left-0 right-0'}`}
                        >
                            <button
                                role="menuitem"
                                onClick={() => { setIsAccountMenuOpen(false); router.push('/settings/profile'); }}
                                className="flex items-center gap-2.5 px-3 py-2.5 min-h-[44px] w-full rounded-xl text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--bg-elevated)] transition-all text-left"
                            >
                                <Settings size={14} className="flex-shrink-0" />
                                <span className="text-[11px] font-bold">{t('mySettings')}</span>
                            </button>
                            <button
                                role="menuitem"
                                onClick={() => { setIsAccountMenuOpen(false); setIsSwitchOpen(true); setSwitchPin(''); setSwitchError(''); }}
                                className="flex items-center gap-2.5 px-3 py-2.5 min-h-[44px] w-full rounded-xl text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--bg-elevated)] transition-all text-left"
                            >
                                <ArrowLeftRight size={14} className="flex-shrink-0" />
                                <span className="text-[11px] font-bold">{t('switchUser')}</span>
                            </button>
                            <div className="border-t border-[var(--border)] my-1 mx-1 opacity-50" />
                            <button
                                role="menuitem"
                                onClick={() => { setIsAccountMenuOpen(false); handleLogout(); }}
                                className="flex items-center gap-2.5 px-3 py-2.5 min-h-[44px] w-full rounded-xl text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-all text-left"
                            >
                                <LogOut size={14} className="flex-shrink-0" />
                                <span className="text-[11px] font-bold">{t('logout')}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Switch User PIN Modal */}
            {isSwitchOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-72 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-black text-[var(--foreground)]">{t('switchUser')}</h3>
                            <button onClick={() => setIsSwitchOpen(false)} className="text-[var(--text-secondary)] hover:text-[var(--foreground)]">
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleSwitchUser} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-1 block">{t('pin')}</label>
                                <div className="relative">
                                    <Hash size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-50" />
                                    <input
                                        type="password"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={6}
                                        value={switchPin}
                                        onChange={e => setSwitchPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        autoFocus
                                        required
                                        className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl pl-9 pr-4 py-2.5 text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-all font-mono tracking-[0.5em] text-center text-sm"
                                        placeholder="• • • •"
                                    />
                                </div>
                            </div>
                            {switchError && (
                                <div className="flex items-center gap-2 text-red-400 text-xs font-bold">
                                    <AlertTriangle size={13} />
                                    {switchError}
                                </div>
                            )}
                            <button
                                type="submit"
                                disabled={switchLoading || switchPin.length < 4}
                                className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-white font-black text-sm shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {switchLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t('login')}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Logout Confirmation Modal */}
            {isLogoutOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-80 p-6 mx-4">
                        <div className="flex items-start gap-3 mb-4">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cartHasItems ? 'bg-red-500/10' : 'bg-[var(--bg-elevated)]'}`}>
                                <LogOut size={16} className={cartHasItems ? 'text-red-400' : 'text-[var(--text-secondary)]'} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-[var(--foreground)]">{t('logoutConfirmTitle')}</h3>
                                <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                                    {cartHasItems ? t('logoutActiveOrderWarning') : t('logoutConfirmDesc')}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsLogoutOpen(false)}
                                className="flex-1 py-2 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--bg-elevated)] transition-colors"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={confirmLogout}
                                className={`flex-1 py-2 rounded-xl text-xs font-black text-white transition-all active:scale-95 ${cartHasItems ? 'bg-red-500 hover:bg-red-600' : 'bg-[var(--accent)] hover:brightness-110'}`}
                            >
                                {t('logout')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
}
