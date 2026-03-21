'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import {
    listAllRestaurants, createRestaurantWithAdmin,
} from '@/lib/tauri-commands';
import type { RestaurantSummary } from '@/lib/tauri-commands';
import { SyncStatus } from '@/components/ui/SyncStatus';
import {
    ShieldCheck, LogOut, Plus, RefreshCw, Store,
    User, Phone, MapPin, Calendar, ChevronRight,
    X, Eye, EyeOff, Building2, AlertTriangle, Check,
} from 'lucide-react';

// ─── Create Restaurant Modal ────────────────────────────────────────────
type CreateForm = {
    restaurantName: string;
    restaurantAddress: string;
    restaurantPhone: string;
    adminUsername: string;
    adminPassword: string;
    adminFullName: string;
};

function CreateRestaurantModal({ onClose, onCreated }: {
    onClose: () => void;
    onCreated: () => void;
}) {
    const [form, setForm] = useState<CreateForm>({
        restaurantName: '', restaurantAddress: '', restaurantPhone: '',
        adminUsername: '', adminPassword: '', adminFullName: '',
    });
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const update = (k: keyof CreateForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(prev => ({ ...prev, [k]: e.target.value }));

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        if (!form.restaurantName.trim() || !form.adminUsername.trim() || !form.adminPassword.trim()) {
            setError('Restaurant name, admin username and password are required.');
            return;
        }
        if (form.adminPassword.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }
        setLoading(true);
        try {
            await createRestaurantWithAdmin({
                restaurantName: form.restaurantName,
                restaurantAddress: form.restaurantAddress || undefined,
                restaurantPhone: form.restaurantPhone || undefined,
                adminUsername: form.adminUsername,
                adminPassword: form.adminPassword,
                adminFullName: form.adminFullName || undefined,
            });
            onCreated();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl animate-fade-in overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center">
                            <Building2 size={15} className="text-[var(--accent)]" />
                        </div>
                        <div>
                            <h2 className="text-sm font-black uppercase tracking-widest">New Restaurant</h2>
                            <p className="text-[10px] text-[var(--text-secondary)] opacity-60">Creates restaurant + admin account</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-[var(--text-secondary)] transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Restaurant section */}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent)] mb-3 flex items-center gap-1.5">
                            <Store size={10} /> Restaurant Details
                        </p>
                        <div className="space-y-3">
                            <Field label="Restaurant Name *" value={form.restaurantName} onChange={update('restaurantName')} placeholder="Summer Café" />
                            <Field label="Address" value={form.restaurantAddress} onChange={update('restaurantAddress')} placeholder="Phnom Penh, Cambodia" />
                            <Field label="Phone" value={form.restaurantPhone} onChange={update('restaurantPhone')} placeholder="+855 12 345 678" />
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-dashed border-white/10" />

                    {/* Admin section */}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-3 flex items-center gap-1.5">
                            <User size={10} /> Owner / Admin Account
                        </p>
                        <div className="space-y-3">
                            <Field label="Full Name" value={form.adminFullName} onChange={update('adminFullName')} placeholder="Sokha Chan" />
                            <Field label="Username *" value={form.adminUsername} onChange={update('adminUsername')} placeholder="sokha.cafe" />
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-70">
                                    Password *
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPw ? 'text' : 'password'}
                                        value={form.adminPassword}
                                        onChange={update('adminPassword')}
                                        placeholder="min 6 characters"
                                        className="pos-input w-full pr-10 text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPw(v => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-white transition-colors"
                                    >
                                        {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                            <AlertTriangle size={13} strokeWidth={2.5} /> {error}
                        </div>
                    )}

                    <div className="flex gap-3 pt-1">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-sm font-black text-[var(--text-secondary)] hover:text-white transition-all">
                            Cancel
                        </button>
                        <button type="submit" disabled={loading}
                            className="flex-1 py-2.5 rounded-xl bg-[var(--accent)] text-black text-sm font-black hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} strokeWidth={3} />}
                            {loading ? 'Creating…' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function Field({ label, value, onChange, placeholder }: {
    label: string; value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
}) {
    return (
        <div className="space-y-1">
            <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-70">{label}</label>
            <input
                type="text"
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="pos-input w-full text-sm"
            />
        </div>
    );
}

// ─── Restaurant Card ─────────────────────────────────────────────────────
function RestaurantCard({ r, onSelect }: { r: RestaurantSummary; onSelect: () => void }) {
    const dt = new Date(r.created_at + 'Z');
    return (
        <div className="group flex flex-col bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden hover:border-[var(--accent)]/40 transition-all shadow-xl">
            {/* Top stripe */}
            <div className="h-1 w-full bg-gradient-to-r from-[var(--accent)]/30 via-[var(--accent)] to-[var(--accent)]/30" />

            <div className="p-5 flex-1 space-y-3">
                {/* Restaurant name */}
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center flex-shrink-0">
                        <Store size={18} className="text-[var(--accent)]" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-black text-sm text-white leading-tight truncate">{r.name}</h3>
                        {r.khmer_name && (
                            <p className="text-[11px] font-medium text-[var(--text-secondary)] opacity-60 truncate">{r.khmer_name}</p>
                        )}
                    </div>
                </div>

                {/* Details */}
                <div className="space-y-1.5">
                    {r.address && (
                        <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)] opacity-60">
                            <MapPin size={11} className="flex-shrink-0" />
                            <span className="truncate">{r.address}</span>
                        </div>
                    )}
                    {r.phone && (
                        <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)] opacity-60">
                            <Phone size={11} className="flex-shrink-0" />
                            <span>{r.phone}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)] opacity-40">
                        <Calendar size={11} className="flex-shrink-0" />
                        <span>Joined {dt.toLocaleDateString()}</span>
                    </div>
                </div>

                {/* Admin badge */}
                <div className="pt-1 border-t border-white/5">
                    <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-blue-500/8 border border-blue-500/15">
                        <User size={12} className="text-blue-400 flex-shrink-0" />
                        <div className="min-w-0">
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                                {r.admin_username ?? '—'}
                            </p>
                            {r.admin_full_name && (
                                <p className="text-[10px] text-[var(--text-secondary)] opacity-50 truncate">{r.admin_full_name}</p>
                            )}
                        </div>
                        <span className="ml-auto text-[9px] font-black uppercase text-blue-400/60 bg-blue-500/10 px-1.5 py-0.5 rounded">
                            Admin
                        </span>
                    </div>
                </div>
            </div>

            {/* View button */}
            <div className="px-5 pb-5">
                <button
                    onClick={onSelect}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--accent)] hover:text-black hover:border-[var(--accent)] transition-all font-black text-[10px] uppercase tracking-widest group-hover:border-[var(--accent)]/40"
                >
                    <ChevronRight size={13} strokeWidth={3} />
                    View Restaurant
                </button>
            </div>
        </div>
    );
}

// ─── Restaurant Detail Drawer ────────────────────────────────────────────
function RestaurantDrawer({ r, onClose }: { r: RestaurantSummary; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl animate-fade-in overflow-hidden">
                <div className="h-1 w-full bg-gradient-to-r from-[var(--accent)]/30 via-[var(--accent)] to-[var(--accent)]/30" />

                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                    <div className="flex items-center gap-2">
                        <Store size={16} className="text-[var(--accent)]" />
                        <h2 className="font-black text-sm">{r.name}</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-[var(--text-secondary)]">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <Row icon={Store} label="Restaurant ID" value={r.id.split('-')[0].toUpperCase()} mono />
                    {r.address && <Row icon={MapPin} label="Address" value={r.address} />}
                    {r.phone && <Row icon={Phone} label="Phone" value={r.phone} />}
                    <Row icon={Calendar} label="Created" value={new Date(r.created_at + 'Z').toLocaleDateString()} />

                    <div className="border-t border-white/5 pt-4 space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 flex items-center gap-1.5">
                            <User size={10} /> Admin Account
                        </p>
                        <Row icon={User} label="Username" value={r.admin_username ?? '—'} mono />
                        {r.admin_full_name && <Row icon={User} label="Full Name" value={r.admin_full_name} />}
                    </div>

                    <div className="px-4 py-3 rounded-xl bg-amber-500/8 border border-amber-500/20 text-amber-400 text-xs font-medium flex items-center gap-2">
                        <AlertTriangle size={13} className="flex-shrink-0" />
                        Full POS view coming in a future update.
                    </div>
                </div>
            </div>
        </div>
    );
}

function Row({ icon: Icon, label, value, mono }: {
    icon: React.ElementType; label: string; value: string; mono?: boolean;
}) {
    return (
        <div className="flex items-center gap-3">
            <Icon size={13} className="text-[var(--text-secondary)] opacity-50 flex-shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50 w-20 flex-shrink-0">{label}</span>
            <span className={`text-xs font-medium text-white truncate ${mono ? 'font-mono' : ''}`}>{value}</span>
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────
export default function SuperAdminPage() {
    const { user, setUser } = useAuth();
    const router = useRouter();

    const [restaurants, setRestaurants] = useState<RestaurantSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [selected, setSelected] = useState<RestaurantSummary | null>(null);

    useEffect(() => {
        if (user?.role !== 'super_admin') {
            router.replace('/login');
            return;
        }
        load();
    }, []);

    async function load() {
        setLoading(true);
        try {
            const data = await listAllRestaurants();
            setRestaurants(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    function handleLogout() {
        setUser(null);
        router.replace('/login');
    }

    const totalRestaurants = restaurants.length;
    const totalWithAdmin   = restaurants.filter(r => r.admin_id).length;

    return (
        <div className="min-h-screen bg-[var(--background)]">
            {/* ── Top Bar ── */}
            <header className="sticky top-0 z-30 bg-[#0a1118]/95 backdrop-blur border-b border-[var(--border)] px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
                        <ShieldCheck size={18} className="text-purple-400" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black text-white uppercase tracking-widest">Super Admin Console</h1>
                        <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-50 uppercase tracking-widest">DineOS Platform</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <SyncStatus />

                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                        <ShieldCheck size={12} className="text-purple-400" />
                        <span className="text-xs font-black text-purple-300 uppercase tracking-widest">
                            {user?.full_name || user?.username}
                        </span>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="p-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] hover:bg-red-500/10 hover:border-red-500/30 text-[var(--text-secondary)] hover:text-red-400 transition-all"
                        title="Logout"
                    >
                        <LogOut size={15} strokeWidth={2.5} />
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
                {/* ── Stats row ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Restaurants', value: totalRestaurants, color: 'var(--accent)' },
                        { label: 'Active Clients',    value: totalWithAdmin,   color: '#3b82f6'        },
                        { label: 'No Admin Yet',      value: totalRestaurants - totalWithAdmin, color: '#f59e0b' },
                        { label: 'Platform Version',  value: 'v1.0',           color: '#a78bfa'        },
                    ].map(stat => (
                        <div key={stat.label} className="pos-card px-4 py-3 space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-secondary)] opacity-50">{stat.label}</p>
                            <p className="text-2xl font-black font-mono" style={{ color: stat.color }}>{stat.value}</p>
                        </div>
                    ))}
                </div>

                {/* ── Toolbar ── */}
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-base font-black text-white">Registered Restaurants</h2>
                        <p className="text-xs text-[var(--text-secondary)] opacity-50">Each entry represents a paying client + their admin account.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={load}
                            className="p-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] hover:bg-[var(--accent)] hover:text-black transition-all group"
                        >
                            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={() => setShowCreate(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-black font-black text-xs uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-[var(--accent)]/20"
                        >
                            <Plus size={14} strokeWidth={3} />
                            New Restaurant
                        </button>
                    </div>
                </div>

                {/* ── Grid ── */}
                {loading ? (
                    <div className="flex items-center justify-center py-24 opacity-20">
                        <RefreshCw size={32} className="animate-spin" />
                    </div>
                ) : restaurants.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-30">
                        <Store size={48} strokeWidth={1} />
                        <div className="text-center">
                            <p className="font-black uppercase tracking-widest">No restaurants yet</p>
                            <p className="text-xs mt-1 opacity-60">Click "New Restaurant" to onboard your first client.</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {restaurants.map(r => (
                            <RestaurantCard key={r.id} r={r} onSelect={() => setSelected(r)} />
                        ))}
                    </div>
                )}
            </main>

            {/* ── Modals ── */}
            {showCreate && (
                <CreateRestaurantModal
                    onClose={() => setShowCreate(false)}
                    onCreated={() => { setShowCreate(false); load(); }}
                />
            )}
            {selected && (
                <RestaurantDrawer r={selected} onClose={() => setSelected(null)} />
            )}
        </div>
    );
}
