'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    User, Lock, Monitor, Building2, MapPin, Image as ImageIcon,
    Info, ArrowRightLeft, CloudOff, Download, ExternalLink
} from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { canAccessAdminConsole } from '@/lib/permissions';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const { t } = useLanguage();
    const router = useRouter();
    const pathname = usePathname().replace(/\/$/, '') || '/';

    const isAdmin = user?.role === 'admin';

    // Non-admins can never reach the Business config sections — mirror the modal gating.
    // Exception: the read-only exchange-rate view stays reachable by all roles.
    useEffect(() => {
        if (!isAdmin && pathname.startsWith('/settings/business') && pathname !== '/settings/business/exchange-rate') {
            router.replace('/settings/profile');
        }
    }, [isAdmin, pathname, router]);

    const accountItems = [
        { href: '/settings/profile', label: t('settingsProfile'), icon: User },
        { href: '/settings/password', label: t('settingsPassword'), icon: Lock },
        { href: '/settings/appearance', label: t('settingsAppearance'), icon: Monitor },
        // Non-admins still need to see the day's rate (read-only); admins get it in the Business group.
        ...(isAdmin ? [] : [{ href: '/settings/business/exchange-rate', label: t('settingsExchangeRate'), icon: ArrowRightLeft }]),
    ];

    const businessItems = [
        { href: '/settings/business/identity', label: t('settingsIdentityType'), icon: Building2 },
        { href: '/settings/business/address', label: t('settingsAddressDetails'), icon: MapPin },
        { href: '/settings/business/branding', label: t('settingsLogoBranding'), icon: ImageIcon },
        { href: '/settings/business/operational', label: t('settingsOperational'), icon: Info },
        { href: '/settings/business/exchange-rate', label: t('settingsExchangeRate'), icon: ArrowRightLeft },
        { href: '/settings/business/cloud-sync', label: t('settingsCloudSync'), icon: CloudOff },
    ];

    function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
        const active = pathname === href;
        return (
            <Link
                href={href}
                className={`flex items-center gap-2.5 px-3 py-2 min-h-[40px] rounded-lg text-xs font-bold whitespace-nowrap transition-all ${active
                    ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border border-[var(--accent-blue)]/35 font-black'
                    : 'text-[var(--text-secondary)] border border-transparent hover:text-[var(--foreground)] hover:bg-[var(--bg-elevated)]'}`}
            >
                <Icon size={14} className="flex-shrink-0" />
                <span className="truncate">{label}</span>
            </Link>
        );
    }

    return (
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
            <div className="max-w-5xl mx-auto w-full px-4 md:px-8 py-6 md:py-10 flex flex-col md:flex-row gap-6 md:gap-10">
                {/* Left grouped section-nav */}
                <aside className="md:w-56 flex-shrink-0">
                    <nav className="flex md:flex-col gap-1 overflow-x-auto no-scrollbar md:overflow-visible pb-2 md:pb-0">
                        <p className="hidden md:block px-3 pt-1 pb-1 text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-secondary)] opacity-55">
                            {t('settingsGroupAccount')}
                        </p>
                        {accountItems.map(item => <NavLink key={item.href} {...item} />)}

                        {canAccessAdminConsole(user?.role) && (
                            <Link
                                href="/downloads"
                                className="flex items-center gap-2.5 px-3 py-2 min-h-[40px] rounded-lg text-xs font-bold whitespace-nowrap text-[var(--text-secondary)] border border-transparent hover:text-[var(--foreground)] hover:bg-[var(--bg-elevated)] transition-all"
                            >
                                <Download size={14} className="flex-shrink-0" />
                                <span className="truncate flex-1">{t('downloads')}</span>
                                <ExternalLink size={10} className="opacity-40 hidden md:block" />
                            </Link>
                        )}

                        {isAdmin && (
                            <>
                                <p className="hidden md:block px-3 pt-4 pb-1 text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-secondary)] opacity-55">
                                    {t('settingsBusinessConfig')}
                                </p>
                                {businessItems.map(item => <NavLink key={item.href} {...item} />)}
                            </>
                        )}
                    </nav>
                </aside>

                {/* Right readable content column */}
                <main className="flex-1 min-w-0 max-w-[720px]">
                    {children}
                </main>
            </div>
        </div>
    );
}
