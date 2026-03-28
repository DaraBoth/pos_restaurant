// Server component — no client JS cost. Provides layout shell for management views.
export default function ManagementLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex-1 flex flex-col overflow-y-auto min-h-0 bg-[var(--bg-dark)]">
            {children}
        </div>
    );
}
