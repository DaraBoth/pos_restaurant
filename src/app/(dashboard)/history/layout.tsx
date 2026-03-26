

export default function HistoryLayout({ children }: { children: React.ReactNode }) {
    return (
        <main className="flex-1 overflow-y-auto container-snap">
            {children}
        </main>
    );
}
