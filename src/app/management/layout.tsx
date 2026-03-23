'use client';
import SidebarNav from '@/components/layout/SidebarNav';

export default function ManagementLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="h-screen w-full flex flex-row bg-[var(--bg-dark)] text-[var(--foreground)]">
            <SidebarNav />
            <div className="flex-1 flex flex-col overflow-y-auto min-h-0">
                {children}
            </div>
        </div>
    );
}
