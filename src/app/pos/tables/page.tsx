'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOrder } from '@/contexts/OrderContext';
import { getOrders, Order, getTables, FloorTable, createTable } from '@/lib/tauri-commands';
import { TableProperties, Plus, Users, CheckCircle } from 'lucide-react';

interface CombinedTable {
    id: string;
    dbId: string;
    status: 'free' | 'occupied';
    orderId?: string;
}

export default function TablesPage() {
    const router = useRouter();
    const { setTableId, clearOrder, tableId: activeTableId } = useOrder();
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
                    status: orderId ? 'occupied' : 'free',
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

    function handleTableSelect(table: CombinedTable) {
        if (table.status === 'occupied') {
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
    const occupiedCount = tableData.filter(t => t.status === 'occupied').length;

    return (
        <div className="h-full overflow-y-auto bg-[#0f1115] flex flex-col items-center">
            <div className="w-full max-w-6xl px-8 py-10 space-y-8 animate-fade-in">

                {/* Header & Stats */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-[#181a20] p-6 rounded-2xl border border-white/5 shadow-sm">
                    <div>
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[var(--accent)]/10">
                                <TableProperties size={24} className="text-[var(--accent)]" strokeWidth={2} />
                            </div>
                            <h1 className="text-3xl font-bold text-white tracking-tight">Floor Plan</h1>
                        </div>
                        <p className="text-[var(--text-secondary)] font-medium md:ml-16">
                            Select a table to start or continue an active order.
                        </p>
                    </div>

                    <div className="flex gap-4">
                        <div className="px-5 py-3 rounded-xl min-w-[100px] border border-white/5 bg-[#0f1115]">
                            <p className="text-2xl font-bold font-mono text-green-500">{freeCount}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mt-0.5">Free</p>
                        </div>
                        <div className="px-5 py-3 rounded-xl min-w-[100px] border border-white/5 bg-[#0f1115]">
                            <p className="text-2xl font-bold font-mono text-[var(--accent)]">{occupiedCount}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mt-0.5">Occupied</p>
                        </div>
                    </div>
                </div>

                {/* Table Grid */}
                <div className="bg-[#181a20] p-6 rounded-2xl border border-white/5 shadow-sm">
                    {loading ? (
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-4">
                            {Array.from({ length: 16 }).map((_, i) => (
                                <div key={i} className="rounded-xl aspect-square animate-pulse bg-white/5" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-4">
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
                                        bg: 'rgba(59, 130, 246, 0.15)', // Blue accent for occupied
                                        border: 'rgba(59, 130, 246, 0.4)',
                                        text: 'var(--accent)'
                                    };
                                } else {
                                    // Free table
                                    styleProps = {
                                        bg: 'rgba(16, 185, 129, 0.05)',
                                        border: 'rgba(16, 185, 129, 0.2)',
                                        text: '#10b981' // Green
                                    };
                                }

                                return (
                                    <button
                                        key={table.id}
                                        onClick={() => handleTableSelect(table)}
                                        className="rounded-xl flex flex-col items-center justify-center gap-2 aspect-square transition-all hover:-translate-y-0.5 hover:shadow-lg"
                                        style={{
                                            background: styleProps.bg,
                                            border: `1px solid ${styleProps.border}`,
                                        }}
                                    >
                                        {isCurrent ? (
                                            <CheckCircle size={22} color={styleProps.text} />
                                        ) : isFree ? (
                                            <TableProperties size={22} color={styleProps.text} />
                                        ) : (
                                            <Users size={22} color={styleProps.text} />
                                        )}
                                        <span className="text-xs font-bold tracking-wide" style={{ color: styleProps.text }}>
                                            {table.id}
                                        </span>
                                    </button>
                                );
                            })}

                            {/* Add New Table Button */}
                            <div className="rounded-xl aspect-square border border-dashed border-white/20 hover:border-white/40 transition-colors flex flex-col bg-[#0f1115]">
                                <input
                                    type="text"
                                    value={customTable}
                                    onChange={e => setCustomTable(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddTable()}
                                    placeholder="NEW..."
                                    className="w-full text-center bg-transparent outline-none flex-1 text-xs font-bold uppercase text-white placeholder-white/30"
                                />
                                <button
                                    onClick={handleAddTable}
                                    disabled={!customTable.trim()}
                                    className="w-full py-2 bg-white/5 hover:bg-[var(--accent)] hover:text-white font-bold text-[10px] uppercase transition-colors rounded-b-xl"
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
