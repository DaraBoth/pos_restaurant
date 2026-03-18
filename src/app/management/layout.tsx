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
                {/* Management Horizontal Navbar */}
                <header className="flex-shrink-0 bg-[var(--bg-card)] border-b border-[var(--border)] relative z-20 shadow-sm overflow-x-auto container-snap">
                    <div className="px-[var(--space-unit)] flex items-center h-20 gap-[var(--space-unit)] min-w-max">
                        <div className="flex flex-col justify-center pr-[var(--space-unit)] border-r border-[var(--border)]">
                            <h2 className="text-[var(--text-xs)] font-black uppercase tracking-[0.2em] text-[var(--accent)] leading-none mb-1.5 opacity-80">
                                Management
                            </h2>
                            <div className="flex items-center gap-2">
                                <span className="text-[var(--text-sm)] font-black text-[var(--foreground)] whitespace-nowrap">DineOS Core</span>
                                <span className="px-1.5 py-0.5 rounded-md bg-[var(--accent)]/10 text-[var(--accent)] text-[8px] font-black uppercase border border-[var(--accent)]/20">V1</span>
                            </div>
                        </div>

                        <nav className="flex items-center gap-2 p-1 bg-[var(--background)] rounded-2xl border border-[var(--border)]">
                            <SideNavItems />
                        </nav>
                    </div>
                </header>

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto p-[var(--space-unit)] lg:p-[calc(var(--space-unit)*1.5)] min-w-0 container-snap relative bg-[var(--background)]">
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
                        className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-[var(--text-xs)] font-black uppercase tracking-[0.1em] transition-all group whitespace-nowrap active:scale-95 ${
                            active 
                                ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/30' 
                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-dark)] hover:text-[var(--foreground)]'
                        }`}
                    >
                        <Icon 
                            size={16} 
                            strokeWidth={active ? 3 : 2} 
                            className={`${active ? 'text-white' : 'group-hover:text-[var(--accent)] transition-colors'}`} 
                        />
                        <span>{label}</span>
                    </Link>
                );
            })}
        </>
    );
}
