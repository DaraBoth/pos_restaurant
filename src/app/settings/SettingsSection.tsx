'use client';

export default function SettingsSection({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <section className="space-y-6">
            <header className="space-y-1 pb-4 border-b border-[var(--border)]">
                <h1 className="text-lg font-black text-[var(--foreground)] tracking-tight">{title}</h1>
                {description && (
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{description}</p>
                )}
            </header>
            {children}
        </section>
    );
}
