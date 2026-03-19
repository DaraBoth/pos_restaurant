'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOrder } from '@/providers/OrderProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { getOrders, Order, getTables, FloorTable, createTable, getActiveOrderForTable, getOrderItems } from '@/lib/tauri-commands';
import { LayoutGrid, Plus, Users2, CheckCircle2 } from 'lucide-react';

interface CombinedTable {
    id: string;
    dbId: string;
    status: 'free' | 'busy';
    orderId?: string;
    itemCount?: number;
}

export default function TablesPage() {
    const router = useRouter();
    const { setTableId, clearOrder, tableId: activeTableId, setOrderId, setItems } = useOrder();
    const { lang } = useLanguage();
    const [tableData, setTableData] = useState<CombinedTable[]>([]);
    const [customTable, setCustomTable] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadTables(); }, []);

    async function loadTables() {
        setLoading(true);
        try {
            const dbTables: FloorTable[] = await getTables();
            const openOrders: Order[] = await getOrders('open');
            const occupiedMap = new Map<string, { orderId: string; itemCount: number }>();
            openOrders.forEach(o => {
                if (o.table_id) occupiedMap.set(o.table_id, { orderId: o.id, itemCount: 0 });
            });

            const combined: CombinedTable[] = dbTables.map(t => {
                const info = occupiedMap.get(t.name);
                return { id: t.name, dbId: t.id, status: info ? 'busy' : 'free', orderId: info?.orderId };
            });
            setTableData(combined);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function handleTableSelect(table: CombinedTable) {
        if (table.status === 'busy') {
            try {
                const activeOrder = await getActiveOrderForTable(table.id);
                if (activeOrder) {
                    const existingItems = await getOrderItems(activeOrder.id);
                    setOrderId(activeOrder.id);
                    setItems(existingItems);
                }
            } catch (error) {
                console.error('Failed to load active table order', error);
            }
            setTableId(table.id);
        } else {
            clearOrder();
            setTableId(table.id);
        }
        router.push('/pos');
    }

    async function handleAddTable() {
        const t = customTable.trim().toUpperCase();
        if (!t) return;
        try {
            await createTable(t);
            setCustomTable('');
            await loadTables();
        } catch (e) {
            console.error('Failed to create table', e);
        }
    }

    const freeCount = tableData.filter(t => t.status === 'free').length;
    const busyCount = tableData.filter(t => t.status === 'busy').length;

    return (
        <div className="h-full overflow-y-auto bg-[var(--bg-dark)] flex flex-col">
            {/* Compact Header */}
            <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-card)] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[var(--accent-blue)]/15 border border-[var(--accent-blue)]/30">
                        <LayoutGrid size={16} className="text-[var(--accent-blue)]" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black text-[var(--foreground)] leading-none">
                            {lang === 'km' ? 'ážáž»' : 'Floor Plan'}
                        </h1>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                            {lang === 'km' ? 'áž‡áŸ’ážšáž¾ážŸážáž»' : 'Select a table to open'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        <span className="text-[11px] font-bold text-green-400">{freeCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                        <Users2 size={11} className="text-blue-400" />
                        <span className="text-[11px] font-bold text-blue-400">{busyCount}</span>
                    </div>
                </div>
            </div>

            {/* Table Grid */}
            <div className="flex-1 p-3 overflow-y-auto">
                {loading ? (
                    <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 xl:grid-cols-10 gap-2">
                        {Array.from({ length: 20 }).map((_, i) => (
                            <div key={i} className="rounded-xl animate-pulse bg-[var(--bg-elevated)]" style={{ aspectRatio: '1/1' }} />
                        ))}
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
                                    onClick={() => handleTableSelect(table)}
                                    title={isFree ? (lang === 'km' ? 'áž‘áŸ†áž“áŸážš' : 'Free') : (lang === 'km' ? 'áž˜áž¶áž“áž—áŸ’áž‰áŸ€ážœ' : 'Occupied')}
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

                        {/* Add New Table */}
                        <div className="rounded-xl aspect-square border-2 border-dashed border-[var(--border)] hover:border-[var(--accent)]/40 transition-all flex flex-col bg-[var(--bg-elevated)] overflow-hidden group">
                            <input
                                type="text"
                                value={customTable}
                                onChange={e => setCustomTable(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddTable()}
                                placeholder={lang === 'km' ? 'ážáŸ’áž˜áž¸' : 'NEW'}
                                className="w-full text-center bg-transparent outline-none flex-1 text-[10px] font-black uppercase text-[var(--foreground)] placeholder-[var(--text-secondary)]/30 tracking-widest"
                            />
                            <button
                                onClick={handleAddTable}
                                disabled={!customTable.trim()}
                                className="w-full py-1.5 bg-[var(--bg-card)] hover:bg-[var(--accent)] hover:text-white font-black text-[10px] uppercase tracking-widest transition-all border-t border-[var(--border)] flex items-center justify-center gap-0.5"
                            >
                                <Plus size={10} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
