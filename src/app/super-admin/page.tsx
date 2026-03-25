'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import {
    listAllRestaurants, createRestaurantWithAdmin, superadminUpdateAdmin,
    updateSuperadminProfile, superadminGetAllUsers, superadminMoveUser, SuperadminUserView,
    superadminCreateRestaurantUser, deleteRestaurant
} from '@/lib/api/auth';
import type { RestaurantSummary } from '@/types';
import { SyncStatus } from '@/components/ui/SyncStatus';
import {
    ShieldCheck, LogOut, Plus, RefreshCw, Store,
    User, Phone, MapPin, Calendar, ChevronRight,
    X, Eye, EyeOff, Building2, AlertTriangle, Check, Pen, Users, Search, ShieldAlert, Trash2, UserPlus
} from 'lucide-react';
import { updateRestaurantLicense } from '@/lib/api/restaurant';

// ─── Create Restaurant Modal ────────────────────────────────────────────
type CreateForm = {
    restaurantName: string;
    restaurantAddress: string;
    restaurantPhone: string;
    licenseExpiresAt: string;
    licenseSupportContact: string;
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
        licenseExpiresAt: '', licenseSupportContact: 'Contact our service team to renew your subscription.',
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
                licenseExpiresAt: form.licenseExpiresAt || undefined,
                licenseSupportContact: form.licenseSupportContact || undefined,
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
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Drawer panel — slides in from the right */}
            <div
                className="relative w-full max-w-md h-full bg-[var(--bg-card)] border-l border-[var(--border)] shadow-2xl flex flex-col overflow-hidden"
                style={{ animation: 'slideInRight 0.28s cubic-bezier(0.32,0.72,0,1) both' }}
            >
                {/* Top accent stripe */}
                <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent flex-shrink-0" />

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
                    <div className="flex items-center gap-3">
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

                {/* Scrollable form body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Restaurant section */}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent)] mb-3 flex items-center gap-1.5">
                            <Store size={10} /> Restaurant Details
                        </p>
                        <div className="space-y-3">
                            <Field label="Restaurant Name *" value={form.restaurantName} onChange={update('restaurantName')} placeholder="Summer Café" />
                            <Field label="Address" value={form.restaurantAddress} onChange={update('restaurantAddress')} placeholder="Phnom Penh, Cambodia" />
                            <Field label="Phone" value={form.restaurantPhone} onChange={update('restaurantPhone')} placeholder="+855 12 345 678" />
                            <Field label="License Expiry" type="date" value={form.licenseExpiresAt} onChange={update('licenseExpiresAt')} />
                            <Field label="Support Contact" value={form.licenseSupportContact} onChange={update('licenseSupportContact')} placeholder="Phone, Telegram, or office contact" />
                        </div>
                    </div>

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
                </form>

                {/* Sticky footer buttons */}
                <div className="flex-shrink-0 flex gap-3 px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-elevated)]">
                    <button type="button" onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-sm font-black text-[var(--text-secondary)] hover:text-white transition-all">
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex-1 py-2.5 rounded-xl bg-[var(--accent)] text-black text-sm font-black hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} strokeWidth={3} />}
                        {loading ? 'Creating…' : 'Create'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Field({ label, value, onChange, placeholder, type }: {
    label: string; value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    type?: string;
}) {
    return (
        <div className="space-y-1">
            <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-70">{label}</label>
            <input
                type={type || 'text'}
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
    const licenseExpired = isLicenseExpired(r.license_expires_at);
    const licenseLabel = getLicenseStatusLabel(r.license_expires_at);
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
                    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${licenseExpired ? 'bg-red-500/10 text-red-300 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'}`}>
                        {licenseExpired ? <ShieldAlert size={11} /> : <ShieldCheck size={11} />}
                        {licenseLabel}
                    </div>
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
function RestaurantDrawer({ r, onClose, onEditAdmin, onCreateUser, onUpdated }: {
    r: RestaurantSummary;
    onClose: () => void;
    onEditAdmin: (r: RestaurantSummary) => void;
    onCreateUser: (r: RestaurantSummary) => void;
    onUpdated: () => void;
}) {
    const [licenseExpiresAt, setLicenseExpiresAt] = useState(r.license_expires_at || '');
    const [supportContact, setSupportContact] = useState(r.license_support_contact || '');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [deleting, setDeleting] = useState(false);
    const licenseExpired = isLicenseExpired(licenseExpiresAt);

    function applyLicenseDuration(unit: 'days' | 'months' | 'years', amount: number) {
        const nextDate = extendLicenseDate(licenseExpiresAt, unit, amount);
        setLicenseExpiresAt(nextDate);
        setMessage(`License extended to ${nextDate}. Click Save License to apply.`);
    }

    async function handleSaveLicense() {
        setSaving(true);
        setMessage('');
        try {
            await updateRestaurantLicense(r.id, licenseExpiresAt || undefined, supportContact || undefined);
            setMessage('License updated.');
            onUpdated();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : String(error));
        } finally {
            setSaving(false);
        }
    }

    async function handleDeleteRestaurant() {
        const confirmed = window.confirm(`Delete ${r.name} and all related restaurant data? This will remove users, orders, products, tables, inventory, and sync records.`);
        if (!confirmed) {
            return;
        }

        setDeleting(true);
        setMessage('');
        try {
            await deleteRestaurant(r.id);
            onUpdated();
            onClose();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : String(error));
        } finally {
            setDeleting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div
                className="relative w-full max-w-sm h-full bg-[var(--bg-card)] border-l border-[var(--border)] shadow-2xl flex flex-col overflow-hidden"
                style={{ animation: 'slideInRight 0.28s cubic-bezier(0.32,0.72,0,1) both' }}
            >
                <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent flex-shrink-0" />

                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <Store size={16} className="text-[var(--accent)]" />
                        <h2 className="font-black text-sm">{r.name}</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-[var(--text-secondary)]">
                        <X size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    <Row icon={Store} label="Restaurant ID" value={r.id.split('-')[0].toUpperCase()} mono />
                    {r.address && <Row icon={MapPin} label="Address" value={r.address} />}
                    {r.phone && <Row icon={Phone} label="Phone" value={r.phone} />}
                    <Row icon={Calendar} label="Created" value={new Date(r.created_at + 'Z').toLocaleDateString()} />
                    <Row icon={licenseExpired ? ShieldAlert : ShieldCheck} label="License" value={licenseExpiresAt || 'Perpetual'} />

                    <div className="border-t border-white/5 pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 flex items-center gap-1.5">
                                <User size={10} /> Admin Account
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => onCreateUser(r)}
                                    className="p-1.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center gap-1 text-[10px] font-black uppercase tracking-widest"
                                >
                                    <UserPlus size={10} /> {r.admin_id ? 'Add User' : 'Create Admin'}
                                </button>
                                {r.admin_id && (
                                    <button
                                        onClick={() => onEditAdmin(r)}
                                        className="p-1.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all flex items-center gap-1 text-[10px] font-black uppercase tracking-widest"
                                    >
                                        <Pen size={10} /> Edit
                                    </button>
                                )}
                            </div>
                        </div>
                        <Row icon={User} label="Username" value={r.admin_username ?? '—'} mono />
                        {r.admin_full_name && <Row icon={User} label="Full Name" value={r.admin_full_name} />}
                        {!r.admin_id && (
                            <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
                                This restaurant has no admin account yet. Use Create Admin to set up the first account.
                            </div>
                        )}
                    </div>

                    <div className="border-t border-white/5 pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-1.5">
                                <ShieldCheck size={10} /> License Control
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Renew Period</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => applyLicenseDuration('days', 7)}
                                    className="px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[10px] font-black uppercase tracking-widest hover:bg-blue-500/20 transition-all"
                                >
                                    +7 Days
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyLicenseDuration('months', 1)}
                                    className="px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[10px] font-black uppercase tracking-widest hover:bg-blue-500/20 transition-all"
                                >
                                    +1 Month
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyLicenseDuration('months', 3)}
                                    className="px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[10px] font-black uppercase tracking-widest hover:bg-blue-500/20 transition-all"
                                >
                                    +3 Months
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyLicenseDuration('months', 6)}
                                    className="px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[10px] font-black uppercase tracking-widest hover:bg-blue-500/20 transition-all"
                                >
                                    +6 Months
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyLicenseDuration('years', 1)}
                                    className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all"
                                >
                                    +1 Year
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setLicenseExpiresAt('');
                                        setMessage('License set to perpetual. Click Save License to apply.');
                                    }}
                                    className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/20 transition-all"
                                >
                                    No Expiry
                                </button>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Expiry Date</label>
                            <input
                                type="date"
                                value={licenseExpiresAt}
                                onChange={(event) => setLicenseExpiresAt(event.target.value)}
                                className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-white focus:border-[var(--accent)] outline-none"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Support Contact</label>
                            <input
                                type="text"
                                value={supportContact}
                                onChange={(event) => setSupportContact(event.target.value)}
                                placeholder="Phone, Telegram, office contact"
                                className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-white focus:border-[var(--accent)] outline-none"
                            />
                        </div>
                        {message && <p className="text-[11px] text-[var(--text-secondary)]">{message}</p>}
                        <button
                            onClick={handleSaveLicense}
                            disabled={saving}
                            className="w-full py-2.5 rounded-xl bg-emerald-500 text-black font-black text-xs uppercase tracking-widest hover:brightness-110 disabled:opacity-60 transition-all"
                        >
                            {saving ? 'Saving...' : 'Save License'}
                        </button>
                    </div>

                    <div className="px-4 py-3 rounded-xl bg-amber-500/8 border border-amber-500/20 text-amber-400 text-xs font-medium flex items-center gap-2">
                        <AlertTriangle size={13} className="flex-shrink-0" />
                        Full POS view coming in a future update.
                    </div>
                </div>

                <div className="flex-shrink-0 px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-elevated)]">
                    <div className="space-y-2">
                        <button
                            onClick={handleDeleteRestaurant}
                            disabled={deleting}
                            className="w-full py-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-sm font-black text-red-300 hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                            <Trash2 size={14} /> {deleting ? 'Deleting...' : 'Delete Restaurant'}
                        </button>
                        <button onClick={onClose}
                            className="w-full py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-sm font-black text-[var(--text-secondary)] hover:text-white transition-all">
                            Close
                        </button>
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
    const [editAdmin, setEditAdmin] = useState<RestaurantSummary | null>(null);
    const [createUserFor, setCreateUserFor] = useState<RestaurantSummary | null>(null);
    const [showEditProfile, setShowEditProfile] = useState(false);
    const [showGlobalUsers, setShowGlobalUsers] = useState(false);
    const [movingUser, setMovingUser] = useState<SuperadminUserView | null>(null);

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

                    <button
                        onClick={() => setShowEditProfile(true)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-all text-left"
                        title="Edit Profile"
                    >
                        <ShieldCheck size={12} className="text-purple-400" />
                        <span className="text-xs font-black text-purple-300 uppercase tracking-widest">
                            {user?.full_name || user?.username}
                        </span>
                    </button>

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
                            onClick={() => setShowGlobalUsers(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-white font-black text-xs uppercase tracking-widest hover:border-blue-500/50 hover:bg-blue-500/10 transition-all"
                        >
                            <Users size={14} className="text-blue-400" />
                            Global Users
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

            {showCreate && (
                <CreateRestaurantModal
                    onClose={() => setShowCreate(false)}
                    onCreated={() => { setShowCreate(false); load(); }}
                />
            )}
            {selected && (
                <RestaurantDrawer 
                    r={selected} 
                    onClose={() => setSelected(null)} 
                    onEditAdmin={(r) => setEditAdmin(r)} 
                    onCreateUser={(r) => setCreateUserFor(r)}
                    onUpdated={load}
                />
            )}
            {editAdmin && (
                <EditAdminModal
                    r={editAdmin}
                    onClose={() => setEditAdmin(null)}
                    onUpdated={() => { setEditAdmin(null); load(); }}
                />
            )}
            {createUserFor && (
                <CreateRestaurantUserModal
                    restaurant={createUserFor}
                    onClose={() => setCreateUserFor(null)}
                    onCreated={() => { setCreateUserFor(null); load(); }}
                />
            )}
            {showEditProfile && (
                <EditProfileModal
                    onClose={() => setShowEditProfile(false)}
                />
            )}
            {showGlobalUsers && (
                <GlobalUsersModal
                    onClose={() => setShowGlobalUsers(false)}
                    restaurants={restaurants}
                    onMoveUser={(u) => setMovingUser(u)}
                />
            )}
            {movingUser && (
                <MoveUserModal
                    user={movingUser}
                    restaurants={restaurants}
                    onClose={() => setMovingUser(null)}
                    onMoved={() => { setMovingUser(null); /* Refresh global users if needed, but local state update is better */ }}
                />
            )}
        </div>
    );
}

function isLicenseExpired(value?: string) {
    if (!value) {
        return false;
    }

    const now = new Date();
    const expiry = new Date(`${value}T23:59:59`);
    return Number.isFinite(expiry.getTime()) && now > expiry;
}

function getLicenseStatusLabel(value?: string) {
    if (!value) {
        return 'Perpetual';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiry = new Date(`${value}T00:00:00`);
    if (!Number.isFinite(expiry.getTime())) {
        return `Until ${value}`;
    }

    const diffMs = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return `Expired ${Math.abs(diffDays)}d ago`;
    }
    if (diffDays === 0) {
        return 'Expires today';
    }
    if (diffDays <= 30) {
        return `Expires in ${diffDays}d`;
    }

    return `Until ${value}`;
}

function extendLicenseDate(currentValue: string | undefined, unit: 'days' | 'months' | 'years', amount: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const current = currentValue ? new Date(`${currentValue}T00:00:00`) : null;
    const baseDate = current && Number.isFinite(current.getTime()) && current > today ? current : today;
    const next = new Date(baseDate);

    if (unit === 'days') {
        next.setDate(next.getDate() + amount);
    } else if (unit === 'months') {
        next.setMonth(next.getMonth() + amount);
    } else {
        next.setFullYear(next.getFullYear() + amount);
    }

    return next.toISOString().slice(0, 10);
}

function CreateRestaurantUserModal({ restaurant, onClose, onCreated }: {
    restaurant: RestaurantSummary;
    onClose: () => void;
    onCreated: () => void;
}) {
    const defaultRole = restaurant.admin_id ? 'cashier' : 'admin';
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState(defaultRole);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        if (!username.trim() || !password.trim()) {
            setError('Username and password are required.');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        setLoading(true);
        try {
            await superadminCreateRestaurantUser({
                restaurantId: restaurant.id,
                username,
                password,
                role,
                fullName: fullName || undefined,
            });
            onCreated();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--bg-elevated)] flex justify-between items-center">
                    <div>
                        <h3 className="font-black text-sm">{restaurant.admin_id ? 'Add Restaurant User' : 'Create Restaurant Admin'}</h3>
                        <p className="text-[11px] text-[var(--text-secondary)]">{restaurant.name}</p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg text-[var(--text-secondary)]">
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Role</label>
                        <select
                            value={role}
                            onChange={(event) => setRole(event.target.value)}
                            className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-white focus:border-[var(--accent)] outline-none"
                        >
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                            <option value="cashier">Cashier</option>
                            <option value="waiter">Waiter</option>
                            <option value="chef">Chef</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Full Name</label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(event) => setFullName(event.target.value)}
                            className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-white focus:border-[var(--accent)] outline-none"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-white focus:border-[var(--accent)] outline-none"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-white focus:border-[var(--accent)] outline-none"
                        />
                    </div>

                    {error && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[11px] text-red-300">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-black font-black text-xs uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all"
                    >
                        {loading ? 'Saving...' : 'Create User'}
                    </button>
                </form>
            </div>
        </div>
    );
}

// ─── Edit Admin Modal ────────────────────────────────────────────────────────
function EditAdminModal({ r, onClose, onUpdated }: { r: RestaurantSummary; onClose: () => void; onUpdated: () => void }) {
    const [username, setUsername] = useState(r.admin_username || '');
    const [fullName, setFullName] = useState(r.admin_full_name || '');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await superadminUpdateAdmin({
                adminId: r.admin_id!,
                newUsername: username || undefined,
                newFullName: fullName || undefined,
                newPassword: password || undefined,
            });
            onUpdated();
        } catch (err: any) {
            setError(err.toString());
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div
                className="relative w-full max-w-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                style={{ animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
                <div className="px-5 py-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-elevated)]">
                    <div className="flex items-center gap-2">
                        <User size={16} className="text-blue-400" />
                        <h3 className="font-black text-sm">Edit Admin Account</h3>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg text-[var(--text-secondary)]">
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="p-5 space-y-4">
                    {error && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex flex-col gap-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-red-400">Error Saving</span>
                            <p className="text-[11px] font-medium text-red-300">{error}</p>
                        </div>
                    )}
                    
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Username</label>
                            <input
                                type="text"
                                className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-white focus:border-[var(--accent)] outline-none"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Full Name <span className="opacity-50">(optional)</span></label>
                            <input
                                type="text"
                                className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-white focus:border-[var(--accent)] outline-none"
                                value={fullName}
                                onChange={e => setFullName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">New Password <span className="opacity-50">(leave blank to keep)</span></label>
                            <input
                                type="password"
                                className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-white focus:border-[var(--accent)] outline-none"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-2 py-2.5 rounded-xl bg-[var(--accent)] text-black font-black text-xs uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center"
                    >
                        {loading ? <RefreshCw className="animate-spin" size={14} strokeWidth={3} /> : 'Save Changes'}
                    </button>
                </form>
            </div>
        </div>
    );
}

// ─── Edit Superadmin Profile Modal ───────────────────────────────────────────
function EditProfileModal({ onClose }: { onClose: () => void }) {
    const { user, setUser } = useAuth();
    const router = useRouter();

    const [username, setUsername] = useState(user?.username || '');
    const [fullName, setFullName] = useState(user?.full_name || '');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await updateSuperadminProfile({
                superadminId: user!.id,
                newUsername: username || undefined,
                newFullName: fullName || undefined,
                newPassword: password || undefined,
            });
            // Immediately log out to force re-auth visually, or just close and update state
            if (password) {
                // Better to force logout on password change
                setUser(null);
                router.replace('/login');
            } else {
                setUser({ ...user!, username, full_name: fullName });
                onClose();
            }
        } catch (err: any) {
            setError(err.toString());
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div
                className="relative w-full max-w-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                style={{ animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
                <div className="px-5 py-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-elevated)]">
                    <div className="flex items-center gap-2">
                        <ShieldCheck size={16} className="text-purple-400" />
                        <h3 className="font-black text-sm">Edit Superadmin Profile</h3>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg text-[var(--text-secondary)]">
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="p-5 space-y-4">
                    {error && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex flex-col gap-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-red-400">Error Saving</span>
                            <p className="text-[11px] font-medium text-red-300">{error}</p>
                        </div>
                    )}
                    
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Username</label>
                            <input
                                type="text"
                                className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-white focus:border-[var(--accent)] outline-none"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Full Name <span className="opacity-50">(optional)</span></label>
                            <input
                                type="text"
                                className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-white focus:border-[var(--accent)] outline-none"
                                value={fullName}
                                onChange={e => setFullName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">New Password <span className="opacity-50">(leave blank to keep)</span></label>
                            <input
                                type="password"
                                className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-white focus:border-[var(--accent)] outline-none"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <p className="text-[10px] text-[var(--text-secondary)] text-center font-medium opacity-60">
                        {password ? "You will be logged out after saving your new password." : ""}
                    </p>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-2 py-2.5 rounded-xl bg-[var(--accent)] text-black font-black text-xs uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center"
                    >
                        {loading ? <RefreshCw className="animate-spin" size={14} strokeWidth={3} /> : 'Save Changes'}
                    </button>
                </form>
            </div>
        </div>
    );
}

// ─── Global Users Directory Modal ────────────────────────────────────────────
function GlobalUsersModal({ onClose, restaurants, onMoveUser }: { 
    onClose: () => void; 
    restaurants: RestaurantSummary[];
    onMoveUser: (u: SuperadminUserView) => void;
}) {
    const [users, setUsers] = useState<SuperadminUserView[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        load();
    }, []);

    async function load() {
        setLoading(true);
        try {
            const data = await superadminGetAllUsers();
            setUsers(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    const filtered = users.filter(u => 
        u.username.toLowerCase().includes(search.toLowerCase()) || 
        (u.full_name && u.full_name.toLowerCase().includes(search.toLowerCase())) ||
        (u.restaurant_name && u.restaurant_name.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div
                className="relative w-full max-w-4xl max-h-full bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                style={{ animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
                <div className="px-6 py-5 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between bg-[var(--bg-elevated)] gap-4 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                            <Users size={20} />
                        </div>
                        <div>
                            <h3 className="font-black text-sm uppercase tracking-widest text-white">Global User Directory</h3>
                            <p className="text-[11px] text-[var(--text-secondary)] font-medium mt-0.5">
                                Showing {users.length} registered accounts platform-wide
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-50" />
                            <input
                                type="text"
                                placeholder="Search users by name, role, or origin..."
                                className="w-full sm:w-64 bg-black/50 border border-[var(--border)] rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:border-[var(--accent)] outline-none"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <button onClick={onClose} className="p-2.5 hover:bg-white/10 rounded-xl text-[var(--text-secondary)] bg-[var(--bg-base)] border border-[var(--border)] transition-all">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto bg-[var(--background)]">
                    {loading ? (
                        <div className="flex items-center justify-center p-20 opacity-30 text-[var(--text-secondary)] flex-col gap-3">
                            <RefreshCw size={24} className="animate-spin" />
                            <span className="text-xs uppercase tracking-widest font-black">Scanning DB...</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-20 gap-3 opacity-30 text-[var(--text-secondary)]">
                            <Search size={32} />
                            <span className="text-sm font-black uppercase tracking-widest">No users found</span>
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="sticky top-0 bg-[var(--bg-elevated)] backdrop-blur text-[10px] uppercase font-black tracking-widest text-[var(--text-secondary)]">
                                <tr>
                                    <th className="px-6 py-4 font-black">User Details</th>
                                    <th className="px-6 py-4 font-black">Role</th>
                                    <th className="px-6 py-4 font-black">Restaurant Origin</th>
                                    <th className="px-6 py-4 font-black text-right">Created</th>
                                    <th className="px-6 py-4 font-black text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                                {filtered.map(u => (
                                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="px-6 py-3">
                                            <p className="font-bold text-white mb-0.5">{u.username}</p>
                                            {u.full_name && <p className="text-[11px] text-[var(--text-secondary)]">{u.full_name}</p>}
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className={`inline-flex px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                                                u.role === 'admin' ? 'bg-blue-500/10 text-blue-400' :
                                                u.role === 'super_admin' ? 'bg-purple-500/10 text-purple-400' :
                                                'bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)]'
                                            }`}>
                                                {u.role.replace('_', ' ')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-[12px] font-medium text-[var(--text-secondary)]">
                                            {u.restaurant_name ? (
                                                <div className="flex items-center gap-2">
                                                    <Store size={12} className="opacity-50" />
                                                    {u.restaurant_name}
                                                </div>
                                            ) : (
                                                <span className="opacity-30 italic">Platform Layer</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-right text-[11px] text-[var(--text-secondary)] opacity-60 font-mono">
                                            {new Date(u.created_at + 'Z').toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <button 
                                                onClick={() => onMoveUser(u)}
                                                className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-[9px] font-black uppercase tracking-widest border border-blue-500/20 transition-all"
                                            >
                                                Move
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Move User Modal ────────────────────────────────────────────────────────
function MoveUserModal({ user, restaurants, onClose, onMoved }: {
    user: SuperadminUserView;
    restaurants: RestaurantSummary[];
    onClose: () => void;
    onMoved: () => void;
}) {
    const [selectedId, setSelectedId] = useState(user.restaurant_id || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleMove() {
        if (!selectedId) return;
        setLoading(true);
        setError('');
        try {
            await superadminMoveUser({ userId: user.id, newRestaurantId: selectedId });
            onMoved();
            // Optional: alert success
        } catch (err: any) {
            setError(err.toString());
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--bg-elevated)] flex justify-between items-center">
                    <h3 className="font-black text-xs uppercase tracking-widest">Reassign User</h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg text-[var(--text-secondary)]"> <X size={14} /> </button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Moving User</p>
                        <p className="text-sm font-bold text-white">{user.username}</p>
                        <p className="text-[10px] text-[var(--text-secondary)] opacity-60">Currently in: {user.restaurant_name || 'System'}</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Target Restaurant</label>
                        <select 
                            value={selectedId}
                            onChange={(e) => setSelectedId(e.target.value)}
                            className="w-full bg-black/40 border border-[var(--border)] rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-[var(--accent)] appearance-none"
                        >
                            <option value="" disabled>Select a restaurant...</option>
                            {restaurants.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    </div>

                    {error && <p className="text-[10px] text-red-400 font-bold">{error}</p>}

                    <div className="flex gap-3 pt-2">
                        <button onClick={onClose} className="flex-1 py-2 rounded-xl bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-[10px] font-black uppercase tracking-widest border border-[var(--border)]">Cancel</button>
                        <button 
                            onClick={handleMove}
                            disabled={loading || selectedId === user.restaurant_id}
                            className="flex-1 py-2 rounded-xl bg-[var(--accent)] text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                        >
                            {loading ? 'Moving...' : 'Confirm Move'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
