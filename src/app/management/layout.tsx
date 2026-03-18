'use client';
import SidebarNav from '@/components/layout/SidebarNav';
import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Package, Users, RefreshCw, ClipboardList, Building2 } from 'lucide-react';

const NAV_ITEMS = [
    { href: '/management', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/management/products', label: 'Products & Categories', icon: Package },
    { href: '/management/users', label: 'Users & Roles', icon: Users },
    { href: '/management/exchange-rate', label: 'Exchange Rates', icon: RefreshCw },
    { href: '/management/orders', label: 'Order History', icon: ClipboardList },
    { href: '/management/settings', label: 'Restaurant Settings', icon: Building2 },
];

export default function ManagementLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="h-screen w-full flex flex-row bg-[var(--background)] text-[var(--foreground)]">
            <SidebarNav />
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 min-w-0 container-snap relative bg-[var(--background)]">
                    <div className="relative z-10 max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}

function SideNavItems() {
    const pathname = usePathname();

    return (
        <>
            {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
                const active = exact ? pathname === href : pathname.startsWith(href);
                return (
                    <Link
                        key={href}
                        href={href}
                        className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all group whitespace-nowrap active:scale-95 ${
                            active 
                                ? 'bg-[var(--accent)] text-black shadow-lg shadow-[var(--accent)]/20' 
                                : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-white'
                        }`}
                    >
                        <Icon 
                            size={16} 
                            strokeWidth={active ? 3 : 2} 
                            className={`${active ? 'text-black' : 'group-hover:text-white transition-colors'}`} 
                        />
                        <span>{label}</span>
                    </Link>
                );
            })}
        </>
    );
}
