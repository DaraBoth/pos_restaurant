'use client';

import { useEffect, useState } from 'react';
import { Building2, Save, RefreshCw, Phone, MapPin, Hash, Globe, StickyNote } from 'lucide-react';
import { getRestaurant, RestaurantInput, updateRestaurant } from '@/lib/tauri-commands';

const DEFAULT: RestaurantInput = {
    name: '',
    khmer_name: '',
    address: '',
    address_kh: '',
    phone: '',
    tin: '',
    vat_number: '',
    website: '',
    receipt_footer: 'Thank you for dining with us!',
};

interface RestaurantSettingsFormProps {
    mode: 'setup' | 'manage';
    onSaved?: () => void;
}

export default function RestaurantSettingsForm({ mode, onSaved }: RestaurantSettingsFormProps) {
    const [info, setInfo] = useState<RestaurantInput>(DEFAULT);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function loadRestaurant() {
            try {
                const restaurant = await getRestaurant();
                if (!cancelled) {
                    setInfo({
                        name: restaurant.name || '',
                        khmer_name: restaurant.khmer_name || '',
                        address: restaurant.address || '',
                        address_kh: restaurant.address_kh || '',
                        phone: restaurant.phone || '',
                        tin: restaurant.tin || '',
                        vat_number: restaurant.vat_number || '',
                        website: restaurant.website || '',
                        receipt_footer: restaurant.receipt_footer || DEFAULT.receipt_footer,
                    });
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

    async function handleSave() {
        if (!info.name?.trim() || !info.address?.trim() || !info.phone?.trim()) {
            alert('Restaurant name, address, and phone are required.');
            return;
        }

        setSaving(true);
        try {
            await updateRestaurant(info);
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

    const Field = ({
        label, value, field, placeholder, icon: Icon, multiline
    }: {
        label: string;
        value: string;
        field: keyof RestaurantInput;
        placeholder?: string;
        icon?: React.ElementType;
        multiline?: boolean;
    }) => (
        <div className="space-y-3">
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#8a8a99]">
                {Icon && <Icon size={14} className="text-[var(--accent)]" />}
                {label}
            </label>
            {multiline ? (
                <textarea
                    value={value}
                    onChange={e => update(field, e.target.value)}
                    placeholder={placeholder}
                    rows={3}
                    className="w-full bg-black border border-white/10 text-white px-5 py-4 rounded-2xl text-sm font-bold transition-all focus:border-[var(--accent)] focus:outline-none resize-none placeholder:text-white/20"
                />
            ) : (
                <input
                    type="text"
                    value={value}
                    onChange={e => update(field, e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-black border border-white/10 text-white px-5 py-4 rounded-2xl text-sm font-bold transition-all focus:border-[var(--accent)] focus:outline-none placeholder:text-white/20"
                />
            )}
        </div>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-10 h-10 border-2 border-white/20 border-t-[var(--accent)] rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto animate-fade-in space-y-8 pb-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-[#121216] p-8 rounded-[2rem] border border-white/5">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-[var(--accent)] shadow-[0_0_20px_rgba(59,130,246,0.25)]">
                        <Building2 size={28} color="#fff" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-white mb-1">
                            {mode === 'setup' ? 'Restaurant Setup' : 'Restaurant Settings'}
                        </h1>
                        <p className="text-sm font-bold text-[#8a8a99] uppercase tracking-widest">
                            {mode === 'setup'
                                ? 'Complete this before opening tables and orders'
                                : 'Configuration for receipts, identity, and contact details'}
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`px-8 py-4 rounded-xl font-black uppercase tracking-widest text-sm flex items-center gap-3 transition-all ${
                        saved
                            ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                            : 'bg-[var(--accent)] text-white hover:brightness-110 shadow-[0_0_20px_rgba(59,130,246,0.25)]'
                    }`}
                >
                    {saving ? <RefreshCw size={18} className="animate-spin" /> : saved ? <RefreshCw size={18} /> : <Save size={18} />}
                    {saved ? 'Saved' : mode === 'setup' ? 'Save And Continue' : 'Update Settings'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <section className="bg-[#121216] p-8 rounded-[2rem] border border-white/5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)]/5 rounded-bl-[100px] pointer-events-none" />
                        <h2 className="text-sm font-black uppercase tracking-widest text-[var(--accent)] mb-8">
                            Identity & Contact
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                            <Field label="Restaurant Name (English)" value={info.name || ''} field="name" placeholder="Volt Burger" icon={Building2} />
                            <Field label="Restaurant Name (Khmer)" value={info.khmer_name || ''} field="khmer_name" placeholder="ហាងប៊ឺហ្គឺវ៉ុល" icon={Building2} />
                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Field label="Address (English)" value={info.address || ''} field="address" placeholder="123 Neon Ave" icon={MapPin} />
                                <Field label="Address (Khmer)" value={info.address_kh || ''} field="address_kh" placeholder="១២៣ ផ្លូវនីអុង" icon={MapPin} />
                            </div>
                            <Field label="Phone" value={info.phone || ''} field="phone" placeholder="+855 ..." icon={Phone} />
                            <Field label="Website" value={info.website || ''} field="website" placeholder="voltburger.kh" icon={Globe} />
                        </div>
                    </section>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <section className="bg-[#121216] p-8 rounded-[2rem] border border-white/5">
                            <h2 className="text-sm font-black uppercase tracking-widest text-[var(--accent)] mb-8">
                                Compliance
                            </h2>
                            <div className="space-y-6">
                                <Field label="Tax ID (TIN)" value={info.tin || ''} field="tin" placeholder="K000-0000..." icon={Hash} />
                                <Field label="VAT Number" value={info.vat_number || ''} field="vat_number" placeholder="VAT-..." icon={Hash} />
                            </div>
                        </section>

                        <section className="bg-[#121216] p-8 rounded-[2rem] border border-white/5">
                            <h2 className="text-sm font-black uppercase tracking-widest text-[var(--accent)] mb-8">
                                Automation
                            </h2>
                            <div className="flex items-start gap-4 p-5 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400">
                                <div className="mt-1 flex-shrink-0 animate-pulse">
                                    <div className="w-2 h-2 rounded-full bg-current" />
                                </div>
                                <p className="text-xs font-bold leading-relaxed">
                                    VAT and PLT are calculated automatically on each order. Receipt details below are used by checkout printing.
                                </p>
                            </div>
                        </section>
                    </div>

                    <section className="bg-[#121216] p-8 rounded-[2rem] border border-white/5">
                        <h2 className="text-sm font-black uppercase tracking-widest text-[var(--accent)] mb-8">
                            Receipt Footer
                        </h2>
                        <Field
                            label="Receipt Message"
                            value={info.receipt_footer || ''}
                            field="receipt_footer"
                            placeholder="Thank you for your visit."
                            icon={StickyNote}
                            multiline
                        />
                    </section>
                </div>

                <div className="lg:col-span-1">
                    <div className="sticky top-8 bg-[#0a0a0c] p-8 rounded-[2rem] border border-white/10 shadow-2xl">
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-[#8a8a99] mb-6 flex items-center justify-between">
                            Live Receipt Preview
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-[pulse_2s_ease-in-out_infinite]"></span>
                        </h2>

                        <div className="bg-black border border-white/5 rounded-xl p-6 font-mono text-center flex flex-col items-center">
                            <div className="w-full border-t-2 border-dashed border-white/20 mb-6" />

                            <div className="space-y-1.5 w-full">
                                <p className="font-black text-lg text-white uppercase tracking-widest">{info.name || 'RESTAURANT NAME'}</p>
                                {info.khmer_name && <p className="text-sm font-bold text-[#8a8a99] khmer">{info.khmer_name}</p>}
                                <div className="mt-4 space-y-1">
                                    {info.address && <p className="text-[10px] font-bold text-[#8a8a99] uppercase">{info.address}</p>}
                                    {info.phone && <p className="text-[10px] font-bold text-[#8a8a99]">TEL: {info.phone}</p>}
                                    {info.tin && <p className="text-[10px] font-bold text-[#8a8a99]">TIN: {info.tin}</p>}
                                </div>

                                <div className="w-full border-t border-dashed border-white/20 my-6" />
                                <p className="text-[10px] font-bold text-[#8a8a99]">... ORDER LINES ...</p>
                                <div className="w-full border-t border-dashed border-white/20 my-6" />

                                {(info.receipt_footer || DEFAULT.receipt_footer || '').split('\n').map((line, index) => (
                                    <p key={index} className="text-[10px] font-bold text-white/60 uppercase">{line}</p>
                                ))}
                            </div>

                            <div className="w-full border-t-2 border-dashed border-white/20 mt-6" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}