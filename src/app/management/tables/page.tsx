'use client';
import { useState, useEffect, useMemo } from 'react';
import { Trash2, Plus, LayoutGrid, Users2, MapPin, Tag } from 'lucide-react';
import { getTables, createTable, deleteTable } from '@/lib/tauri-commands';
import type { FloorTable } from '@/types';
import { useLanguage } from '@/providers/LanguageProvider';
import { useAuth } from '@/providers/AuthProvider';

const ZONE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    Main:    { bg: 'rgba(14,165,233,0.12)',  text: '#38bdf8', border: 'rgba(14,165,233,0.35)'  },
    VIP:     { bg: 'rgba(168,85,247,0.12)',  text: '#c084fc', border: 'rgba(168,85,247,0.35)'  },
    Garden:  { bg: 'rgba(34,197,94,0.12)',   text: '#4ade80', border: 'rgba(34,197,94,0.35)'   },
    Outdoor: { bg: 'rgba(251,191,36,0.12)',  text: '#fbbf24', border: 'rgba(251,191,36,0.35)'  },
    Bar:     { bg: 'rgba(239,68,68,0.12)',   text: '#f87171', border: 'rgba(239,68,68,0.35)'   },
    Private: { bg: 'rgba(249,115,22,0.12)',  text: '#fb923c', border: 'rgba(249,115,22,0.35)'  },
};

function getZoneStyle(zone: string) {
    return ZONE_COLORS[zone] ?? { bg: 'rgba(107,114,128,0.12)', text: '#9ca3af', border: 'rgba(107,114,128,0.35)' };
}

const PRESET_ZONES = ['Main', 'VIP', 'Garden', 'Outdoor', 'Bar', 'Private'];

export default function TablesManagementPage() {
    const { t } = useLanguage();
    const { user } = useAuth();
    const [tables, setTables] = useState<FloorTable[]>([]);
    const [newName, setNewName] = useState('');
    const [seatCount, setSeatCount] = useState(4);
    const [zone, setZone] = useState('Main');
    const [filterZone, setFilterZone] = useState<string>('All');
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => { load(); }, []);

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

    async function handleCreate() {
        const name = newName.trim().toUpperCase();
        if (!name) return;
        const zoneName = zone.trim() || 'Main';
        if (tables.some(t => t.name === name)) {
            setError(t('tableNameExists'));
            return;
        }
        setCreating(true);
        setError('');
        try {
            await createTable(name, seatCount, zoneName, user?.restaurant_id ?? undefined);
            setNewName('');
            // Keep zone so user can bulk-add to same zone
            await load();
        } catch (e) {
            setError(t('failedCreateTable'));
            console.error(e);
        } finally {
            setCreating(false);
        }
    }

    async function handleDelete(table: FloorTable) {
        if (table.status !== 'available') {
            setError(`${t('cannotDeleteActive')}: ${table.name}`);
            return;
        }
        try {
            await deleteTable(table.id, user?.restaurant_id || '');
            await load();
        } catch (e) {
            setError(t('failedDeleteTable'));
            console.error(e);
        }
    }

    // All unique zones from existing tables + presets
    const existingZones = useMemo(() => {
        const zSet = new Set(tables.map(t => t.zone).filter(Boolean));
        return Array.from(zSet).sort();
    }, [tables]);

    const allZoneTabs = useMemo(() => {
        const zSet = new Set(['All', ...existingZones]);
        return Array.from(zSet);
    }, [existingZones]);

    const filteredTables = useMemo(() =>
        filterZone === 'All' ? tables : tables.filter(t => t.zone === filterZone),
        [tables, filterZone]
    );

    // Group filtered tables by zone for the list view
    const tablesByZone = useMemo(() => {
        const map = new Map<string, FloorTable[]>();
        filteredTables.forEach(t => {
            const z = t.zone || 'Main';
            if (!map.has(z)) map.set(z, []);
            map.get(z)!.push(t);
        });
        return map;
    }, [filteredTables]);

    return (
        <div className="space-y-5">
            {/* Page header */}
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--accent-blue)]/15 border border-[var(--accent-blue)]/30">
                    <LayoutGrid size={18} className="text-[var(--accent-blue)]" />
                </div>
                <div>
                    <h1 className="text-lg font-black text-[var(--foreground)] leading-none">
                        {t('tableManagement')}
                    </h1>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {t('addRemoveTables')}
                    </p>
                </div>
            </div>

            {/* Add table card */}
            <div className="pos-card p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t('addNewTable')}
                </p>

                {/* Zone selector */}
                <div className="space-y-2">
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-1">
                        <MapPin size={10} /> Zone
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                        {PRESET_ZONES.map(z => {
                            const s = getZoneStyle(z);
                            const active = zone === z;
                            return (
                                <button
                                    key={z}
                                    onClick={() => setZone(z)}
                                    className="px-3 py-1 rounded-full text-[11px] font-bold transition-all active:scale-95"
                                    style={{
                                        background: active ? s.bg : 'transparent',
                                        color: active ? s.text : 'var(--text-secondary)',
                                        border: `1.5px solid ${active ? s.border : 'var(--border)'}`,
                                    }}
                                >
                                    {z}
                                </button>
                            );
                        })}
                        {/* Custom zone input */}
                        <input
                            type="text"
                            value={PRESET_ZONES.includes(zone) ? '' : zone}
                            onChange={e => setZone(e.target.value)}
                            placeholder="Custom zone..."
                            onFocus={() => { if (PRESET_ZONES.includes(zone)) setZone(''); }}
                            onBlur={() => { if (!zone.trim()) setZone('Main'); }}
                            className="px-3 py-1 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] text-[11px] font-bold text-[var(--foreground)] placeholder-[var(--text-secondary)]/40 outline-none focus:border-[var(--accent-blue)] transition-colors w-28"
                        />
                    </div>
                </div>

                {/* Name + seat + add */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newName}
                        onChange={e => { setNewName(e.target.value.toUpperCase()); setError(''); }}
                        onKeyDown={e => e.key === 'Enter' && handleCreate()}
                        placeholder={t('tableName')}
                        maxLength={10}
                        className="flex-1 px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-sm font-bold uppercase text-[var(--foreground)] placeholder-[var(--text-secondary)]/40 outline-none focus:border-[var(--accent-blue)] transition-colors"
                    />
                    <input
                        type="number"
                        min={1}
                        max={20}
                        value={seatCount}
                        onChange={e => setSeatCount(Math.max(1, parseInt(e.target.value) || 4))}
                        title={t('seatCountTitle')}
                        className="w-16 px-2 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-sm font-bold text-center text-[var(--foreground)] outline-none focus:border-[var(--accent-blue)] transition-colors"
                    />
                    <button
                        onClick={handleCreate}
                        disabled={!newName.trim() || creating}
                        className="pos-btn-primary px-4 py-2 text-xs uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-40"
                    >
                        <Plus size={14} strokeWidth={2.5} />
                        {t('addTable')}
                    </button>
                </div>
                {error && (
                    <p className="text-xs text-red-400">{error}</p>
                )}
            </div>

            {/* Zone filter tabs */}
            {allZoneTabs.length > 1 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                    {allZoneTabs.map(z => {
                        const active = filterZone === z;
                        const s = z === 'All' ? { bg: 'rgba(14,165,233,0.12)', text: '#38bdf8', border: 'rgba(14,165,233,0.35)' } : getZoneStyle(z);
                        const count = z === 'All' ? tables.length : tables.filter(t => t.zone === z).length;
                        return (
                            <button
                                key={z}
                                onClick={() => setFilterZone(z)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all active:scale-95"
                                style={{
                                    background: active ? s.bg : 'transparent',
                                    color: active ? s.text : 'var(--text-secondary)',
                                    border: `1.5px solid ${active ? s.border : 'var(--border)'}`,
                                }}
                            >
                                <Tag size={9} />
                                {z}
                                <span className="opacity-70 font-black">{count}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Table list — grouped by zone */}
            <div className="pos-card overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {t('allTables')}
                    </p>
                    <span className="text-xs text-[var(--text-secondary)]">{filteredTables.length}</span>
                </div>

                {loading ? (
                    <div className="p-4 space-y-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-10 rounded-xl animate-pulse bg-[var(--bg-elevated)]" />
                        ))}
                    </div>
                ) : filteredTables.length === 0 ? (
                    <div className="py-12 flex flex-col items-center gap-2 opacity-40">
                        <LayoutGrid size={32} className="text-[var(--text-secondary)]" />
                        <p className="text-sm text-[var(--text-secondary)]">{t('noTables')}</p>
                    </div>
                ) : (
                    <div>
                        {Array.from(tablesByZone.entries()).map(([zoneName, zoneTables]) => {
                            const zs = getZoneStyle(zoneName);
                            return (
                                <div key={zoneName}>
                                    {/* Zone header */}
                                    <div
                                        className="px-4 py-2 flex items-center gap-2 border-b border-[var(--border)]"
                                        style={{ background: zs.bg }}
                                    >
                                        <MapPin size={11} style={{ color: zs.text }} />
                                        <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: zs.text }}>
                                            {zoneName}
                                        </span>
                                        <span className="text-[10px] font-bold ml-auto" style={{ color: zs.text, opacity: 0.7 }}>
                                            {zoneTables.length} {zoneTables.length === 1 ? 'table' : 'tables'}
                                        </span>
                                    </div>

                                    {/* Tables in zone */}
                                    <div className="divide-y divide-[var(--border)]">
                                        {zoneTables.map(table => {
                                            const isActive = table.status !== 'available';
                                            const statusLabel = {
                                                available: { label: t('tableStatusFree'),    cls: 'text-green-400'  },
                                                busy:      { label: t('tableStatusBusy'),    cls: 'text-orange-400' },
                                                waiting:   { label: t('tableStatusWaiting'), cls: 'text-yellow-400' },
                                            }[table.status] ?? { label: t('tableStatusFree'), cls: 'text-green-400' };

                                            return (
                                                <div key={table.id} className="flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-elevated)] transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                                                            isActive
                                                                ? 'bg-blue-500/12 border-blue-500/40'
                                                                : 'bg-green-500/10 border-green-500/30'
                                                        }`}>
                                                            {isActive
                                                                ? <Users2 size={14} className="text-blue-400" />
                                                                : <LayoutGrid size={14} className="text-green-400" />
                                                            }
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-[var(--foreground)]">{table.name}</p>
                                                            <div className="flex items-center gap-2">
                                                                <p className={`text-[10px] font-semibold ${statusLabel.cls}`}>
                                                                    {statusLabel.label}
                                                                </p>
                                                                <span className="text-[10px] text-[var(--text-secondary)]">·</span>
                                                                <p className="text-[10px] text-[var(--text-secondary)] flex items-center gap-0.5">
                                                                    <Users2 size={9} /> {table.seat_count} {t('seats')}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDelete(table)}
                                                        disabled={isActive}
                                                        title={isActive ? t('cannotDeleteActive') : t('deleteThisTable')}
                                                        className="p-1.5 rounded-lg transition-all hover:bg-red-500/10 text-red-500/50 hover:text-red-400 disabled:opacity-20 disabled:cursor-not-allowed"
                                                    >
                                                        <Trash2 size={14} strokeWidth={2} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
