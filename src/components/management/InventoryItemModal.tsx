'use client';
import { useState, useEffect } from 'react';
import { createInventoryItem, updateInventoryItem } from '@/lib/api/inventory';
import type { InventoryItem } from '@/types';
import { useLanguage } from '@/providers/LanguageProvider';
import { useAuth } from '@/providers/AuthProvider';
import { Save, Package } from 'lucide-react';
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
    }, [item, isOpen]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        try {
            if (item) {
                await updateInventoryItem(
                    item.id, name, khmerName, unitLabel, stockQty, 
                    minStockQty, costPerUnit, restaurantId || ''
                );
            } else {
                await createInventoryItem(
                    name, khmerName, unitLabel, stockQty, 
                    minStockQty, costPerUnit, restaurantId || undefined
                );
            }
            onSave();
            onClose();
        } catch (error) {
            console.error(error);
            alert('Failed to save inventory item');
        } finally {
            setLoading(false);
        }
    }

    return (
        <SidebarDrawer
            isOpen={isOpen}
            onClose={onClose}
            title={item ? 'Edit Ingredient' : 'Add Ingredient'}
            subtitle={item ? item.name : 'Create a new stock item'}
        >
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                {/* Name */}
                <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
                        Ingredient Name (EN)
                    </label>
                    <input
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Jasmine Rice"
                        className="w-full bg-white/[0.07] border border-white/20 rounded-xl px-4 py-3 text-white font-semibold placeholder:text-white/30 focus:border-emerald-500 focus:bg-white/[0.09] outline-none transition-all"
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
                        className="w-full bg-white/[0.07] border border-white/20 rounded-xl px-4 py-3 text-white font-semibold khmer placeholder:text-white/30 focus:border-emerald-500 focus:bg-white/[0.09] outline-none transition-all"
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
                        placeholder="kg"
                        className="w-full bg-white/[0.07] border border-white/20 rounded-xl px-4 py-3 text-white font-semibold placeholder:text-white/30 focus:border-emerald-500 focus:bg-white/[0.09] outline-none transition-all"
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
                            className="w-full bg-white/[0.07] border border-white/20 rounded-xl px-4 py-3 text-white font-mono font-bold focus:border-emerald-500 outline-none transition-all"
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
                            className="w-full bg-white/[0.07] border border-white/20 rounded-xl px-4 py-3 text-white font-mono font-bold focus:border-emerald-500 outline-none transition-all"
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
                        className="w-full bg-white/[0.07] border border-white/20 rounded-xl px-4 py-3 text-white font-mono font-bold focus:border-emerald-500 outline-none transition-all"
                    />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3.5 rounded-xl text-sm font-bold text-white/60 hover:text-white border border-white/15 hover:border-white/30 hover:bg-white/5 transition-all"
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
