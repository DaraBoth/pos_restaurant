'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOrder } from '@/contexts/OrderContext';
import { getOrders, Order, getTables, FloorTable, createTable, getActiveOrderForTable, getOrderItems } from '@/lib/tauri-commands';
import { TableProperties, Plus, Users, CheckCircle } from 'lucide-react';

interface CombinedTable {
    id: string;
    dbId: string;
    status: 'free' | 'busy';
    orderId?: string;
}

export default function TablesPage() {
    const router = useRouter();
    const { setTableId, clearOrder, tableId: activeTableId, setOrderId, setItems } = useOrder();
    const [tableData, setTableData] = useState<CombinedTable[]>([]);
    const [customTable, setCustomTable] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTables();
    }, []);

    async function loadTables() {
        setLoading(true);
        try {
            // 1. Fetch persistent tables from DB
            const dbTables: FloorTable[] = await getTables();
            
            // 2. Fetch open orders to find which tables are occupied
            const openOrders: Order[] = await getOrders('open');
            const occupiedMap = new Map<string, string>(); // tableName -> orderId
            openOrders.forEach(o => {
                if (o.table_id) occupiedMap.set(o.table_id, o.id);
            });

            // 3. Combine
            const combined: CombinedTable[] = dbTables.map(t => {
                const orderId = occupiedMap.get(t.name);
                return {
                    id: t.name,
                    dbId: t.id,
                    status: orderId ? 'busy' : 'free',
                    orderId,
                };
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
            router.push('/pos');
            return;
        }
        clearOrder();
        setTableId(table.id);
        router.push('/pos');
    }

    async function handleAddTable() {
        const t = customTable.trim().toUpperCase();
        if (!t) return;
        
        try {
            // Create in the backend persistent store
            await createTable(t);
            setCustomTable('');
            await loadTables();
        } catch (e) {
            console.error('Failed to create table', e);
            alert('Could not create table. Name might already exist.');
        }
    }

    const freeCount = tableData.filter(t => t.status === 'free').length;
    const occupiedCount = tableData.filter(t => t.status === 'busy').length;

    return (
        <div className="h-full overflow-y-auto bg-[var(--background)] flex flex-col items-center">
            <div className="w-full max-w-6xl px-[var(--space-unit)] py-10 space-y-8 animate-fade-in">

                {/* Header & Stats */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-[var(--bg-card)] p-[var(--space-unit)] rounded-[2.5rem] border border-[var(--border)] shadow-sm">
                    <div>
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-[var(--accent)]/10">
                                <TableProperties size={28} className="text-[var(--accent)]" strokeWidth={2.5} />
                            </div>
                            <h1 className="text-[var(--text-4xl)] font-black text-[var(--foreground)] tracking-tight uppercase">Floor Plan</h1>
                        </div>
                        <p className="text-[var(--text-secondary)] font-medium md:ml-16 text-[var(--text-sm)]">
                            Select a table to start or continue an active order.
                        </p>
                    </div>

                    <div className="flex gap-4">
                        <div className="px-5 py-4 rounded-2xl min-w-[120px] border border-[var(--border)] bg-[var(--bg-elevated)]">
                            <p className="text-[var(--text-3xl)] font-black font-mono text-green-600 tracking-tighter leading-none">{freeCount}</p>
                            <p className="text-[var(--text-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] mt-1.5 opacity-60">Free</p>
                        </div>
                        <div className="px-5 py-4 rounded-2xl min-w-[120px] border border-[var(--border)] bg-[var(--bg-elevated)]">
                            <p className="text-[var(--text-3xl)] font-black font-mono text-[var(--accent)] tracking-tighter leading-none">{occupiedCount}</p>
                            <p className="text-[var(--text-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] mt-1.5 opacity-60">Occupied</p>
                        </div>
                    </div>
                </div>

                {/* Table Grid */}
                <div className="bg-[var(--bg-card)] p-[var(--space-unit)] rounded-[2.5rem] border border-[var(--border)] shadow-sm">
                    {loading ? (
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-[calc(var(--space-unit)*0.75)]">
                            {Array.from({ length: 16 }).map((_, i) => (
                                <div key={i} className="rounded-2xl animate-pulse bg-[var(--bg-elevated)]" style={{ aspectRatio: '1/1' }} />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-[calc(var(--space-unit)*0.75)]">
                            {tableData.map(table => {
                                const isCurrent = activeTableId === table.id;
                                const isFree = table.status === 'free';

                                let styleProps = {
                                    bg: 'rgba(255,255,255,0.02)',
                                    border: 'rgba(255,255,255,0.05)',
                                    text: 'var(--text-secondary)'
                                };

                                if (isCurrent) {
                                    styleProps = {
                                        bg: 'var(--accent)',
                                        border: 'transparent',
                                        text: '#ffffff'
                                    };
                                } else if (!isFree) {
                                    styleProps = {
                                        bg: 'rgba(59, 130, 246, 0.08)', // Soft blue for occupied
                                        border: 'rgba(59, 130, 246, 0.2)',
                                        text: '#2563eb'
                                    };
                                } else {
                                    // Free table
                                    styleProps = {
                                        bg: 'rgba(16, 185, 129, 0.06)',
                                        border: 'rgba(16, 185, 129, 0.15)',
                                        text: '#059669' // Green-600
                                    };
                                }

                                return (
                                    <button
                                        key={table.id}
                                        onClick={() => handleTableSelect(table)}
                                        className="rounded-2xl flex flex-col items-center justify-center gap-2 aspect-square transition-all hover:-translate-y-1 hover:shadow-xl group"
                                        style={{
                                            background: styleProps.bg,
                                            border: `2px solid ${styleProps.border}`,
                                        }}
                                    >
                                        {isCurrent ? (
                                            <CheckCircle size={26} color={styleProps.text} strokeWidth={3} />
                                        ) : isFree ? (
                                            <TableProperties size={26} color={styleProps.text} strokeWidth={2.5} />
                                        ) : (
                                            <Users size={26} color={styleProps.text} strokeWidth={2.5} />
                                        )}
                                        <span className="text-[var(--text-xs)] font-black tracking-[0.1em]" style={{ color: styleProps.text }}>
                                            {table.id}
                                        </span>
                                    </button>
                                );
                            })}

                            {/* Add New Table Button */}
                            <div className="rounded-2xl aspect-square border-2 border-dashed border-[var(--border)] hover:border-[var(--accent)]/40 transition-all flex flex-col bg-[var(--bg-elevated)] overflow-hidden group">
                                <input
                                    type="text"
                                    value={customTable}
                                    onChange={e => setCustomTable(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddTable()}
                                    placeholder="NEW"
                                    className="w-full text-center bg-transparent outline-none flex-1 text-[var(--text-xs)] font-black uppercase text-[var(--foreground)] placeholder-[var(--text-secondary)]/30 tracking-widest"
                                />
                                <button
                                    onClick={handleAddTable}
                                    disabled={!customTable.trim()}
                                    className="w-full py-3 bg-[var(--bg-card)] hover:bg-[var(--accent)] hover:text-white font-black text-[var(--text-xs)] uppercase tracking-widest transition-all border-t border-[var(--border)] group-hover:border-[var(--accent)]/30"
                                >
                                    CREATE
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
