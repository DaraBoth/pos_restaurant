import TopNavigation from '@/components/layout/TopNavigation';
import Link from 'next/link';

export default function ManagementLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="h-screen w-full flex flex-col bg-[var(--bg-dark)] text-[var(--text-primary)]">
            <TopNavigation />
            <div className="flex-1 flex overflow-hidden">
                {/* Management Sidebar */}
                <aside className="w-64 bg-[var(--bg-card)] border-r border-[var(--border)] p-4 flex flex-col gap-2">
                    <Link href="/management" className="px-4 py-3 rounded-xl hover:bg-[var(--bg-elevated)] transition-colors font-medium">
                        Dashboard
                    </Link>
                    <Link href="/management/products" className="px-4 py-3 rounded-xl hover:bg-[var(--bg-elevated)] transition-colors font-medium">
                        Products & Categories
                    </Link>
                    <Link href="/management/users" className="px-4 py-3 rounded-xl hover:bg-[var(--bg-elevated)] transition-colors font-medium">
                        Users & Roles
                    </Link>
                    <Link href="/management/exchange-rate" className="px-4 py-3 rounded-xl hover:bg-[var(--bg-elevated)] transition-colors font-medium">
                        Exchange Rates
                    </Link>
                    <Link href="/management/orders" className="px-4 py-3 rounded-xl hover:bg-[var(--bg-elevated)] transition-colors font-medium">
                        Order History
                    </Link>
                </aside>

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto p-8 relative">
                    {children}
                </main>
            </div>
        </div>
    );
}
