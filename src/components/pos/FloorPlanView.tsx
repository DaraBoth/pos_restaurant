'use client';
import { useState, useEffect, useMemo } from 'react';
import { useOrder } from '@/providers/OrderProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { getTables } from '@/lib/api/tables';
import { getActiveOrderForTable, getOrderItems } from '@/lib/api/orders';
import type { FloorTable } from '@/types';
import {
    LayoutGrid, Users2, CheckCircle2, UtensilsCrossed, Clock,
    ShoppingBag, MapPin, Search, List, Grid3X3, X,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/providers/AuthProvider';

// ─── Zone colour palette ────────────────────────────────────────────────────
const ZONE_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    Main:    { bg: 'rgba(14,165,233,0.12)',  text: '#38bdf8', border: 'rgba(14,165,233,0.4)',  dot: '#38bdf8' },
    VIP:     { bg: 'rgba(168,85,247,0.12)',  text: '#c084fc', border: 'rgba(168,85,247,0.4)',  dot: '#c084fc' },
    Garden:  { bg: 'rgba(34,197,94,0.12)',   text: '#4ade80', border: 'rgba(34,197,94,0.4)',   dot: '#4ade80' },
    Outdoor: { bg: 'rgba(251,191,36,0.12)',  text: '#fbbf24', border: 'rgba(251,191,36,0.4)',  dot: '#fbbf24' },
    Bar:     { bg: 'rgba(239,68,68,0.12)',   text: '#f87171', border: 'rgba(239,68,68,0.4)',   dot: '#f87171' },
    Private: { bg: 'rgba(249,115,22,0.12)',  text: '#fb923c', border: 'rgba(249,115,22,0.4)',  dot: '#fb923c' },
};
function zoneColor(zone: string) {
    return ZONE_COLORS[zone] ?? { bg: 'rgba(107,114,128,0.12)', text: '#9ca3af', border: 'rgba(107,114,128,0.4)', dot: '#9ca3af' };
}

// ─── Table status styles ────────────────────────────────────────────────────
const STATUS = {
    available: { bg: 'rgba(34,197,94,0.13)',  border: 'rgba(34,197,94,0.5)',  text: '#22c55e', dot: '#22c55e', labelKey: 'tableStatusFree'    as const },
    busy:      { bg: 'rgba(249,115,22,0.13)', border: 'rgba(249,115,22,0.55)', text: '#f97316', dot: '#f97316', labelKey: 'tableStatusBusy'    as const },
    waiting:   { bg: 'rgba(234,179,8,0.13)',  border: 'rgba(234,179,8,0.6)',  text: '#eab308', dot: '#eab308', labelKey: 'tableStatusWaiting' as const },
} as const;

type ViewMode = 'grid' | 'list';

export default function FloorPlanView() {
    const { setTableId, clearOrder, tableId: activeTableId, setTakeout, setDirect, loadTableSession } = useOrder();
    const { t } = useLanguage();
    const { user } = useAuth();

    const [tables, setTables] = useState<FloorTable[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [search, setSearch] = useState('');
    const [activeZone, setActiveZone] = useState<string>('All');

    useEffect(() => {
        if (user?.restaurant_id) load();
    }, [user?.restaurant_id]);

    async function load() {
        setLoading(true);
        try { setTables(await getTables(user?.restaurant_id ?? undefined)); }
        catch (e) { console.error(e); }
        finally { setLoading(false); }
    }

    async function handleTableClick(table: FloorTable) {
        if (table.status !== 'available') await loadTableSession(table.name);
        else { clearOrder(); setTableId(table.name); }
    }

    const handleTakeout = () => { clearOrder(); setTakeout(true); };
    const handleDirectOrder = () => { clearOrder(); setDirect(true); };

    // ── Derived state ──────────────────────────────────────────────────────
    const counts = {
        available: tables.filter(t => t.status === 'available').length,
        busy:      tables.filter(t => t.status === 'busy').length,
        waiting:   tables.filter(t => t.status === 'waiting').length,
    };

    const zones = useMemo(() => {
        const zSet = new Set(tables.map(t => t.zone).filter(Boolean));
        return ['All', ...Array.from(zSet).sort()];
    }, [tables]);

    const hasMultipleZones = zones.length > 2; // 'All' + at least 2 real zones

    // Apply search + zone filter
    const filtered = useMemo(() => tables.filter(t => {
        const matchZone = activeZone === 'All' || t.zone === activeZone;
        const matchSearch = !search.trim() || t.name.toLowerCase().includes(search.trim().toLowerCase());
        return matchZone && matchSearch;
    }), [tables, activeZone, search]);

    // Group filtered tables by zone
    const grouped = useMemo(() => {
        const map = new Map<string, FloorTable[]>();
        filtered.forEach(t => {
            const z = t.zone || 'Main';
            if (!map.has(z)) map.set(z, []);
            map.get(z)!.push(t);
        });
        return map;
    }, [filtered]);

    const canManage = user?.role === 'admin' || user?.role === 'manager';

    // ── Shared card renderer ───────────────────────────────────────────────
    function TableCard({ table }: { table: FloorTable }) {
        const isCurrent = activeTableId === table.name;
        const s = isCurrent
            ? { bg: 'rgba(14,165,233,0.22)', border: '#0ea5e9', text: '#fff', dot: '#0ea5e9', labelKey: STATUS[table.status]?.labelKey ?? STATUS.available.labelKey }
            : STATUS[table.status] ?? STATUS.available;
        const zc = zoneColor(table.zone);

        return (
            <button
                key={table.id}
                onClick={() => handleTableClick(table)}
                className="rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all hover:-translate-y-0.5 hover:shadow-2xl active:scale-95 p-2 relative group"
                style={{ aspectRatio: '1/1.15', background: s.bg, border: `1.5px solid ${s.border}` }}
                title={`${table.name} — ${t(s.labelKey)}`}
            >
                {/* Zone dot */}
                <span
                    className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                    style={{ background: zc.dot }}
                    title={table.zone}
                />
                {/* Status icon */}
                {isCurrent ? (
                    <CheckCircle2 size={20} color={s.text} strokeWidth={2.5} />
                ) : table.status === 'available' ? (
                    <LayoutGrid size={18} color={s.text} strokeWidth={2} />
                ) : table.status === 'waiting' ? (
                    <Clock size={18} color={s.text} strokeWidth={2} />
                ) : (
                    <UtensilsCrossed size={18} color={s.text} strokeWidth={2} />
                )}
                <span className="text-xs font-black leading-none" style={{ color: s.text }}>{table.name}</span>
                <div className="flex items-center gap-0.5 opacity-70">
                    <Users2 size={9} color={s.text} strokeWidth={2} />
                    <span className="text-[9px] font-bold" style={{ color: s.text }}>{table.seat_count}</span>
                </div>
            </button>
        );
    }

    // ── Row renderer for list mode ─────────────────────────────────────────
    function TableRow({ table }: { table: FloorTable }) {
        const isCurrent = activeTableId === table.name;
        const s = isCurrent
            ? { bg: 'rgba(14,165,233,0.10)', border: '#0ea5e9', text: '#38bdf8', dot: '#0ea5e9', labelKey: STATUS[table.status]?.labelKey ?? STATUS.available.labelKey }
            : STATUS[table.status] ?? STATUS.available;

        return (
            <button
                onClick={() => handleTableClick(table)}
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-[var(--bg-elevated)] transition-all active:scale-[0.99] rounded-xl group text-left"
                style={{ background: isCurrent ? s.bg : undefined }}
            >
                {/* Status indicator */}
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${s.dot}20`, border: `1.5px solid ${s.dot}50` }}
                >
                    {isCurrent ? (
                        <CheckCircle2 size={18} style={{ color: s.dot }} strokeWidth={2.5} />
                    ) : table.status === 'available' ? (
                        <LayoutGrid size={16} style={{ color: s.dot }} strokeWidth={2} />
                    ) : table.status === 'waiting' ? (
                        <Clock size={16} style={{ color: s.dot }} strokeWidth={2} />
                    ) : (
                        <UtensilsCrossed size={16} style={{ color: s.dot }} strokeWidth={2} />
                    )}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                    <span className="text-sm font-black text-[var(--foreground)] block">{table.name}</span>
                    <span className="text-[10px] font-semibold" style={{ color: s.dot }}>{t(s.labelKey)}</span>
                </div>

                {/* Seat count */}
                <div className="flex items-center gap-1 text-[var(--text-secondary)]">
                    <Users2 size={11} strokeWidth={2} />
                    <span className="text-[11px] font-bold">{table.seat_count}</span>
                </div>

                {/* Current badge */}
                {isCurrent && (
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30">
                        Active
                    </span>
                )}
            </button>
        );
    }

    // ── Zone section wrapper ───────────────────────────────────────────────
    function ZoneSection({ zoneName, zoneTables }: { zoneName: string; zoneTables: FloorTable[] }) {
        const zc = zoneColor(zoneName);
        const showHeader = hasMultipleZones || activeZone !== 'All';

        return (
            <div className="mb-5">
                {showHeader && (
                    <div className="flex items-center gap-2 mb-3">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: zc.dot }} />
                        <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: zc.text }}>
                            {zoneName}
                        </span>
                        <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: zc.bg, color: zc.text, border: `1px solid ${zc.border}` }}
                        >
                            {zoneTables.length}
                        </span>
                        <div className="flex-1 h-px" style={{ background: zc.border }} />
                    </div>
                )}

                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                        {zoneTables.map(table => <TableCard key={table.id} table={table} />)}
                    </div>
                ) : (
                    <div className="space-y-0.5 rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--bg-card)]">
                        {zoneTables.map(table => <TableRow key={table.id} table={table} />)}
                    </div>
                )}
            </div>
        );
    }

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="h-full flex flex-col bg-[var(--bg-dark)]">

            {/* ── Top header bar ─────────────────────────────────────────── */}
            <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-card)] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[var(--accent-blue)]/15 border border-[var(--accent-blue)]/30">
                        <LayoutGrid size={16} className="text-[var(--accent-blue)]" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black text-[var(--foreground)] leading-none">{t('floorPlanTitle')}</h1>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{t('floorPlanSub')}</p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    {/* Takeout */}
                    <button
                        onClick={handleTakeout}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold hover:bg-emerald-500/20 transition-all active:scale-95"
                    >
                        <ShoppingBag size={13} strokeWidth={2.5} /><span>{t('takeout')}</span>
                    </button>
                    {/* Direct */}
                    <button
                        onClick={handleDirectOrder}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)] text-[11px] font-bold hover:bg-[var(--accent)]/20 transition-all active:scale-95"
                    >
                        <UtensilsCrossed size={13} strokeWidth={2.5} /><span>DIRECT</span>
                    </button>

                    {/* Status legend chips */}
                    {(['available', 'busy', 'waiting'] as const).map(k => (
                        <div key={k} className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)]">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS[k].dot }} />
                            <span className="text-[11px] font-bold text-[var(--text-secondary)]">{counts[k]}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Toolbar: Search · Zone filter · View toggle ─────────────── */}
            <div className="flex-shrink-0 px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-card)] flex items-center gap-2">
                {/* Search */}
                <div className="relative flex-1 max-w-xs">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search table..."
                        className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-xs font-semibold text-[var(--foreground)] placeholder-[var(--text-secondary)]/50 outline-none focus:border-[var(--accent-blue)] transition-colors"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--foreground)]"
                        >
                            <X size={11} />
                        </button>
                    )}
                </div>

                {/* Zone filter pills */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1">
                    {zones.map(z => {
                        const isActive = activeZone === z;
                        const zc = z === 'All'
                            ? { bg: 'rgba(14,165,233,0.15)', text: '#38bdf8', border: 'rgba(14,165,233,0.5)' }
                            : zoneColor(z);
                        const count = z === 'All' ? tables.length : tables.filter(t => t.zone === z).length;
                        return (
                            <button
                                key={z}
                                onClick={() => setActiveZone(z)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all active:scale-95"
                                style={{
                                    background: isActive ? zc.bg : 'transparent',
                                    color: isActive ? zc.text : 'var(--text-secondary)',
                                    border: `1.5px solid ${isActive ? zc.border : 'transparent'}`,
                                }}
                            >
                                {z !== 'All' && <MapPin size={8} />}
                                {z}
                                <span className="font-black opacity-60">{count}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Grid / List toggle */}
                <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] flex-shrink-0">
                    {([['grid', Grid3X3], ['list', List]] as [ViewMode, React.ElementType][]).map(([mode, Icon]) => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className="p-1.5 rounded-md transition-all"
                            style={{
                                background: viewMode === mode ? 'var(--accent-blue)' : 'transparent',
                                color: viewMode === mode ? '#fff' : 'var(--text-secondary)',
                            }}
                            title={mode === 'grid' ? 'Grid view' : 'List view'}
                        >
                            <Icon size={13} />
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Main content ───────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-3">
                {loading ? (
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                        {Array.from({ length: 16 }).map((_, i) => (
                            <div key={i} className="rounded-2xl animate-pulse bg-[var(--bg-elevated)]" style={{ aspectRatio: '1/1.15' }} />
                        ))}
                    </div>
                ) : tables.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                        <div className="flex flex-col items-center gap-3 opacity-40">
                            <LayoutGrid size={40} className="text-[var(--text-secondary)]" />
                            <p className="text-sm font-semibold text-[var(--text-secondary)]">{t('noTablesYet')}</p>
                        </div>
                        <button
                            onClick={handleTakeout}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 font-bold text-sm hover:bg-emerald-500/25 transition-all active:scale-95"
                        >
                            <ShoppingBag size={16} strokeWidth={2.5} /><span>{t('takeout')}</span>
                        </button>
                        {canManage && (
                            <Link href="/management?tab=tables" className="text-xs text-[var(--accent-blue)] hover:underline">
                                {t('addTablesHint')}
                            </Link>
                        )}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-2 opacity-50">
                        <Search size={28} className="text-[var(--text-secondary)]" />
                        <p className="text-sm font-semibold text-[var(--text-secondary)]">No tables match your search</p>
                        <button onClick={() => { setSearch(''); setActiveZone('All'); }} className="text-xs text-[var(--accent-blue)] hover:underline">Clear filters</button>
                    </div>
                ) : (
                    <>
                        {Array.from(grouped.entries()).map(([zoneName, zoneTables]) => (
                            <ZoneSection key={zoneName} zoneName={zoneName} zoneTables={zoneTables} />
                        ))}

                        {/* Legend footer */}
                        <div className="flex items-center gap-4 mt-2 px-1 justify-center">
                            {(Object.entries(STATUS) as [keyof typeof STATUS, typeof STATUS[keyof typeof STATUS]][]).map(([key, s]) => (
                                <div key={key} className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full" style={{ background: s.dot }} />
                                    <span className="text-[10px] font-semibold text-[var(--text-secondary)]">{t(s.labelKey)}</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}