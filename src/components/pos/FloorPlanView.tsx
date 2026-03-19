'use client';
import { useState, useEffect } from 'react';
import { useOrder } from '@/providers/OrderProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { getOrders, getTables, getActiveOrderForTable, getOrderItems } from '@/lib/tauri-commands';
import type { FloorTable, Order } from '@/types';
import { LayoutGrid, Users2, CheckCircle2, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/providers/AuthProvider';

interface CombinedTable {
    id: string;
    dbId: string;
    status: 'free' | 'busy';
}

export default function FloorPlanView() {
    const { setTableId, clearOrder, tableId: activeTableId, setOrderId, setItems } = useOrder();
    const { lang } = useLanguage();
    const { user } = useAuth();
    const [tableData, setTableData] = useState<CombinedTable[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadTables(); }, []);

    async function loadTables() {
        setLoading(true);
        try {
            const [dbTables, openOrders]: [FloorTable[], Order[]] = await Promise.all([
                getTables(),
                getOrders('open'),
            ]);
            const occupiedSet = new Map<string, string>();
            openOrders.forEach(o => { if (o.table_id) occupiedSet.set(o.table_id, o.id); });
            setTableData(dbTables.map(t => ({
                id: t.name,
                dbId: t.id,
                status: occupiedSet.has(t.name) ? 'busy' : 'free',
            })));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function handleTableClick(table: CombinedTable) {
        if (table.status === 'busy') {
            try {
                const activeOrder = await getActiveOrderForTable(table.id);
                if (activeOrder) {
                    const existingItems = await getOrderItems(activeOrder.id);
                    setOrderId(activeOrder.id);
                    setItems(existingItems);
                }
            } catch (e) {
                console.error(e);
            }
            setTableId(table.id);
        } else {
            clearOrder();
            setTableId(table.id);
        }
        // POSPage re-renders automatically because tableId in context changed
    }

    const freeCount = tableData.filter(t => t.status === 'free').length;
    const busyCount = tableData.filter(t => t.status === 'busy').length;
    const canManage = user?.role === 'admin' || user?.role === 'manager';

    return (
        <div className="h-full flex flex-col bg-[var(--bg-dark)]">
            {/* Header */}
            <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-card)] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[var(--accent-blue)]/15 border border-[var(--accent-blue)]/30">
                        <LayoutGrid size={16} className="text-[var(--accent-blue)]" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black text-[var(--foreground)] leading-none">
                            {lang === 'km' ? 'ផែនការជាន់' : 'Floor Plan'}
                        </h1>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                            {lang === 'km' ? 'ជ្រើសរើសតុ' : 'Tap a table to begin ordering'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Free count */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        <span className="text-[11px] font-bold text-green-400">{freeCount}</span>
                    </div>
                    {/* Busy count */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                        <Users2 size={11} className="text-blue-400" />
                        <span className="text-[11px] font-bold text-blue-400">{busyCount}</span>
                    </div>
                    {/* Manage tables shortcut — admin/manager only */}
                    {canManage && (
                        <Link
                            href="/management/tables"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
                            title={lang === 'km' ? 'គ្រប់គ្រងតុ' : 'Manage tables'}
                        >
                            <Settings2 size={11} />
                            <span>{lang === 'km' ? 'គ្រប់គ្រង' : 'Manage'}</span>
                        </Link>
                    )}
                </div>
            </div>

            {/* Table Grid */}
            <div className="flex-1 p-3 overflow-y-auto no-scrollbar">
                {loading ? (
                    <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 xl:grid-cols-10 gap-2">
                        {Array.from({ length: 20 }).map((_, i) => (
                            <div key={i} className="rounded-xl animate-pulse bg-[var(--bg-elevated)]" style={{ aspectRatio: '1/1' }} />
                        ))}
                    </div>
                ) : tableData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-3 opacity-40">
                        <LayoutGrid size={40} className="text-[var(--text-secondary)]" />
                        <p className="text-sm font-semibold text-[var(--text-secondary)]">
                            {lang === 'km' ? 'មិនទាន់មានតុ' : 'No tables yet'}
                        </p>
                        {canManage && (
                            <Link
                                href="/management/tables"
                                className="text-xs text-[var(--accent-blue)] hover:underline"
                            >
                                {lang === 'km' ? 'បន្ថែមតុ' : 'Add tables in Management → Tables'}
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 xl:grid-cols-10 gap-2">
                        {tableData.map(table => {
                            const isCurrent = activeTableId === table.id;
                            const isFree = table.status === 'free';

                            let bg = '#141e28', border = 'rgba(148,163,184,0.2)', textColor = '#94a3b8';
                            if (isCurrent) { bg = 'rgba(14,165,233,0.22)'; border = '#0ea5e9'; textColor = '#fff'; }
                            else if (!isFree) { bg = 'rgba(59,130,246,0.12)'; border = 'rgba(59,130,246,0.5)'; textColor = '#93c5fd'; }
                            else { bg = 'rgba(34,197,94,0.08)'; border = 'rgba(34,197,94,0.3)'; textColor = '#86efac'; }

                            return (
                                <button
                                    key={table.id}
                                    onClick={() => handleTableClick(table)}
                                    title={isFree
                                        ? (lang === 'km' ? 'ទំនេរ' : 'Free')
                                        : (lang === 'km' ? 'មានភ្ញៀវ' : 'Occupied')}
                                    className="rounded-xl flex flex-col items-center justify-center gap-1 aspect-square transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-95"
                                    style={{ background: bg, border: `1.5px solid ${border}` }}
                                >
                                    {isCurrent ? (
                                        <CheckCircle2 size={18} color={textColor} strokeWidth={2.5} />
                                    ) : isFree ? (
                                        <LayoutGrid size={16} color={textColor} strokeWidth={2} />
                                    ) : (
                                        <Users2 size={16} color={textColor} strokeWidth={2} />
                                    )}
                                    <span className="text-[11px] font-bold" style={{ color: textColor }}>{table.id}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
