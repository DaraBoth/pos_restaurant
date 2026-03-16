import TopNavigation from '@/components/layout/TopNavigation';

export default function POSLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="h-screen w-full flex flex-col bg-[var(--bg-dark)] text-[var(--text-primary)]">
            <TopNavigation />
            <main className="flex-1 overflow-hidden relative">
                {children}
            </main>
        </div>
    );
}
