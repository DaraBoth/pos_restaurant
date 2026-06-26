'use client';
import { useState, useEffect } from 'react';
import { createInventoryItem, updateInventoryItem, getStockMovements } from '@/lib/api/inventory';
import type { InventoryItem, StockMovement } from '@/types';
import { useLanguage } from '@/providers/LanguageProvider';
import { useAuth } from '@/providers/AuthProvider';
import { Save, AlertTriangle, ChevronDown, ArrowUpRight, ArrowDownRight, History } from 'lucide-react';
import { normalizeRole } from '@/lib/permissions';
import SidebarDrawer from './SidebarDrawer';

interface InventoryItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    item?: InventoryItem | null;
}

export default function InventoryItemModal({ isOpen, onClose, onSave, item }: InventoryItemModalProps) {
    const { t } = useLanguage();
    const { user } = useAuth();
    const restaurantId = user?.restaurant_id;
    
    const [name, setName] = useState('');
    const [khmerName, setKhmerName] = useState('');
    const [unitLabel, setUnitLabel] = useState('pcs');
    const [stockQty, setStockQty] = useState(0);
    const [minStockQty, setMinStockQty] = useState(0);
    const [costPerUnit, setCostPerUnit] = useState(0);
    const [loading, setLoading] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const isAdmin = normalizeRole(user?.role) === 'admin' || normalizeRole(user?.role) === 'super_admin';

    useEffect(() => {
        setShowHistory(false);
        setMovements([]);
        if (item && isOpen && restaurantId) {
            getStockMovements(item.id, restaurantId, 10)
                .then(setMovements)
                .catch(e => console.error(e));
        }
    }, [item, isOpen, restaurantId]);

    useEffect(() => {
        if (item) {
            setName(item.name);
            setKhmerName(item.khmer_name || '');
            setUnitLabel(item.unit_label || 'pcs');
            setStockQty(item.stock_qty);
            setMinStockQty(item.min_stock_qty || 0);
            setCostPerUnit(item.cost_per_unit || 0);
        } else {
            setName('');
            setKhmerName('');
            setUnitLabel('pcs');
            setStockQty(0);
            setMinStockQty(5);
            setCostPerUnit(0);
        }
        setSaveError('');
    }, [item, isOpen]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        try {
            if (item) {
                await updateInventoryItem({
                    id: item.id, name, khmer_name: khmerName, unit_label: unitLabel,
                    stock_qty: stockQty, min_stock_qty: minStockQty,
                    cost_per_unit: costPerUnit, restaurant_id: restaurantId || '',
                    user_id: user?.id
                });
            } else {
                await createInventoryItem({
                    name, khmer_name: khmerName, unit_label: unitLabel,
                    stock_qty: stockQty, min_stock_qty: minStockQty,
                    cost_per_unit: costPerUnit, restaurant_id: restaurantId || undefined
                });
            }
            onSave();
            onClose();
        } catch (error) {
            console.error(error);
            const detail = isAdmin && error instanceof Error ? error.message : '';
            setSaveError(detail || t('saveFailed'));
        } finally {
            setLoading(false);
        }
    }

    return (
        <SidebarDrawer
            isOpen={isOpen}
            onClose={onClose}
            title={item ? t('editStockItem') : t('addStockItem')}
            subtitle={item ? item.name : t('stockItem')}
        >
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                {/* Name */}
                <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
                        {t('stockItem')} (EN)
                    </label>
                    <input
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder={t('phStockItemExample')}
                        className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--foreground)] font-semibold placeholder:text-[var(--text-secondary)]/50 focus:border-emerald-500 outline-none transition-all"
                    />
                </div>

                {/* Khmer Name */}
                <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
                        Khmer Name
                    </label>
                    <input
                        value={khmerName}
                        onChange={e => setKhmerName(e.target.value)}
                        placeholder="អង្ករម្លិះ"
                        className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--foreground)] font-semibold khmer placeholder:text-[var(--text-secondary)]/50 focus:border-emerald-500 outline-none transition-all"
                    />
                </div>

                {/* Unit Label */}
                <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
                        Unit (e.g. kg, pcs, ml)
                    </label>
                    <input
                        required
                        value={unitLabel}
                        onChange={e => setUnitLabel(e.target.value)}
                        placeholder={t('phUnitExample')}
                        className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--foreground)] font-semibold placeholder:text-[var(--text-secondary)]/50 focus:border-emerald-500 outline-none transition-all"
                    />
                </div>

                {/* Stock & Threshold */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
                            Initial Stock
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            required
                            min="0"
                            value={stockQty}
                            onChange={e => setStockQty(parseFloat(e.target.value) || 0)}
                            className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--foreground)] font-mono font-bold focus:border-emerald-500 outline-none transition-all"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
                            Low Stock Alert
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            required
                            min="0"
                            value={minStockQty}
                            onChange={e => setMinStockQty(parseFloat(e.target.value) || 0)}
                            className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--foreground)] font-mono font-bold focus:border-emerald-500 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Avg Cost */}
                <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
                        Average Cost per {unitLabel || 'unit'} (USD)
                    </label>
                    <input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={costPerUnit}
                        onChange={e => setCostPerUnit(parseFloat(e.target.value) || 0)}
                        className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--foreground)] font-mono font-bold focus:border-emerald-500 outline-none transition-all"
                    />
                </div>

                {/* Movement History */}
                {item && (
                    <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setShowHistory(v => !v)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated)]/70 transition-all"
                        >
                            <span className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
                                <History size={14} />
                                {t('movementHistory')}
                            </span>
                            <ChevronDown size={16} className={`text-[var(--text-secondary)] transition-transform ${showHistory ? 'rotate-180' : ''}`} />
                        </button>
                        {showHistory && (
                            <div className="divide-y divide-[var(--border)] max-h-60 overflow-y-auto">
                                {movements.length === 0 ? (
                                    <p className="px-4 py-6 text-center text-xs text-[var(--text-secondary)]">{t('noMovementHistory')}</p>
                                ) : movements.map(m => {
                                    const isPositive = m.quantity >= 0;
                                    const typeLabel = m.movement_type === 'receive' ? t('movementReceive')
                                        : m.movement_type === 'adjustment' ? t('movementAdjustment')
                                        : m.movement_type === 'deduct' ? t('movementDeduct')
                                        : m.movement_type === 'void' ? t('movementVoid')
                                        : m.movement_type;
                                    return (
                                        <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isPositive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'}`}>
                                                {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-[var(--foreground)] leading-tight">
                                                    {typeLabel}
                                                    {m.note ? <span className="font-normal text-[var(--text-secondary)]"> · {m.note}</span> : null}
                                                </p>
                                                <p className="text-[10px] text-[var(--text-secondary)] font-mono mt-0.5">{m.created_at}</p>
                                            </div>
                                            <span className={`text-sm font-mono font-black flex-shrink-0 ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                                                {isPositive ? '+' : ''}{m.quantity.toLocaleString()}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Actions */}
                {saveError && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-xs font-medium">
                        <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                        <span>{saveError}</span>
                    </div>
                )}

                <div className="flex gap-3 pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3.5 rounded-xl text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--bg-elevated)] transition-all"
                    >
                        {t('cancel')}
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 py-3.5 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Save size={16} strokeWidth={2.5} />
                        )}
                        {item ? t('save') : 'Add Item'}
                    </button>
                </div>
            </form>
        </SidebarDrawer>
    );
}
