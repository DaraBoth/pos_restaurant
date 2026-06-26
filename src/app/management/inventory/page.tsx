'use client';
import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/providers/LanguageProvider';
import { History, Search, ArrowUpRight, ArrowDownLeft, Package, Plus, Edit2, Trash2, Download } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { call } from '@/lib/tauri-commands';
import { InventoryItem } from '@/types';
import { getInventoryItems, createInventoryItem, updateInventoryItem, deleteInventoryItem, getInventoryLogs } from '@/lib/api/inventory';
import { formatUsd } from '@/lib/currency';
import { canDelete } from '@/lib/permissions';
interface InventoryLog {
    id: string;
    product_id: string;
    product_name: string;
    change_amount: number;
    reason: string;
    created_at: string;
}

export default function InventoryManagement() {
    const { t } = useLanguage();
    const { user } = useAuth();
    const restaurantId = user?.restaurant_id;
    const [activeTab, setActiveTab] = useState<'materials' | 'audit'>('materials');
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [modalError, setModalError] = useState('');
    const [exporting, setExporting] = useState(false);
    const [exportToast, setExportToast] = useState<{ msg: string; ok: boolean } | null>(null);
    const exportToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    // Materials State
    const [materials, setMaterials] = useState<InventoryItem[]>([]);
    const [materialsLoading, setMaterialsLoading] = useState(true);
    const [showMaterialModal, setShowMaterialModal] = useState(false);
    const [editingMaterial, setEditingMaterial] = useState<InventoryItem | null>(null);
    const [formData, setFormData] = useState({
        name: '', unit_label: 'piece', stock_qty: 0, stock_pct: 0, min_stock_qty: 1, max_stock_qty: null as number | null, cost_per_unit: 0
    });

    // Audit Log State
    const [logs, setLogs] = useState<InventoryLog[]>([]);
    const [logsLoading, setLogsLoading] = useState(true);
    
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (activeTab === 'materials') {
            loadMaterials();
        } else {
            loadLogs();
        }
    }, [activeTab]);

    async function loadMaterials() {
        setMaterialsLoading(true);
        try {
            const data = await getInventoryItems(restaurantId || undefined);
            setMaterials(data);
        } catch (e) {
            console.error(e);
        } finally {
            setMaterialsLoading(false);
        }
    }

    async function loadLogs() {
        setLogsLoading(true);
        try {
            const data = await getInventoryLogs(restaurantId || undefined);
            setLogs(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLogsLoading(false);
        }
    }

    const filteredMaterials = materials.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const filteredLogs = logs.filter(l => l.product_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const handleSaveMaterial = async (e: React.FormEvent) => {
        e.preventDefault();
        setModalError('');
        try {
            if (editingMaterial) {
                await updateInventoryItem({ id: editingMaterial.id, khmer_name: '', ...formData, restaurant_id: restaurantId || '' });
            } else {
                await createInventoryItem({ khmer_name: '', ...formData, restaurant_id: restaurantId || '' });
            }
            setShowMaterialModal(false);
            setEditingMaterial(null);
            loadMaterials();
        } catch (err) {
            console.error(err);
            setModalError(err instanceof Error ? err.message : t('failedToSaveMaterial'));
        }
    };

    const handleDeleteMaterial = (id: string) => {
        if (!canDelete(user?.role) || !user?.id) {
            setModalError(t('permissionDeniedDelete'));
            return;
        }
        setDeleteConfirmId(id);
    };

    const confirmDeleteMaterial = async () => {
        if (!deleteConfirmId || !user?.id) return;
        const id = deleteConfirmId;
        setDeleteConfirmId(null);
        try {
            await deleteInventoryItem(id, restaurantId || '', user.id);
            loadMaterials();
        } catch (err) {
            console.error(err);
            showExportToast(t('error'), false);
        }
    };

    const lowStockItems = materials.filter(m => m.stock_qty <= m.min_stock_qty);

    function showExportToast(msg: string, ok: boolean) {
        if (exportToastTimer.current) clearTimeout(exportToastTimer.current);
        setExportToast({ msg, ok });
        exportToastTimer.current = setTimeout(() => setExportToast(null), 3000);
    }

    async function handleExportStock() {
        if (materials.length === 0) return;
        setExporting(true);
        try {
            const XLSX = await import('xlsx');
            const rows = materials.map(m => ({
                'Item Name': m.name,
                'Unit': m.unit_label,
                'Current Stock': m.stock_qty,
                'Min Stock': m.min_stock_qty,
                'Status': m.stock_qty <= m.min_stock_qty ? 'Low' : 'OK',
            }));
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Stock');
            XLSX.writeFile(wb, `dineos-stock-${new Date().toISOString().slice(0, 10)}.xlsx`);
            showExportToast(t('exportSuccessMsg'), true);
        } catch (err) {
            console.error('Stock export failed:', err);
            showExportToast(t('exportFailedMsg'), false);
        } finally {
            setExporting(false);
        }
    }

    async function handleExportReorderList() {
        if (lowStockItems.length === 0) return;
        setExporting(true);
        try {
            const XLSX = await import('xlsx');
            const rows = lowStockItems.map(m => ({
                [t('name') ?? 'Name']: m.name,
                [t('stockLevel') ?? 'Stock']: m.stock_qty,
                [t('lowStockAlert') ?? 'Min Stock']: m.min_stock_qty,
                [t('stockUnit') ?? 'Unit']: m.unit_label,
            }));
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Reorder');
            XLSX.writeFile(wb, `reorder-list-${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (err) {
            console.error(err);
            showExportToast(t('error'), false);
        } finally {
            setExporting(false);
        }
    }

    return (
        <div className="max-w-7xl mx-auto animate-fade-in space-y-6 pb-20">
            {/* Header Area */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-[var(--bg-card)] p-6 lg:p-8 rounded-[2.5rem] border border-[var(--border)] shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-[100px] pointer-events-none" />
                
                <div className="flex items-center gap-6 relative z-10">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 shadow-lg">
                        <Package size={32} className="text-emerald-400" strokeWidth={2} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-[var(--foreground)] tracking-tight leading-none mb-2">{t('inventoryManagement')}</h1>
                        <p className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-60">
                            {t('rawMaterialsAudit')}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 relative z-10">
                    <div className="flex bg-[var(--bg-dark)] p-1.5 rounded-2xl border border-[var(--border)] shadow-inner">
                        <button
                            onClick={() => setActiveTab('materials')}
                            className={`px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all duration-300 ${
                                activeTab === 'materials' 
                                ? 'bg-emerald-500/10 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)]' 
                                : 'text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--bg-elevated)]'
                            }`}
                        >
                            {t('materials')}
                        </button>
                        <button
                            onClick={() => setActiveTab('audit')}
                            className={`px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all duration-300 ${
                                activeTab === 'audit'
                                ? 'bg-emerald-500/10 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                                : 'text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--bg-elevated)]'
                            }`}
                        >
                            {t('auditLog')}
                        </button>
                    </div>

                    <div className="relative">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                        <input 
                            type="text"
                            placeholder={t('search') ?? 'Search...'}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        className="bg-[var(--bg-dark)] border border-[var(--border)] rounded-2xl pl-12 pr-6 py-3 text-sm text-[var(--foreground)] focus:border-emerald-500 outline-none transition-all w-full sm:w-64"
                        />
                    </div>

                    {activeTab === 'materials' && (
                        <div className="flex gap-2">
                            <button
                                onClick={handleExportStock}
                                disabled={exporting || materials.length === 0}
                                className="h-12 px-4 bg-[var(--bg-dark)] border border-[var(--border)] hover:border-emerald-500 text-[var(--text-secondary)] hover:text-[var(--foreground)] rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Download size={16} /> {t('exportStock')}
                            </button>
                            {lowStockItems.length > 0 && (
                                <button
                                    onClick={handleExportReorderList}
                                    disabled={exporting}
                                    className="h-12 px-4 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 text-amber-400 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <Download size={16} /> {t('exportReorderList')}
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    setEditingMaterial(null);
                                    setFormData({ name: '', unit_label: 'piece', stock_qty: 0, stock_pct: 0, min_stock_qty: 1, max_stock_qty: null, cost_per_unit: 0 });
                                    setModalError('');
                                    setShowMaterialModal(true);
                                }}
                                className="h-12 px-6 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)]"
                            >
                                <Plus size={16} /> {t('addMaterial')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {exportToast && (
                <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-3 rounded-xl text-xs font-bold shadow-2xl border ${exportToast.ok ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-red-500/15 border-red-500/30 text-red-300'}`}>
                    {exportToast.msg}
                </div>
            )}

            {/* Content Area */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[2.5rem] overflow-hidden shadow-2xl relative">
                
                {/* MATERIALS TAB */}
                {activeTab === 'materials' && (
                    <div className="overflow-x-auto container-snap">
                        <table className="w-full text-left whitespace-nowrap border-collapse">
                            <thead className="bg-[var(--bg-dark)]">
                                <tr>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border)]">{t('name')}</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border)]">{t('stockUnit')}</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border)]">{t('stockLevel')}</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border)]">{t('costPerUnit')}</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border)] text-right">{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                                {filteredMaterials.map(mat => {
                                    const isLowStock = mat.stock_qty <= mat.min_stock_qty;
                                    return (
                                        <tr key={mat.id} className="transition-colors hover:bg-[var(--bg-elevated)]/50 group">
                                            <td className="px-8 py-5">
                                                <div className="font-black text-[var(--foreground)] text-base tracking-tight flex items-center gap-3">
                                                    {isLowStock && (
                                                        <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
                                                    )}
                                                    {mat.name}
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-[var(--foreground)]/80 font-semibold lowercase">
                                                {mat.unit_label}
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`font-mono font-bold ${isLowStock ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                        {mat.stock_qty} <span className="text-[var(--text-secondary)] text-xs">+{Math.round(mat.stock_pct)}%</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 font-mono text-[var(--foreground)]/50">
                                                {formatUsd(mat.cost_per_unit)}
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={() => {
                                                            setEditingMaterial(mat);
                                                            setFormData({
                                                                name: mat.name,
                                                                unit_label: mat.unit_label,
                                                                stock_qty: mat.stock_qty,
                                                                stock_pct: mat.stock_pct,
                                                                min_stock_qty: mat.min_stock_qty,
                                                                max_stock_qty: mat.max_stock_qty ?? null,
                                                                cost_per_unit: mat.cost_per_unit
                                                            });
                                                            setModalError('');
                                                            setShowMaterialModal(true);
                                                        }}
                                                        className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center text-blue-400 hover:bg-blue-500/10 transition-colors"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteMaterial(mat.id)}
                                                        className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center text-rose-400 hover:bg-rose-500/10 transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredMaterials.length === 0 && !materialsLoading && (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-20 text-center">
                                            <Package size={48} className="mx-auto mb-4 text-[var(--text-secondary)] opacity-20" />
                                            <p className="text-[var(--text-secondary)] font-black uppercase tracking-widest text-xs">{t('noMaterialsFound')}</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* AUDIT LOG TAB */}
                {activeTab === 'audit' && (
                    <div className="overflow-x-auto container-snap">
                        <table className="w-full text-left whitespace-nowrap border-collapse">
                            <thead className="bg-[var(--bg-dark)]">
                                <tr>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border)]">{t('productMaterial')}</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border)]">{t('movement')}</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border)]">{t('reason')}</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border)] text-right">{t('timestamp')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                                {filteredLogs.map(log => (
                                    <tr key={log.id} className="transition-colors hover:bg-[var(--bg-elevated)]/50 group">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-[var(--bg-dark)] border border-[var(--border)] flex items-center justify-center group-hover:border-emerald-500/30 transition-colors">
                                                    <History size={20} className="text-[var(--text-secondary)]" />
                                                </div>
                                                <div className="font-black text-[var(--foreground)] text-base tracking-tight">{log.product_name}</div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className={`flex items-center gap-2 font-mono font-bold ${log.change_amount > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {log.change_amount > 0 ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                                                {log.change_amount > 0 ? '+' : ''}{log.change_amount}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] text-[10px] font-black uppercase tracking-widest group-hover:text-[var(--foreground)] transition-colors">
                                                {log.reason}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex flex-col items-end opacity-60 group-hover:opacity-100 transition-opacity">
                                                <div className="text-sm font-black text-[var(--foreground)] tracking-tight">
                                                    {new Date(log.created_at).toLocaleDateString()}
                                                </div>
                                                <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                                                    {new Date(log.created_at).toLocaleTimeString()}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredLogs.length === 0 && !logsLoading && (
                                    <tr>
                                        <td colSpan={4} className="px-8 py-20 text-center">
                                            <History size={48} className="mx-auto mb-4 text-[var(--text-secondary)] opacity-20" />
                                            <p className="text-[var(--text-secondary)] font-black uppercase tracking-widest text-xs">{t('noMovementHistory')}</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Material Modal */}
            {showMaterialModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={() => setShowMaterialModal(false)} />
                    <div className="bg-[var(--bg-card)] rounded-[2.5rem] w-full max-w-xl relative border border-[var(--border)] shadow-2xl p-8 animate-scale-up">
                        <h2 className="text-2xl font-black text-[var(--foreground)] mb-6">
                            {editingMaterial ? t('editMaterial') : t('addNewMaterial')}
                        </h2>
                        
                        <form onSubmit={handleSaveMaterial} className="space-y-4">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-[var(--text-secondary)] mb-2">{t('name')}</label>
                                <input 
                                    type="text" required
                                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                                    className="w-full bg-[var(--bg-dark)] border border-[var(--border)] rounded-2xl px-6 py-4 text-[var(--foreground)] focus:border-emerald-500 outline-none"
                                    placeholder={t('phInventoryExample')}
                                />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-[var(--text-secondary)] mb-2">{t('unitType')}</label>
                                    <input
                                        list="unit-presets"
                                        required
                                        value={formData.unit_label}
                                        onChange={e => setFormData({...formData, unit_label: e.target.value})}
                                        className="w-full bg-[var(--bg-dark)] border border-[var(--border)] rounded-2xl px-6 py-4 text-[var(--foreground)] focus:border-emerald-500 outline-none"
                                        placeholder={t('unitType') ?? 'e.g. bottle, kg, sachet'}
                                    />
                                    <datalist id="unit-presets">
                                        <option value="bottle">{t('unitBottle')}</option>
                                        <option value="can">{t('unitCan')}</option>
                                        <option value="bag">{t('unitBag')}</option>
                                        <option value="piece">{t('unitPiece')}</option>
                                        <option value="kg">{t('unitKg')}</option>
                                        <option value="liter">{t('unitLiter')}</option>
                                        <option value="sachet">{t('unitSachet')}</option>
                                        <option value="pack">{t('unitPack')}</option>
                                        <option value="set">{t('unitSet')}</option>
                                        <option value="roll">{t('unitRoll')}</option>
                                        <option value="pump">{t('unitPump')}</option>
                                        <option value="">{t('unitOther')}</option>
                                    </datalist>
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-[var(--text-secondary)] mb-2">{t('costPerUnitLabel')}</label>
                                    <input 
                                        type="number" step="0.01" required
                                        value={(formData.cost_per_unit / 100).toFixed(2)} 
                                        onChange={e => setFormData({...formData, cost_per_unit: Math.round(parseFloat(e.target.value) * 100)})}
                                        className="w-full bg-[var(--bg-dark)] border border-[var(--border)] rounded-2xl px-6 py-4 text-[var(--foreground)] focus:border-emerald-500 outline-none font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-[var(--text-secondary)] mb-2">{t('stockQtyLabel')}</label>
                                    <input 
                                        type="number" required
                                        value={formData.stock_qty} onChange={e => setFormData({...formData, stock_qty: parseInt(e.target.value)})}
                                        className="w-full bg-[var(--bg-dark)] border border-[var(--border)] rounded-2xl px-6 py-4 text-[var(--foreground)] focus:border-emerald-500 outline-none font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-[var(--text-secondary)] mb-2">{t('openedUnitPct')}</label>
                                    <input 
                                        type="number" step="1" min="0" max="100" required
                                        value={formData.stock_pct} onChange={e => setFormData({...formData, stock_pct: parseFloat(e.target.value)})}
                                        className="w-full bg-[var(--bg-dark)] border border-[var(--border)] rounded-2xl px-6 py-4 text-[var(--foreground)] focus:border-emerald-500 outline-none font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-[var(--text-secondary)] mb-2">{t('lowStockAlert')}</label>
                                    <input
                                        type="number" required
                                        value={formData.min_stock_qty} onChange={e => setFormData({...formData, min_stock_qty: parseInt(e.target.value)})}
                                        className="w-full bg-[var(--bg-dark)] border border-[var(--border)] rounded-2xl px-6 py-4 text-[var(--foreground)] focus:border-emerald-500 outline-none font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-[var(--text-secondary)] mb-2">{t('maxStock') || 'Max Stock (optional)'}</label>
                                    <input
                                        type="number" min="0"
                                        value={formData.max_stock_qty ?? ''}
                                        onChange={e => setFormData({...formData, max_stock_qty: e.target.value === '' ? null : parseFloat(e.target.value)})}
                                        placeholder={t('optional')}
                                        className="w-full bg-[var(--bg-dark)] border border-[var(--border)] rounded-2xl px-6 py-4 text-[var(--foreground)] focus:border-emerald-500 outline-none font-mono placeholder:text-[var(--text-secondary)]"
                                    />
                                </div>
                            </div>

                            {modalError && (
                                <div className="mt-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 font-bold">
                                    {modalError}
                                </div>
                            )}

                            <div className="flex gap-4 pt-4 mt-8 border-t border-[var(--border)]">
                                <button type="button" onClick={() => { setShowMaterialModal(false); setModalError(''); }} className="flex-1 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-[var(--foreground)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-dark)] transition-colors">
                                    {t('cancel')}
                                </button>
                                <button type="submit" className="flex-1 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-white bg-emerald-500 hover:bg-emerald-400 transition-colors shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                                    {t('saveMaterial')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {deleteConfirmId && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
                    <div className="pos-card p-6 max-w-sm mx-4 space-y-4">
                        <h3 className="text-sm font-black text-red-400 uppercase tracking-widest">
                            {t('deleteMaterial')}
                        </h3>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                            {t('deleteCannotUndo')}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-all"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={confirmDeleteMaterial}
                                className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest bg-red-500 text-white hover:bg-red-600 transition-all"
                            >
                                {t('delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
