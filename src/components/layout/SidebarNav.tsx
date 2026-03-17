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
                className={`flex flex-col items-center justify-center gap-1.5 w-full aspect-square rounded-2xl transition-all group ${isExactMatch
                    ? 'bg-[var(--accent)] text-black shadow-[0_0_15px_rgba(204,255,0,0.2)]'
                    : 'text-[#8a8a99] hover:text-white hover:bg-white/10'
                    }`}
            >
                <Icon size={24} className={isExactMatch ? 'text-black' : 'group-hover:scale-110 transition-transform'} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-center px-1">
                    {label}
                </span>
            </button>
        );
    };

    return (
        <aside
            className="w-24 flex-shrink-0 flex flex-col items-center py-6 h-screen sticky top-0 bg-black z-40 border-r border-white/10"
            style={{ boxShadow: '10px 0 30px rgba(0,0,0,0.5)' }}
        >
            {/* Logo */}
            <div className="mb-8 flex flex-col items-center gap-2">
                <div
                    className="w-12 h-12 rounded-[1rem] flex items-center justify-center"
                    style={{ background: 'var(--accent)' }}
                >
                    <ChefHat size={24} color="#000" strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-black tracking-tighter text-white uppercase opacity-80">
                    DineOS
                </span>
            </div>

            {/* Primary Navigation */}
            <nav className="flex flex-col gap-3 w-full px-3 flex-1">
                <NavItem label={t('pos')} icon={LayoutGrid} path="/pos" />
                <NavItem label="Tables" icon={TableProperties} path="/pos/tables" />
                <NavItem label={t('orderHistory')} icon={History} path="/history" />
                {(user?.role === 'admin' || user?.role === 'manager') && (
                    <NavItem label={t('management')} icon={Settings} path="/management" />
                )}
            </nav>

            {/* Footer / Utilities */}
            <div className="flex flex-col items-center gap-4 w-full mt-auto">
                <OfflineIndicator />
                
                <button
                    onClick={() => setLang(lang === 'en' ? 'km' : 'en')}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-[#8a8a99] transition-all hover:bg-white/10 hover:text-white"
                >
                    <Globe size={20} />
                </button>

                <div className="w-8 h-px bg-white/10 my-1" />

                <button
                    onClick={handleLogout}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all hover:bg-[var(--accent-red)] hover:text-white"
                    style={{ color: 'var(--accent-red)' }}
                    title={t('logout')}
                >
                    <LogOut size={20} strokeWidth={2.5} />
                </button>
            </div>
        </aside>
    );
}
