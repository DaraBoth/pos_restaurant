'use client';
import SidebarNav from '@/components/layout/SidebarNav';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
        <div className="h-screen w-full flex flex-row bg-[#0f1115] text-white">
            <SidebarNav />
            <div className="flex-1 flex overflow-hidden min-h-0">
                {/* Management Sub-Sidebar */}
                <aside className="w-64 flex-shrink-0 flex flex-col bg-[#181a20] border-r border-white/5 relative z-10 shadow-sm">
                    <div className="p-6 pb-2">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-4">
                            Management Menu
                        </h2>
                    </div>
                    <div className="px-4 pb-6 space-y-1.5 flex-1 overflow-y-auto container-snap">
                        <SideNavItems />
                    </div>
                    
                    {/* Version Badge Footer */}
                    <div className="p-5 border-t border-white/5 bg-[#181a20]">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center font-bold text-xs">
                                V1
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-white">KH POS Core</p>
                                <p className="text-xs font-semibold text-[var(--text-secondary)]">Management</p>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto p-8 lg:p-12 min-w-0 container-snap relative bg-[#0f1115]">
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
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group ${
                            active 
                                ? 'bg-[var(--accent)] text-white shadow-sm' 
                                : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-white'
                        }`}
                    >
                        <Icon 
                            size={18} 
                            strokeWidth={active ? 2.5 : 2} 
                            className={`${active ? 'text-white' : 'group-hover:text-white transition-colors'}`} 
                        />
                        <span>{label}</span>
                    </Link>
                );
            })}
        </>
    );
}
