'use client';
export default function ManagementDashboard() {
    return (
        <div className="max-w-4xl mx-auto auto-fade-in relative z-10">
            <h1 className="text-3xl font-bold mb-6">Management Dashboard</h1>
            <div className="grid grid-cols-2 gap-6">
                <div className="glass p-6 rounded-2xl border border-[var(--border)]">
                    <h2 className="text-xl font-semibold mb-2 text-[var(--accent)]">Welcome</h2>
                    <p className="text-[var(--text-secondary)]">Select an option from the sidebar to manage your POS system data. Changes made here sync instantly with your local SQLite database.</p>
                </div>
            </div>
        </div>
    );
}
