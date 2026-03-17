import TopNavigation from '@/components/layout/TopNavigation';

export default function HistoryLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="h-screen w-full flex flex-col" style={{ background: 'var(--bg-dark)', color: 'var(--text-primary)' }}>
            <TopNavigation />
            <main className="flex-1 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}
