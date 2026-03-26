'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/providers/LanguageProvider';
import { History, Search, ArrowUpRight, ArrowDownLeft, Package, Plus, Edit2, Trash2 } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { call } from '@/lib/tauri-commands';
import { InventoryItem } from '@/types';
import { getInventoryItems, createInventoryItem, updateInventoryItem, deleteInventoryItem, getInventoryLogs } from '@/lib/api/inventory';
import { formatUsd } from '@/lib/currency';

interface InventoryLog {
    id: string;
    product_id: string;
    product_name: string;
    change_amount: number;
    reason: string;
    created_at: string;
}

export default function InventoryManagement() {
    const { user } = useAuth();
    const restaurantId = user?.restaurant_id;
    const [activeTab, setActiveTab] = useState<'materials' | 'audit'>('materials');
    
    // Materials State
    const [materials, setMaterials] = useState<InventoryItem[]>([]);
    const [materialsLoading, setMaterialsLoading] = useState(true);
    const [showMaterialModal, setShowMaterialModal] = useState(false);
    const [editingMaterial, setEditingMaterial] = useState<InventoryItem | null>(null);
    const [formData, setFormData] = useState({
        name: '', unit_label: 'piece', stock_qty: 0, stock_pct: 0, min_stock_qty: 1, cost_per_unit: 0
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
            alert("Failed to save material.");
        }
    };

    const handleDeleteMaterial = async (id: string) => {
        if (confirm("Are you sure you want to delete this material? It cannot be undone and will break existing recipes.")) {
            try {
                await deleteInventoryItem(id, restaurantId || '');
                loadMaterials();
            } catch (err) {
                console.error(err);
                alert("Failed to delete material.");
            }
        }
    };

    return (
        <div className="max-w-7xl mx-auto animate-fade-in space-y-6 pb-20">
            {/* Header Area */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-[#181a20] p-6 lg:p-8 rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-[100px] pointer-events-none" />
                
                <div className="flex items-center gap-6 relative z-10">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 shadow-lg">
                        <Package size={32} className="text-emerald-400" strokeWidth={2} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tight leading-none mb-2">Inventory Management</h1>
                        <p className="text-sm font-bold text-[#8a8a99] uppercase tracking-widest opacity-60">
                            Raw Materials & Audit Logs
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 relative z-10">
                    <div className="flex bg-[#0f1115] p-1.5 rounded-2xl border border-white/5 shadow-inner">
                        <button
                            onClick={() => setActiveTab('materials')}
                            className={`px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all duration-300 ${
                                activeTab === 'materials' 
                                ? 'bg-emerald-500/10 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)]' 
                                : 'text-[#8a8a99] hover:text-white hover:bg-white/5'
                            }`}
                        >
                            Materials
                        </button>
                        <button
                            onClick={() => setActiveTab('audit')}
                            className={`px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all duration-300 ${
                                activeTab === 'audit' 
                                ? 'bg-emerald-500/10 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)]' 
                                : 'text-[#8a8a99] hover:text-white hover:bg-white/5'
                            }`}
                        >
                            Audit Log
                        </button>
                    </div>

                    <div className="relative">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8a8a99]" />
                        <input 
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="bg-[#0f1115] border border-white/5 rounded-2xl pl-12 pr-6 py-3 text-sm text-white focus:border-emerald-500 outline-none transition-all w-full sm:w-64"
                        />
                    </div>

                    {activeTab === 'materials' && (
                        <button 
                            onClick={() => {
                                setEditingMaterial(null);
                                setFormData({ name: '', unit_label: 'piece', stock_qty: 0, stock_pct: 0, min_stock_qty: 1, cost_per_unit: 0 });
                                setShowMaterialModal(true);
                            }}
                            className="h-12 px-6 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)]"
                        >
                            <Plus size={16} /> Add Material
                        </button>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="bg-[#181a20] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
                
                {/* MATERIALS TAB */}
                {activeTab === 'materials' && (
                    <div className="overflow-x-auto container-snap">
                        <table className="w-full text-left whitespace-nowrap border-collapse">
                            <thead className="bg-[#0f1115]">
                                <tr>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8a8a99] border-b border-white/5">Name</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8a8a99] border-b border-white/5">Stock Unit</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8a8a99] border-b border-white/5">Stock Level</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8a8a99] border-b border-white/5">Cost/Unit</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8a8a99] border-b border-white/5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredMaterials.map(mat => {
                                    const isLowStock = mat.stock_qty <= mat.min_stock_qty;
                                    return (
                                        <tr key={mat.id} className="transition-colors hover:bg-white/[0.02] group">
                                            <td className="px-8 py-5">
                                                <div className="font-black text-white text-base tracking-tight flex items-center gap-3">
                                                    {isLowStock && (
                                                        <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
                                                    )}
                                                    {mat.name}
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-white/80 font-semibold lowercase">
                                                {mat.unit_label}
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`font-mono font-bold ${isLowStock ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                        {mat.stock_qty} <span className="text-[#8a8a99] text-xs">+{Math.round(mat.stock_pct)}%</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 font-mono text-white/50">
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
                                                                cost_per_unit: mat.cost_per_unit
                                                            });
                                                            setShowMaterialModal(true);
                                                        }}
                                                        className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-blue-400 hover:bg-blue-500/10 transition-colors"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteMaterial(mat.id)}
                                                        className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-rose-400 hover:bg-rose-500/10 transition-colors"
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
                                            <Package size={48} className="mx-auto mb-4 text-[#8a8a99] opacity-20" />
                                            <p className="text-[#8a8a99] font-black uppercase tracking-widest text-xs">No materials found</p>
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
                            <thead className="bg-[#0f1115]">
                                <tr>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8a8a99] border-b border-white/5">Product/Material</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8a8a99] border-b border-white/5">Movement</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8a8a99] border-b border-white/5">Reason</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8a8a99] border-b border-white/5 text-right">Timestamp</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredLogs.map(log => (
                                    <tr key={log.id} className="transition-colors hover:bg-white/[0.02] group">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-[#0f1115] border border-white/5 flex items-center justify-center group-hover:border-emerald-500/30 transition-colors">
                                                    <History size={20} className="text-[#8a8a99]" />
                                                </div>
                                                <div className="font-black text-white text-base tracking-tight">{log.product_name}</div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className={`flex items-center gap-2 font-mono font-bold ${log.change_amount > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {log.change_amount > 0 ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                                                {log.change_amount > 0 ? '+' : ''}{log.change_amount}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 text-[#8a8a99] text-[10px] font-black uppercase tracking-widest group-hover:text-white transition-colors">
                                                {log.reason}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex flex-col items-end opacity-60 group-hover:opacity-100 transition-opacity">
                                                <div className="text-sm font-black text-white tracking-tight">
                                                    {new Date(log.created_at).toLocaleDateString()}
                                                </div>
                                                <div className="text-[10px] font-bold text-[#8a8a99] uppercase tracking-wider">
                                                    {new Date(log.created_at).toLocaleTimeString()}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredLogs.length === 0 && !logsLoading && (
                                    <tr>
                                        <td colSpan={4} className="px-8 py-20 text-center">
                                            <History size={48} className="mx-auto mb-4 text-[#8a8a99] opacity-20" />
                                            <p className="text-[#8a8a99] font-black uppercase tracking-widest text-xs">No movement history</p>
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
                    <div className="bg-[#181a20] rounded-[2.5rem] w-full max-w-xl relative border border-white/10 shadow-2xl p-8 animate-scale-up">
                        <h2 className="text-2xl font-black text-white mb-6">
                            {editingMaterial ? 'Edit Material' : 'Add New Material'}
                        </h2>
                        
                        <form onSubmit={handleSaveMaterial} className="space-y-4">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-[#8a8a99] mb-2">Name</label>
                                <input 
                                    type="text" required
                                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                                    className="w-full bg-[#0f1115] border border-white/5 rounded-2xl px-6 py-4 text-white focus:border-emerald-500 outline-none"
                                    placeholder="Milk, Coffee Beans, Vodka..."
                                />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-[#8a8a99] mb-2">Unit Type</label>
                                    <select 
                                        value={formData.unit_label} onChange={e => setFormData({...formData, unit_label: e.target.value})}
                                        className="w-full bg-[#0f1115] border border-white/5 rounded-2xl px-6 py-4 text-white focus:border-emerald-500 outline-none"
                                    >
                                        <option value="bottle">Bottle</option>
                                        <option value="can">Can</option>
                                        <option value="bag">Bag</option>
                                        <option value="piece">Piece</option>
                                        <option value="kg">Kg</option>
                                        <option value="liter">Liter</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-[#8a8a99] mb-2">Cost / Unit ($)</label>
                                    <input 
                                        type="number" step="0.01" required
                                        value={(formData.cost_per_unit / 100).toFixed(2)} 
                                        onChange={e => setFormData({...formData, cost_per_unit: Math.round(parseFloat(e.target.value) * 100)})}
                                        className="w-full bg-[#0f1115] border border-white/5 rounded-2xl px-6 py-4 text-white focus:border-emerald-500 outline-none font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-[#8a8a99] mb-2">Stock Qty (Sealed Units)</label>
                                    <input 
                                        type="number" required
                                        value={formData.stock_qty} onChange={e => setFormData({...formData, stock_qty: parseInt(e.target.value)})}
                                        className="w-full bg-[#0f1115] border border-white/5 rounded-2xl px-6 py-4 text-white focus:border-emerald-500 outline-none font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-[#8a8a99] mb-2">Opened Unit Remaining (%)</label>
                                    <input 
                                        type="number" step="1" min="0" max="100" required
                                        value={formData.stock_pct} onChange={e => setFormData({...formData, stock_pct: parseFloat(e.target.value)})}
                                        className="w-full bg-[#0f1115] border border-white/5 rounded-2xl px-6 py-4 text-white focus:border-emerald-500 outline-none font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-[#8a8a99] mb-2">Low Stock Alert Below Qty</label>
                                    <input 
                                        type="number" required
                                        value={formData.min_stock_qty} onChange={e => setFormData({...formData, min_stock_qty: parseInt(e.target.value)})}
                                        className="w-full bg-[#0f1115] border border-white/5 rounded-2xl px-6 py-4 text-white focus:border-emerald-500 outline-none font-mono"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4 mt-8 border-t border-white/5">
                                <button type="button" onClick={() => setShowMaterialModal(false)} className="flex-1 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-white bg-white/5 hover:bg-white/10 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" className="flex-1 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-white bg-emerald-500 hover:bg-emerald-400 transition-colors shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                                    Save Material
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
