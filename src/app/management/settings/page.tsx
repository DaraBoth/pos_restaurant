'use client';
import { useState, useEffect } from 'react';
import { Building2, Save, RefreshCw, Phone, MapPin, Hash, Globe, StickyNote } from 'lucide-react';

const STORAGE_KEY = 'khpos_restaurant_info';

interface RestaurantInfo {
    name_en: string;
    name_kh: string;
    address_en: string;
    address_kh: string;
    phone: string;
    tax_id: string;
    vat_number: string;
    website: string;
    receipt_footer: string;
}

const DEFAULT: RestaurantInfo = {
    name_en: '',
    name_kh: '',
    address_en: '',
    address_kh: '',
    phone: '',
    tax_id: '',
    vat_number: '',
    website: '',
    receipt_footer: 'Thank you for dining with us!',
};

function loadInfo(): RestaurantInfo {
    if (typeof window === 'undefined') return DEFAULT;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
    } catch {
        return DEFAULT;
    }
}

export default function RestaurantSettingsPage() {
    const [info, setInfo] = useState<RestaurantInfo>(DEFAULT);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        setInfo(loadInfo());
    }, []);

    function update(field: keyof RestaurantInfo, value: string) {
        setInfo(prev => ({ ...prev, [field]: value }));
        setSaved(false);
    }

    function handleSave() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    }

    const Field = ({
        label, value, field, placeholder, icon: Icon, multiline
    }: {
        label: string;
        value: string;
        field: keyof RestaurantInfo;
        placeholder?: string;
        icon?: React.ElementType;
        multiline?: boolean;
    }) => (
        <div className="space-y-3">
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#8a8a99]">
                {Icon && <Icon size={14} className="text-[#a855f7]" />}
                {label}
            </label>
            {multiline ? (
                <textarea
                    value={value}
                    onChange={e => update(field, e.target.value)}
                    placeholder={placeholder}
                    rows={3}
                    className="w-full bg-black border border-white/10 text-white px-5 py-4 rounded-2xl text-sm font-bold transition-all focus:border-[#a855f7] focus:outline-none resize-none placeholder:text-white/20"
                />
            ) : (
                <input
                    type="text"
                    value={value}
                    onChange={e => update(field, e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-black border border-white/10 text-white px-5 py-4 rounded-2xl text-sm font-bold transition-all focus:border-[#a855f7] focus:outline-none placeholder:text-white/20"
                />
            )}
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto animate-fade-in space-y-8 pb-12">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-[#121216] p-8 rounded-[2rem] border border-white/5">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-[#a855f7] shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                        <Building2 size={28} color="#000" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black font-space tracking-tight text-white mb-1">Store Parameters</h1>
                        <p className="text-sm font-bold text-[#8a8a99] uppercase tracking-widest">
                            Configuration for receipts, identity, and compliance
                        </p>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={handleSave}
                        className={`px-8 py-4 rounded-xl font-black uppercase tracking-widest text-sm flex items-center gap-3 transition-all ${
                            saved
                                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                                : 'bg-[#a855f7] text-white hover:brightness-110 shadow-[0_0_20px_rgba(168,85,247,0.3)]'
                        }`}
                    >
                        {saved ? <><RefreshCw size={18} className="animate-spin" /> Applied</> : <><Save size={18} /> Update Config</>}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Form Fields */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Basic Info */}
                    <section className="bg-[#121216] p-8 rounded-[2rem] border border-white/5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#a855f7]/5 rounded-bl-[100px] pointer-events-none" />
                        <h2 className="text-sm font-black uppercase tracking-widest text-[#a855f7] mb-8">
                            Identity & Contact
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                            <Field label="Store Name (English)" value={info.name_en} field="name_en" placeholder="Volt Burger" icon={Building2} />
                            <Field label="Store Name (Khmer)" value={info.name_kh} field="name_kh" placeholder="ហាងប៊ឺហ្គឺវ៉ុល" icon={Building2} />
                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Field label="Address (English)" value={info.address_en} field="address_en" placeholder="123 Neon Ave" icon={MapPin} />
                                <Field label="Address (Khmer)" value={info.address_kh} field="address_kh" placeholder="១២៣ ផ្លូវនីអុង" icon={MapPin} />
                            </div>
                            <Field label="Phone Line" value={info.phone} field="phone" placeholder="+855 ..." icon={Phone} />
                            <Field label="Web Portal" value={info.website} field="website" placeholder="voltburger.kh" icon={Globe} />
                        </div>
                    </section>

                    {/* Tax Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <section className="bg-[#121216] p-8 rounded-[2rem] border border-white/5">
                            <h2 className="text-sm font-black uppercase tracking-widest text-[#a855f7] mb-8">
                                Compliance
                            </h2>
                            <div className="space-y-6">
                                <Field label="Tax ID (TIN)" value={info.tax_id} field="tax_id" placeholder="K000-0000..." icon={Hash} />
                                <Field label="VAT Number" value={info.vat_number} field="vat_number" placeholder="VAT-..." icon={Hash} />
                            </div>
                        </section>

                        <section className="bg-[#121216] p-8 rounded-[2rem] border border-white/5">
                            <h2 className="text-sm font-black uppercase tracking-widest text-[#a855f7] mb-8">
                                Automation
                            </h2>
                            <div className="flex items-start gap-4 p-5 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400">
                                <div className="mt-1 flex-shrink-0 animate-pulse">
                                    <div className="w-2 h-2 rounded-full bg-current" />
                                </div>
                                <p className="text-xs font-bold leading-relaxed">
                                    System automatically applies 10% VAT and 3% PLT constraints to all generated checkout sessions globally.
                                </p>
                            </div>
                        </section>
                    </div>

                    {/* Receipt Footer */}
                    <section className="bg-[#121216] p-8 rounded-[2rem] border border-white/5">
                        <h2 className="text-sm font-black uppercase tracking-widest text-[#a855f7] mb-8">
                            Receipt Footer
                        </h2>
                        <Field
                            label="Terminal Message"
                            value={info.receipt_footer}
                            field="receipt_footer"
                            placeholder="Thank you for your visit."
                            icon={StickyNote}
                            multiline
                        />
                    </section>
                </div>

                {/* Right Column: Preview Terminal */}
                <div className="lg:col-span-1">
                    <div className="sticky top-8 bg-[#0a0a0c] p-8 rounded-[2rem] border border-white/10 shadow-2xl">
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-[#8a8a99] mb-6 flex items-center justify-between">
                            Live Receipt Preview
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-[pulse_2s_ease-in-out_infinite]"></span>
                        </h2>
                        
                        <div className="bg-black border border-white/5 rounded-xl p-6 font-mono text-center flex flex-col items-center">
                            {/* Paper zig-zag top */}
                            <div className="w-full border-t-2 border-dashed border-white/20 mb-6" />
                            
                            <div className="space-y-1.5 w-full">
                                {info.name_en ? (
                                    <p className="font-black text-lg text-white font-space uppercase tracking-widest">{info.name_en}</p>
                                ) : (
                                    <p className="font-black text-lg text-white/20 font-space uppercase tracking-widest">STORE_NAME</p>
                                )}
                                
                                {info.name_kh && <p className="text-sm font-bold text-[#8a8a99] khmer">{info.name_kh}</p>}
                                
                                <div className="mt-4 space-y-1">
                                    {info.address_en && <p className="text-[10px] font-bold text-[#8a8a99] uppercase">{info.address_en}</p>}
                                    {info.phone && <p className="text-[10px] font-bold text-[#8a8a99]">TEL: {info.phone}</p>}
                                    {info.tax_id && <p className="text-[10px] font-bold text-[#8a8a99]">TIN: {info.tax_id}</p>}
                                </div>
                                
                                <div className="w-full border-t border-dashed border-white/20 my-6" />
                                
                                <p className="text-[10px] font-bold text-[#8a8a99]">... TRANSACTION DATA ...</p>
                                
                                <div className="w-full border-t border-dashed border-white/20 my-6" />
                                
                                {(info.receipt_footer || 'END OF RECEIPT').split('\n').map((line, i) => (
                                    <p key={i} className="text-[10px] font-bold text-white/60 uppercase">{line}</p>
                                ))}
                            </div>
                            
                            {/* Paper zig-zag bottom */}
                            <div className="w-full border-t-2 border-dashed border-white/20 mt-6" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
