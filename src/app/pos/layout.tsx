import SidebarNav from '@/components/layout/SidebarNav';

export default function POSLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="h-screen w-full flex flex-row bg-black text-white">
            <SidebarNav />
            <main className="flex-1 overflow-hidden relative flex flex-col">
                {children}
            </main>
        </div>
    );
}
