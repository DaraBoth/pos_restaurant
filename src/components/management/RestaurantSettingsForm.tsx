'use client';

import { useEffect, useState } from 'react';
import { Building2, Save, RefreshCw, Phone, MapPin, Hash, Globe, StickyNote, ArrowRight, ShieldAlert, ShieldCheck } from 'lucide-react';
import { getRestaurant, updateRestaurant, triggerSyncReset } from '@/lib/api/restaurant';
import type { RestaurantInput } from '@/types';
import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { CloudResetDialog } from './CloudResetDialog';

const DEFAULT: RestaurantInput = {
    name: '',
    khmer_name: '',
    address: '',
    address_kh: '',
    phone: '',
    tin: '',
    vat_number: '',
    website: '',
    logo_path: '',
    receipt_footer: 'Thank you for your visit!',
    license_expires_at: '',
    license_support_contact: '',
};

const SAMPLE_SETUP_INFO: RestaurantInput = {
    name: 'Volt Coffee Phnom Penh',
    khmer_name: 'វ៉ុល កាហ្វេ ភ្នំពេញ',
    address: 'No. 123, Monivong Blvd, Phnom Penh',
    address_kh: 'ផ្ទះលេខ ១២៣ មហាវិថីមុនីវង្ស ភ្នំពេញ',
    phone: '+855 12 345 678',
    tin: 'K000-123456789',
    vat_number: 'VAT-PP-2026-001',
    website: 'www.voltcoffee.kh',
    receipt_footer: 'Thank you for your visit!\nPlease come again.',
};

interface RestaurantSettingsFormProps {
    mode: 'setup' | 'manage';
    onSaved?: () => void;
    onNext?: () => void;
}

interface FormFieldProps {
    label: string;
    value: string;
    placeholder?: string;
    icon?: React.ElementType;
    multiline?: boolean;
    onChange: (value: string) => void;
}

function FormField({ label, value, placeholder, icon: Icon, multiline, onChange }: FormFieldProps) {
    return (
        <div className="space-y-3">
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                {Icon && <Icon size={14} className="text-[var(--accent-blue)]" />}
                {label}
            </label>
            {multiline ? (
                <textarea
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    rows={3}
                    className="w-full pos-input px-5 py-4 text-sm font-bold resize-none placeholder:text-[var(--text-secondary)]/55"
                />
            ) : (
                <input
                    type="text"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full pos-input px-5 py-4 text-sm font-bold placeholder:text-[var(--text-secondary)]/55"
                />
            )}
        </div>
    );
}

export default function RestaurantSettingsForm({ mode, onSaved, onNext }: RestaurantSettingsFormProps) {
    const { user } = useAuth();
    const { t } = useLanguage();
    const restaurantId = user?.restaurant_id;
    const [info, setInfo] = useState<RestaurantInput>(DEFAULT);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function loadRestaurant() {
            try {
                const restaurant = await getRestaurant(restaurantId || undefined);
                if (!cancelled) {
                    const loadedInfo = {
                        name: restaurant.name || '',
                        khmer_name: restaurant.khmer_name || '',
                        address: restaurant.address || '',
                        address_kh: restaurant.address_kh || '',
                        phone: restaurant.phone || '',
                        tin: restaurant.tin || '',
                        vat_number: restaurant.vat_number || '',
                        website: restaurant.website || '',
                        logo_path: restaurant.logo_path || '',
                        receipt_footer: restaurant.receipt_footer || DEFAULT.receipt_footer,
                        license_expires_at: restaurant.license_expires_at || '',
                        license_support_contact: restaurant.license_support_contact || '',
                    };

                    const isSetupTemplate =
                        !loadedInfo.name ||
                        loadedInfo.name === 'My Restaurant' ||
                        !loadedInfo.address ||
                        !loadedInfo.phone;

                    if (mode === 'setup' && isSetupTemplate) {
                        setInfo({
                            name: loadedInfo.name && loadedInfo.name !== 'My Restaurant' ? loadedInfo.name : SAMPLE_SETUP_INFO.name,
                            khmer_name: loadedInfo.khmer_name || SAMPLE_SETUP_INFO.khmer_name,
                            address: loadedInfo.address || SAMPLE_SETUP_INFO.address,
                            address_kh: loadedInfo.address_kh || SAMPLE_SETUP_INFO.address_kh,
                            phone: loadedInfo.phone || SAMPLE_SETUP_INFO.phone,
                            tin: loadedInfo.tin || SAMPLE_SETUP_INFO.tin,
                            vat_number: loadedInfo.vat_number || SAMPLE_SETUP_INFO.vat_number,
                            website: loadedInfo.website || SAMPLE_SETUP_INFO.website,
                            receipt_footer: loadedInfo.receipt_footer || SAMPLE_SETUP_INFO.receipt_footer,
                        });
                    } else {
                        setInfo(loadedInfo);
                    }
                }
            } catch (error) {
                console.error(error);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadRestaurant();

        return () => {
            cancelled = true;
        };
    }, []);

    function update(field: keyof RestaurantInput, value: string) {
        setInfo(prev => ({ ...prev, [field]: value }));
        setSaved(false);
    }

    function handleFillSample() {
        setInfo(SAMPLE_SETUP_INFO);
        setSaved(false);
    }

    async function handleSave() {
        if (!info.name?.trim() || !info.address?.trim() || !info.phone?.trim()) {
            alert('Restaurant name, address, and phone are required.');
            return;
        }

        setSaving(true);
        try {
            await updateRestaurant(info, restaurantId || undefined);
            setSaved(true);
            onSaved?.();
            setTimeout(() => setSaved(false), 2500);
        } catch (error) {
            console.error(error);
            alert('Failed to save restaurant information.');
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-10 h-10 border-2 border-white/20 border-t-[var(--accent)] rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-6 pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pos-card p-5">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--accent-blue)]/15 border border-[var(--accent-blue)]/30">
                        <Building2 size={18} className="text-[var(--accent-blue)]" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black uppercase tracking-widest text-[var(--foreground)]">
                            {mode === 'setup' ? t('businessSetup') : 'Shop Settings'}
                        </h1>
                        <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-50">
                            {mode === 'setup'
                                ? 'Complete before opening tables'
                                : 'Receipts, identity & contact'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {info.license_expires_at && (
                        <div className={`px-4 py-3 rounded-xl border text-xs font-black uppercase tracking-widest flex items-center gap-2 ${new Date(info.license_expires_at) < new Date()
                            ? 'bg-red-500/10 border-red-500/25 text-red-300'
                            : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                        }`}>
                            {new Date(info.license_expires_at) < new Date() ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
                            License {new Date(info.license_expires_at) < new Date() ? 'Expired' : `Until ${info.license_expires_at}`}
                        </div>
                    )}

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`px-8 py-4 rounded-xl font-black uppercase tracking-widest text-sm flex items-center gap-3 transition-all ${
                            saved
                                ? 'bg-green-500/15 border border-green-500/40 text-green-300'
                                : 'pos-btn-primary'
                        }`}
                    >
                        {saving ? <RefreshCw size={18} className="animate-spin" /> : saved ? <RefreshCw size={18} /> : <Save size={18} />}
                        {saved ? 'Saved' : mode === 'setup' ? 'Save Information' : 'Update Settings'}
                    </button>

                    {mode === 'setup' && (
                        <button
                            onClick={handleFillSample}
                            type="button"
                            className="px-5 py-3 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:border-[var(--accent-blue)]/35 transition-all font-bold text-xs uppercase tracking-widest"
                        >
                            Fill Sample Data
                        </button>
                    )}

                    {mode === 'setup' && (
                        <button
                            onClick={onNext}
                            type="button"
                            disabled={!saved || saving}
                            className={`px-8 py-4 rounded-xl font-black uppercase tracking-widest text-sm flex items-center gap-3 transition-all ${
                                saved && !saving
                                    ? 'bg-[var(--accent-blue)] text-white hover:brightness-110'
                                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]/60 cursor-not-allowed border border-[var(--border)]'
                            }`}
                        >
                            <ArrowRight size={18} />
                            Next
                        </button>
                    )}
                </div>
            </div>

            <div className="pos-card p-5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[var(--text-secondary)]">
                    <ShieldCheck size={14} className="text-[var(--accent-blue)]" /> License Status
                </div>
                <p className="text-sm text-[var(--foreground)]">
                    {info.license_expires_at
                        ? `This restaurant license is set to expire on ${info.license_expires_at}.`
                        : 'This restaurant currently has no expiry date and will be treated as a perpetual license.'}
                </p>
                <p className="text-xs text-[var(--text-secondary)] opacity-70">
                    License renewal details are managed by your service team from the super admin console.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <section className="pos-card p-5 rounded-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)]/5 rounded-bl-[100px] pointer-events-none" />
                        <h2 className="text-sm font-black uppercase tracking-widest text-[var(--accent)] mb-8">
                            Identity & Contact
                        </h2>
                        
                        <div className="flex flex-col md:flex-row gap-10 mb-10 pb-10 border-b border-white/5">
                            <div className="relative group/logo">
                                <div className="w-32 h-32 lg:w-40 lg:h-40 rounded-3xl bg-[var(--bg-elevated)] border-2 border-dashed border-[var(--border)] group-hover:border-[var(--accent-blue)]/50 transition-all flex items-center justify-center overflow-hidden">
                                    {info.logo_path ? (
                                        <img src={info.logo_path} alt="Logo" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="text-[var(--accent-blue)] opacity-30">LOGO</div>
                                    )}
                                </div>
                                <label className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-[var(--accent-blue)] text-white flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 active:scale-95 transition-all">
                                    <ArrowRight size={18} className="-rotate-90" />
                                    <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        try {
                                            const dataUri = await new Promise<string>((resolve, reject) => {
                                                const img = new Image();
                                                img.onload = () => {
                                                    const MAX = 512;
                                                    const scale = Math.min(1, MAX / Math.max(img.width, img.height));
                                                    const canvas = document.createElement('canvas');
                                                    canvas.width  = Math.round(img.width  * scale);
                                                    canvas.height = Math.round(img.height * scale);
                                                    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
                                                    resolve(canvas.toDataURL('image/png'));
                                                };
                                                img.onerror = reject;
                                                img.src = URL.createObjectURL(file);
                                            });
                                            update('logo_path', dataUri);
                                        } catch (error) {
                                            console.error('Failed to save logo:', error);
                                            alert('Failed to process logo.');
                                        }
                                    }} />
                                </label>
                            </div>
                            <div className="flex-1 space-y-2">
                                <h3 className="text-xl font-black text-[var(--foreground)]">Shop Logo</h3>
                                <p className="text-xs font-bold text-[var(--text-secondary)] leading-relaxed uppercase tracking-wider">
                                    Upload a high-quality logo for receipts<br/>and the POS sidebar.
                                </p>
                                {info.logo_path && (
                                    <button 
                                        onClick={() => update('logo_path', '')}
                                        className="text-[10px] font-black text-red-500 uppercase tracking-widest mt-2 hover:text-red-400"
                                    >
                                        Remove Logo
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                            <FormField label="Shop Name (English)" value={info.name || ''} onChange={value => update('name', value)} placeholder="Volt Coffee" icon={Building2} />
                            <FormField label="Shop Name (Khmer)" value={info.khmer_name || ''} onChange={value => update('khmer_name', value)} placeholder="ហាងកាហ្វេវ៉ុល" icon={Building2} />
                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField label="Address (English)" value={info.address || ''} onChange={value => update('address', value)} placeholder="123 Neon Ave" icon={MapPin} />
                                <FormField label="Address (Khmer)" value={info.address_kh || ''} onChange={value => update('address_kh', value)} placeholder="១២៣ ផ្លូវនីអុង" icon={MapPin} />
                            </div>
                            <FormField label="Phone" value={info.phone || ''} onChange={value => update('phone', value)} placeholder="+855 ..." icon={Phone} />
                            <FormField label="Website" value={info.website || ''} onChange={value => update('website', value)} placeholder="voltburger.kh" icon={Globe} />
                        </div>
                    </section>


                    <section className="pos-card p-5 rounded-2xl">
                        <h2 className="text-sm font-black uppercase tracking-widest text-[var(--accent)] mb-8">
                            Receipt Footer
                        </h2>
                        <FormField
                            label="Receipt Message"
                            value={info.receipt_footer || ''}
                            onChange={value => update('receipt_footer', value)}
                            placeholder="Thank you for your visit."
                            icon={StickyNote}
                            multiline
                        />
                    </section>
                    
                    {/* Cloud Repair Utility */}
                    {mode === 'manage' && restaurantId && (
                        <CloudResetDialog restaurantId={restaurantId} />
                    )}
                </div>

                <div className="lg:col-span-1">
                    <div className="sticky top-8 bg-[var(--bg-card)] p-5 rounded-2xl border border-[var(--border)] shadow-2xl">
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-6 flex items-center justify-between">
                            Live Receipt Preview
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-[pulse_2s_ease-in-out_infinite]"></span>
                        </h2>

                        <div className="bg-[var(--bg-dark)] border border-[var(--border)] rounded-xl p-5 font-mono text-center flex flex-col items-center">
                            <div className="w-full border-t-2 border-dashed border-[var(--border)] mb-6" />

                            <div className="space-y-1.5 w-full">
                                <p className="font-black text-lg text-[var(--foreground)] uppercase tracking-widest">{info.name || 'SHOP NAME'}</p>
                                {info.khmer_name && <p className="text-sm font-bold text-[var(--text-secondary)] khmer">{info.khmer_name}</p>}
                                <div className="mt-4 space-y-1">
                                    {info.address && <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">{info.address}</p>}
                                    {info.phone && <p className="text-[10px] font-bold text-[var(--text-secondary)]">TEL: {info.phone}</p>}
                                    {info.tin && <p className="text-[10px] font-bold text-[var(--text-secondary)]">TIN: {info.tin}</p>}
                                </div>

                                <div className="w-full border-t border-dashed border-[var(--border)] my-6" />
                                <p className="text-[10px] font-bold text-[var(--text-secondary)]">... ORDER LINES ...</p>
                                <div className="w-full border-t border-dashed border-[var(--border)] my-6" />

                                {(info.receipt_footer || DEFAULT.receipt_footer || '').split('\n').map((line, index) => (
                                    <p key={index} className="text-[10px] font-bold text-white/60 uppercase">{line}</p>
                                ))}
                            </div>

                            <div className="w-full border-t-2 border-dashed border-[var(--border)] mt-6" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}