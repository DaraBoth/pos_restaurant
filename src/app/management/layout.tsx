'use client';
import SidebarNav from '@/components/layout/SidebarNav';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, Users, RefreshCw, ClipboardList, Building2, TrendingUp, LayoutGrid } from 'lucide-react';

const NAV_ITEMS = [
    { href: '/management', label: 'Dashboard', labelKm: 'ផ្ទាំងគ្រប់គ្រង', icon: LayoutDashboard, exact: true },
    { href: '/management/analytics', label: 'Analytics', labelKm: 'របាយការណ៍', icon: TrendingUp },
    { href: '/management/products', label: 'Products', labelKm: 'ផលិតផល', icon: Package },
    { href: '/management/tables', label: 'Tables', labelKm: 'តុ', icon: LayoutGrid },
    { href: '/management/users', label: 'Users', labelKm: 'អ្នកប្រើ', icon: Users },
    { href: '/management/exchange-rate', label: 'Exchange Rate', labelKm: 'អត្រាប្តូរប្រាក់', icon: RefreshCw },
    { href: '/management/orders', label: 'Orders', labelKm: 'បញ្ជាទិញ', icon: ClipboardList },
    { href: '/management/settings', label: 'Settings', labelKm: 'ការកំណត់', icon: Building2 },
];

export default function ManagementLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="h-screen w-full flex flex-row bg-[var(--bg-dark)] text-[var(--foreground)]">
            <SidebarNav />
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                {/* Horizontal sub-nav */}
                <header className="flex-shrink-0 bg-[var(--bg-card)] border-b border-[var(--border)] overflow-x-auto no-scrollbar">
                    <nav className="px-3 flex items-center h-11 gap-0.5 min-w-max">
                        <SideNavItems />
                    </nav>
                </header>
                <main className="flex-1 overflow-y-auto p-4 min-w-0 no-scrollbar bg-[var(--bg-dark)]">
                    <div className="max-w-7xl mx-auto">
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
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap active:scale-95 ${
                            active
                                ? 'bg-[var(--accent-blue)] text-white'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--foreground)]'
                        }`}
                    >
                        <Icon size={13} strokeWidth={active ? 2.5 : 2} />
                        <span>{label}</span>
                    </Link>
                );
            })}
        </>
    );
}
