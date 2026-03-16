'use client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, LayoutGrid, Settings, LayoutList, Globe } from 'lucide-react';
import OfflineIndicator from '../ui/OfflineIndicator';

export default function TopNavigation() {
    const { t, lang, setLang } = useLanguage();
    const { user, setUser } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    function handleLogout() {
        setUser(null);
        router.replace('/login');
    }

    const NavItem = ({ label, icon: Icon, path }: { label: string, icon: any, path: string }) => {
        const active = pathname.startsWith(path);
        return (
            <button
                onClick={() => router.push(path)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${active ? 'bg-[var(--accent)] text-black' : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-elevated)]'}`}
            >
                <Icon size={18} />
                {label}
            </button>
        );
    };

    return (
        <header className="h-16 border-b border-[var(--border)] bg-[var(--bg-card)] flex items-center justify-between px-6 sticky top-0 z-40">
            <div className="flex items-center gap-8">
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-500 to-yellow-300 mr-4">
                    KH POS
                </h1>

                <nav className="flex items-center gap-2">
                    <NavItem label={t('pos')} icon={LayoutGrid} path="/pos" />
                    {user?.role === 'admin' || user?.role === 'manager' ? (
                        <NavItem label={t('management')} icon={Settings} path="/management" />
                    ) : null}
                    <NavItem label={t('orderHistory')} icon={LayoutList} path="/history" />
                </nav>
            </div>

            <div className="flex items-center gap-4">
                <OfflineIndicator />
                <div className="h-6 w-px bg-[var(--border)]" />

                <button onClick={() => setLang(lang === 'en' ? 'km' : 'en')} className="btn-ghost px-3 py-1.5 rounded-lg flex gap-2 items-center text-sm font-medium">
                    <Globe size={16} />
                    {lang === 'en' ? 'ខ្មែរ' : 'EN'}
                </button>

                <div className="flex items-center gap-3 ml-2 pl-4 border-l border-[var(--border)]">
                    <div className="text-right">
                        <p className="text-sm font-medium leading-none mb-1 text-white">{user?.full_name || user?.username}</p>
                        <p className="text-xs text-[var(--text-secondary)] capitalize leading-none">{user?.role}</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--bg-elevated)] text-[var(--accent-red)] hover:bg-red-500/20 transition-colors"
                        title={t('logout')}
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </div>
        </header>
    );
}
