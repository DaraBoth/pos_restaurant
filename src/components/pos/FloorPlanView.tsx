'use client';
import { useState, useEffect } from 'react';
import { useOrder } from '@/providers/OrderProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { getTables } from '@/lib/api/tables';
import { getActiveOrderForTable, getOrderItems } from '@/lib/api/orders';
import type { FloorTable } from '@/types';
import { LayoutGrid, Users2, CheckCircle2, Settings2, UtensilsCrossed, Clock, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/providers/AuthProvider';

// Status color maps - labels resolved via t() keys
const STATUS_KEYS = {
    available: { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.35)', text: '#86efac', dot: 'bg-green-500', labelKey: 'tableStatusFree'  as const },
    busy:      { bg: 'rgba(249,115,22,0.10)', border: 'rgba(249,115,22,0.45)', text: '#fdba74', dot: 'bg-orange-400', labelKey: 'tableStatusBusy'  as const },
    waiting:   { bg: 'rgba(234,179,8,0.10)',  border: 'rgba(234,179,8,0.50)',  text: '#fde047', dot: 'bg-yellow-400', labelKey: 'tableStatusWaiting' as const },
} as const;

export default function FloorPlanView() {
    const { setTableId, clearOrder, tableId: activeTableId, setTakeout, loadTableSession } = useOrder();
    const { t } = useLanguage();
    const { user } = useAuth();
    const [tables, setTables] = useState<FloorTable[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { 
        if (user?.restaurant_id) {
            load(); 
        }
    }, [user?.restaurant_id]);

    async function load() {
        setLoading(true);
        try {
            setTables(await getTables(user?.restaurant_id ?? undefined));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function handleTableClick(table: FloorTable) {
        if (table.status !== 'available') {
            // Table has an active order/session — resume it
            await loadTableSession(table.name);
        } else {
            clearOrder();
            setTableId(table.name);
        }
    }

    function handleTakeout() {
        clearOrder();
        setTakeout(true);
        // POSPage re-renders because isTakeout changed → shows product grid
    }

    const counts = {
        available: tables.filter(t => t.status === 'available').length,
        busy: tables.filter(t => t.status === 'busy').length,
        waiting: tables.filter(t => t.status === 'waiting').length,
    };
    const canManage = user?.role === 'admin' || user?.role === 'manager';
    const STATUS = STATUS_KEYS;

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
                            {t('floorPlanTitle')}
                        </h1>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                            {t('floorPlanSub')}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    {/* Takeout button */}
                    <button
                        onClick={handleTakeout}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all active:scale-95"
                    >
                        <ShoppingBag size={13} strokeWidth={2.5} />
                        <span>{t('takeout')}</span>
                    </button>

                    {/* Legend counts */}
                    {[
                        { key: 'available', count: counts.available, dot: 'bg-green-500' },
                        { key: 'busy', count: counts.busy, dot: 'bg-orange-400' },
                        { key: 'waiting', count: counts.waiting, dot: 'bg-yellow-400' },
                    ].map(({ key, count, dot }) => (
                        <div key={key} className="flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)]">
                            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                            <span className="text-[11px] font-bold text-[var(--text-secondary)]">{count}</span>
                        </div>
                    ))}
                    {/* Manage shortcut — admin/manager only */}
                    {/* {canManage && (
                        <Link
                            href="/management?TablesView"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors ml-1"
                            title={t('manageTables')}
                        >
                            <Settings2 size={11} />
                            <span>{t('manage')}</span>
                        </Link>
                    )} */}
                </div>
            </div>

            {/* Table Grid */}
            <div className="flex-1 p-3 overflow-y-auto no-scrollbar">
                {loading ? (
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                        {Array.from({ length: 16 }).map((_, i) => (
                            <div key={i} className="rounded-2xl animate-pulse bg-[var(--bg-elevated)]" style={{ aspectRatio: '1/1.15' }} />
                        ))}
                    </div>
                ) : tables.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                        {/* No tables — show takeout prominently */}
                        <div className="flex flex-col items-center gap-3 opacity-40">
                            <LayoutGrid size={40} className="text-[var(--text-secondary)]" />
                            <p className="text-sm font-semibold text-[var(--text-secondary)]">
                                {t('noTablesYet')}
                            </p>
                        </div>
                        <button
                            onClick={handleTakeout}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 font-bold text-sm hover:bg-emerald-500/25 transition-all active:scale-95"
                        >
                            <ShoppingBag size={16} strokeWidth={2.5} />
                            <span>{t('takeout')}</span>
                        </button>
                        {canManage && (
                            <Link href="/management?tab=tables" className="text-xs text-[var(--accent-blue)] hover:underline">
                                {t('addTablesHint')}
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                        {tables.map(table => {
                            const isCurrent = activeTableId === table.name;
                            const s = isCurrent
                                ? { bg: 'rgba(14,165,233,0.22)', border: '#0ea5e9', text: '#fff' }
                                : STATUS[table.status] || STATUS.available;

                            return (
                                <button
                                    key={table.id}
                                    onClick={() => handleTableClick(table)}
                                    className="rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-95 p-2"
                                    style={{
                                        aspectRatio: '1/1.15',
                                        background: s.bg,
                                        border: `1.5px solid ${s.border}`,
                                    }}
                                >
                                    {/* Icon */}
                                    {isCurrent ? (
                                        <CheckCircle2 size={20} color={s.text} strokeWidth={2.5} />
                                    ) : table.status === 'available' ? (
                                        <LayoutGrid size={18} color={s.text} strokeWidth={2} />
                                    ) : table.status === 'waiting' ? (
                                        <Clock size={18} color={s.text} strokeWidth={2} />
                                    ) : (
                                        <UtensilsCrossed size={18} color={s.text} strokeWidth={2} />
                                    )}

                                    {/* Table name */}
                                    <span className="text-xs font-black leading-none" style={{ color: s.text }}>
                                        {table.name}
                                    </span>

                                    {/* Seat count */}
                                    <div className="flex items-center gap-0.5 opacity-70">
                                        <Users2 size={9} color={s.text} strokeWidth={2} />
                                        <span className="text-[9px] font-bold" style={{ color: s.text }}>
                                            {table.seat_count}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Legend */}
                {tables.length > 0 && (
                    <div className="flex items-center gap-4 mt-4 px-1 justify-center">
                        {(Object.entries(STATUS) as [keyof typeof STATUS, typeof STATUS[keyof typeof STATUS]][]).map(([key, s]) => (
                            <div key={key} className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                                <span className="text-[10px] font-semibold text-[var(--text-secondary)]">
                                    {t(s.labelKey)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}