'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/providers/LanguageProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, LayoutGrid, Settings, History, Globe, ChefHat, UtensilsCrossed } from 'lucide-react';
import { getRestaurant, Restaurant } from '@/lib/tauri-commands';
import Link from 'next/link';

const NavItem = ({
    label, icon: Icon, path, pathname
}: { label: string; icon: React.ElementType; path: string; pathname: string }) => {
    // /pos covers both the floor plan (/pos) and the ordering view (same page, context-driven)
    const active = path === '/pos' ? pathname.startsWith('/pos') : pathname.startsWith(path);
    const isExact = active;

    return (
        <Link
            href={path}
            className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl transition-all group active:scale-95 text-sm ${isExact
                ? 'bg-[var(--accent-blue)]/15 text-white border border-[var(--accent-blue)]/40 font-semibold'
                : 'text-[var(--text-secondary)] border border-transparent hover:text-[var(--foreground)] hover:bg-[var(--bg-elevated)] font-medium'
            }`}
            title={label}
        >
            <Icon size={16} strokeWidth={isExact ? 2.5 : 2} className={isExact ? 'text-[var(--accent-blue)]' : ''} />
            <span className="truncate">{label}</span>
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
            className="w-48 flex-shrink-0 flex flex-col py-3 h-screen sticky top-0 bg-[#0a1118] z-40 border-r border-[var(--border)]"
            style={{ boxShadow: '1px 0 20px rgba(2,6,23,0.5)' }}
        >
            {/* Logo */}
            <div className="px-3 mb-4 flex items-center gap-2.5">
                <div
                    className="w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center border border-[var(--border)]"
                    style={{ background: 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)' }}
                >
                    {restaurant?.logo_path ? (
                        <img src={`https://asset.localhost/${restaurant.logo_path}`} alt="Logo" className="w-full h-full object-cover rounded-xl" />
                    ) : (
                        <ChefHat size={18} color="#fff" strokeWidth={2.5} />
                    )}
                </div>
                <div className="min-w-0">
                    <h1 className="text-sm font-black text-[var(--foreground)] tracking-tight truncate leading-tight">
                        {restaurant?.name || 'DineOS'}
                    </h1>
                    <p className="text-[10px] text-[var(--text-secondary)] truncate">{user?.full_name || user?.username}</p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex flex-col gap-0.5 w-full px-2 flex-1">
                <NavItem label={lang === 'km' ? 'ផ្នែកលក់' : 'POS'} icon={LayoutGrid} path="/pos" pathname={pathname} />
                <NavItem label={lang === 'km' ? 'ផ្ទះបាយ' : 'Kitchen'} icon={UtensilsCrossed} path="/pos/kitchen" pathname={pathname} />
                <NavItem label={lang === 'km' ? 'ប្រវត្តិ' : 'History'} icon={History} path="/history" pathname={pathname} />
                {(user?.role === 'admin' || user?.role === 'manager') && (
                    <NavItem label={lang === 'km' ? 'គ្រប់គ្រង' : 'Management'} icon={Settings} path="/management" pathname={pathname} />
                )}
            </nav>

            {/* Footer */}
            <div className="px-2 mt-2 space-y-1.5">
                <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)]">
                    <button
                        onClick={() => setLang(lang === 'en' ? 'km' : 'en')}
                        className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
                        title={lang === 'en' ? 'Switch to Khmer' : 'Switch to English'}
                    >
                        <Globe size={13} className="text-[var(--accent-blue)]" />
                        {lang === 'en' ? 'EN' : 'ážáŸ’áž˜áŸ‚ážš'}
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
