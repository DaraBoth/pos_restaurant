'use client';
import SidebarNav from '@/components/layout/SidebarNav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="h-screen w-full flex flex-row bg-[var(--background)] text-[var(--foreground)]">
            <SidebarNav />
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
                {children}
            </div>
        </div>
    );
}
