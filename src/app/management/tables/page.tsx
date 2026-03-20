'use client';
import { useState, useEffect } from 'react';
import { Trash2, Plus, LayoutGrid, Users2 } from 'lucide-react';
import { getTables, createTable, deleteTable } from '@/lib/tauri-commands';
import type { FloorTable } from '@/types';
import { useLanguage } from '@/providers/LanguageProvider';

export default function TablesManagementPage() {
    const { t } = useLanguage();
    const [tables, setTables] = useState<FloorTable[]>([]);
    const [newName, setNewName] = useState('');
    const [seatCount, setSeatCount] = useState(4);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => { load(); }, []);

    async function load() {
        setLoading(true);
        try {
            setTables(await getTables());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate() {
        const name = newName.trim().toUpperCase();
        if (!name) return;
        if (tables.some(t => t.name === name)) {
            setError(t('tableNameExists'));
            return;
        }
        setCreating(true);
        setError('');
        try {
            await createTable(name, seatCount);
            setNewName('');
            setSeatCount(4);
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
            setError(`${t('deleteTable')}: ${table.name}`);
            return;
        }
        try {
            await deleteTable(table.id);
            await load();
        } catch (e) {
            setError(t('failedDeleteTable'));
            console.error(e);
        }
    }

    return (
        <div className="space-y-6">
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
            <div className="pos-card p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-3">
                    {t('addNewTable')}
                </p>
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
                    <p className="mt-2 text-xs text-red-400">{error}</p>
                )}
            </div>

            {/* Table list */}
            <div className="pos-card overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {t('allTables')}
                    </p>
                    <span className="text-xs text-[var(--text-secondary)]">{tables.length}</span>
                </div>

                {loading ? (
                    <div className="p-4 space-y-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-10 rounded-xl animate-pulse bg-[var(--bg-elevated)]" />
                        ))}
                    </div>
                ) : tables.length === 0 ? (
                    <div className="py-12 flex flex-col items-center gap-2 opacity-40">
                        <LayoutGrid size={32} className="text-[var(--text-secondary)]" />
                        <p className="text-sm text-[var(--text-secondary)]">
                            {t('noTables')}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-[var(--border)]">
                        {tables.map(table => {
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
                )}
            </div>
        </div>
    );
}
