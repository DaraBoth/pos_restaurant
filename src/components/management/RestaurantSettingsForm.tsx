'use client';

import { useEffect, useState } from 'react';
import { 
    Building2, Phone, MapPin, Globe, StickyNote, 
    Image as ImageIcon, ToggleLeft, ToggleRight, Info, Check, Edit2, ArrowRight 
} from 'lucide-react';
import { getRestaurant, updateRestaurant } from '@/lib/api/restaurant';
import type { RestaurantInput } from '@/types';
import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { CustomSelect } from '@/components/ui/CustomSelect';

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
    receipt_footer: 'Thank you',
    receipt_width: '80mm',
    license_expires_at: '',
    license_support_contact: '',
    business_type: 'Restaurant/Pub/Bar',
    disable_tables: 0,
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
    receipt_footer: 'Thank you\nPlease come again.',
    receipt_width: '80mm',
    business_type: 'Coffee Shop',
    disable_tables: 0,
};

type SubTabType = 'identity' | 'address' | 'branding' | 'operational';

interface RestaurantSettingsFormProps {
    mode: 'setup' | 'manage';
    activeSection?: SubTabType;
    onSaved?: () => void;
    onNext?: () => void;
}

interface EditableFieldProps {
    label: string;
    value: string;
    placeholder?: string;
    icon?: React.ElementType;
    multiline?: boolean;
    onSave: (val: string) => Promise<boolean>;
}

function EditableField({ label, value, placeholder, icon: Icon, multiline, onSave }: EditableFieldProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setTempValue(value);
    }, [value]);

    async function handleSave() {
        setSaving(true);
        const success = await onSave(tempValue);
        if (success) {
            setIsEditing(false);
        }
        setSaving(false);
    }

    return (
        <div className="border-b border-[var(--border)] pb-4 flex items-center justify-between gap-4">
            <div className="space-y-1 flex-1">
                <label className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-[var(--text-secondary)] opacity-60">
                    {Icon && <Icon size={12} className="text-[var(--accent-blue)]" />}
                    {label}
                </label>
                {isEditing ? (
                    <div className="flex gap-2 w-full mt-1.5">
                        {multiline ? (
                            <textarea
                                value={tempValue}
                                onChange={e => setTempValue(e.target.value)}
                                placeholder={placeholder}
                                rows={3}
                                className="flex-1 px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-xs font-bold text-[var(--foreground)] resize-none outline-none focus:border-[var(--accent-blue)] transition-all"
                            />
                        ) : (
                            <input
                                type="text"
                                value={tempValue}
                                onChange={e => setTempValue(e.target.value)}
                                placeholder={placeholder}
                                className="flex-1 px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-xs font-bold text-[var(--foreground)] outline-none focus:border-[var(--accent-blue)] transition-all"
                            />
                        )}
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-3 rounded-xl bg-[var(--accent-blue)] text-white hover:brightness-110 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50 h-fit py-2 self-end"
                        >
                            {saving ? '...' : <Check size={12} />}
                        </button>
                    </div>
                ) : (
                    <p className={`text-xs font-bold text-[var(--foreground)] leading-relaxed ${multiline ? 'whitespace-pre-wrap' : ''}`}>
                        {value || <span className="text-[var(--text-secondary)] opacity-40 font-normal">Not Set</span>}
                    </p>
                )}
            </div>
            {!isEditing && (
                <button
                    onClick={() => setIsEditing(true)}
                    className="p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--accent-blue)] transition-all cursor-pointer flex-shrink-0"
                >
                    <Edit2 size={13} />
                </button>
            )}
        </div>
    );
}

export default function RestaurantSettingsForm({ mode, activeSection, onSaved, onNext }: RestaurantSettingsFormProps) {
    const { user } = useAuth();
    const { t } = useLanguage();
    const restaurantId = user?.restaurant_id;
    const [info, setInfo] = useState<RestaurantInput>(DEFAULT);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeSubTab, setActiveSubTab] = useState<SubTabType>('identity');

    useEffect(() => {
        let cancelled = false;

        async function loadRestaurant() {
            try {
                const restaurant = await getRestaurant(restaurantId || undefined);
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
                        logo_path: restaurant.logo_path || '',
                        receipt_footer: restaurant.receipt_footer || DEFAULT.receipt_footer,
                        receipt_width: restaurant.receipt_width || '80mm',
                        license_expires_at: restaurant.license_expires_at || '',
                        license_support_contact: restaurant.license_support_contact || '',
                        business_type: restaurant.business_type || 'Restaurant/Pub/Bar',
                        disable_tables: restaurant.disable_tables || 0,
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

    // Save field function for automatic / checkmark saving
    async function saveField(field: keyof RestaurantInput, value: any) {
        const updatedInfo = { ...info, [field]: value };
        try {
            await updateRestaurant(updatedInfo, restaurantId || undefined);
            setInfo(updatedInfo);
            // Dispatch update event
            window.dispatchEvent(new Event('business-updated'));
            return true;
        } catch (error) {
            console.error(error);
            alert('Failed to update business configuration.');
            return false;
        }
    }

    async function handleLogoUpload(file: File) {
        try {
            const dataUri = await new Promise<string>((resolve, reject) => {
                const img = new window.Image();
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
            await saveField('logo_path', dataUri);
        } catch (error) {
            console.error('Failed to save logo:', error);
            alert('Failed to process business logo.');
        }
    }

    async function handleLogoRemove() {
        if (window.confirm('Are you sure you want to remove the business logo?')) {
            await saveField('logo_path', '');
        }
    }

    // Business type dynamic redirect & warning alert change handler
    const handleBusinessTypeChange = async (newType: string) => {
        if (newType === info.business_type) return;
        
        const confirmChange = window.confirm(
            "WARNING:\nChanging the Business Type will re-configure your core POS features. This action requires a full page reload to apply the new UI elements.\n\nAre you sure you want to change your Business Type?"
        );
        
        if (confirmChange) {
            // Reset disable tables flag if not coffee shop
            const disableTablesVal = newType === 'Coffee Shop' ? info.disable_tables : 0;
            
            const updatedInfo = { 
                ...info, 
                business_type: newType,
                disable_tables: disableTablesVal
            };
            
            try {
                await updateRestaurant(updatedInfo, restaurantId || undefined);
                // Dispatch event and reload immediately
                window.dispatchEvent(new Event('business-updated'));
                window.location.reload();
            } catch (e) {
                console.error(e);
                alert('Failed to update business type.');
            }
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[30vh]">
                <div className="w-8 h-8 border-2 border-white/20 border-t-[var(--accent-blue)] rounded-full animate-spin" />
            </div>
        );
    }

    const businessTypes = ['Coffee Shop', 'Restaurant/Pub/Bar', 'Mart/Accessories Shop/Pharmacy/Bakery'];
    const activeTab = activeSection || activeSubTab;

    return (
        <div className="animate-fade-in w-full">
            
            {/* Horizontal tabs (only visible in setup onboarding mode since manage mode uses sidebar tabs) */}
            {!activeSection && (
                <div className="flex border-b border-[var(--border)] overflow-x-auto no-scrollbar gap-1 mb-6">
                    <button
                        onClick={() => setActiveSubTab('identity')}
                        className={`px-3 py-2 border-b-2 text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                            activeTab === 'identity'
                                ? 'border-[var(--accent-blue)] text-[var(--accent-blue)] font-black'
                                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--foreground)]'
                        }`}
                    >
                        <Building2 size={13} /> Identity & Type
                    </button>
                    <button
                        onClick={() => setActiveSubTab('address')}
                        className={`px-3 py-2 border-b-2 text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                            activeTab === 'address'
                                ? 'border-[var(--accent-blue)] text-[var(--accent-blue)] font-black'
                                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--foreground)]'
                        }`}
                    >
                        <MapPin size={13} /> Address Details
                    </button>
                    <button
                        onClick={() => setActiveSubTab('branding')}
                        className={`px-3 py-2 border-b-2 text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                            activeTab === 'branding'
                                ? 'border-[var(--accent-blue)] text-[var(--accent-blue)] font-black'
                                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--foreground)]'
                        }`}
                    >
                        <ImageIcon size={13} /> Branding & Receipt
                    </button>
                    <button
                        onClick={() => setActiveSubTab('operational')}
                        className={`px-3 py-2 border-b-2 text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                            activeTab === 'operational'
                                ? 'border-[var(--accent-blue)] text-[var(--accent-blue)] font-black'
                                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--foreground)]'
                        }`}
                    >
                        <Info size={13} /> Operational Settings
                    </button>
                </div>
            )}

            {/* Sub-tab Content Panels - Autosave inputs following Account Settings Edit UI style */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 min-h-[30vh] space-y-6">
                
                {/* 1. IDENTITY & TYPE TAB */}
                {activeTab === 'identity' && (
                    <div className="space-y-6 animate-fade-in">
                        {/* Business Type Dropdown - Autosaves upon selection with Reload Page confirmation warning */}
                        <div className="border-b border-[var(--border)] pb-5 space-y-2.5">
                            <label className="block text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60">
                                Business Type
                            </label>
                            <div className="max-w-md">
                                <CustomSelect
                                    value={info.business_type || 'Restaurant/Pub/Bar'}
                                    onChange={(val) => handleBusinessTypeChange(val)}
                                    options={businessTypes.map(t => ({ label: t, value: t }))}
                                />
                            </div>
                            <div className="bg-amber-500/10 rounded-xl p-3 border border-amber-500/20 text-amber-300 text-[10px] leading-relaxed max-w-xl flex gap-2">
                                <Info size={14} className="flex-shrink-0 text-amber-400 mt-0.5" />
                                <p className="font-semibold uppercase tracking-wider">
                                    Changing your business type will automatically reload the application to correctly configure the POS module components.
                                </p>
                            </div>
                        </div>

                        {/* Text fields editable in-place via pencil/checkmark buttons */}
                        <EditableField label="Business Name (English)" value={info.name || ''} onSave={val => saveField('name', val)} placeholder="Volt Coffee" icon={Building2} />
                        <EditableField label="Business Name (Khmer)" value={info.khmer_name || ''} onSave={val => saveField('khmer_name', val)} placeholder="ហាងកាហ្វេវ៉ុល" icon={Building2} />
                        <EditableField label="Phone Number" value={info.phone || ''} onSave={val => saveField('phone', val)} placeholder="+855 12 345 678" icon={Phone} />
                        <EditableField label="Website Url" value={info.website || ''} onSave={val => saveField('website', val)} placeholder="voltcoffee.kh" icon={Globe} />
                    </div>
                )}

                {/* 2. ADDRESS DETAILS TAB */}
                {activeTab === 'address' && (
                    <div className="space-y-6 animate-fade-in">
                        <EditableField label="Address (English)" value={info.address || ''} onSave={val => saveField('address', val)} placeholder="No. 123, Monivong Blvd, Phnom Penh" icon={MapPin} />
                        <EditableField label="Address (Khmer)" value={info.address_kh || ''} onSave={val => saveField('address_kh', val)} placeholder="ផ្ទះលេខ ១២៣ មហាវិថីមុនីវង្ស ភ្នំពេញ" icon={MapPin} />
                    </div>
                )}

                {/* 3. BRANDING & RECEIPT COMBINED TAB */}
                {activeTab === 'branding' && (
                    <div className="space-y-6 animate-fade-in">
                        
                        {/* Logo upload - instant save, no save button */}
                        <div className="border-b border-[var(--border)] pb-5">
                            <label className="block text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60 mb-3">
                                Business Logo Image
                            </label>
                            <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl max-w-2xl">
                                <div className="relative group flex-shrink-0">
                                    <div className="w-24 h-24 rounded-2xl bg-[var(--bg-dark)] border-2 border-dashed border-[var(--border)] flex items-center justify-center overflow-hidden">
                                        {info.logo_path ? (
                                            <img src={info.logo_path} alt="Logo" className="w-full h-full object-cover animate-fade-in" />
                                        ) : (
                                            <span className="text-[10px] text-[var(--accent-blue)] opacity-40 font-bold">LOGO</span>
                                        )}
                                    </div>
                                    <label className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-[var(--accent-blue)] text-white flex items-center justify-center shadow-md cursor-pointer hover:scale-110 active:scale-95 transition-all">
                                        <ArrowRight size={14} className="-rotate-90" />
                                        <input type="file" className="hidden" accept="image/*" onChange={e => {
                                            const file = e.target.files?.[0];
                                            if (file) handleLogoUpload(file);
                                        }} />
                                    </label>
                                </div>
                                <div className="space-y-1 text-center sm:text-left">
                                    <h3 className="text-xs font-black text-[var(--foreground)]">Transparent Logo</h3>
                                    <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                                        Upload a PNG logo for print checkouts. It will save and synchronize across all POS views instantly.
                                    </p>
                                    {info.logo_path && (
                                        <button 
                                            onClick={handleLogoRemove}
                                            className="text-[9px] font-black text-red-500 uppercase tracking-widest mt-2 hover:text-red-400 block transition-all"
                                        >
                                            Remove Business Logo
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Receipt Paper Size Dropdown */}
                        <div className="border-b border-[var(--border)] pb-5 space-y-2.5">
                            <label className="block text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60">
                                Receipt Paper Size
                            </label>
                            <div className="max-w-md">
                                <CustomSelect
                                    value={info.receipt_width || '80mm'}
                                    onChange={(val) => saveField('receipt_width', val)}
                                    options={[
                                        { label: '80mm (Standard POS / Epson TM-T88)', value: '80mm' },
                                        { label: '58mm (Small Thermal Printer)', value: '58mm' }
                                    ]}
                                />
                            </div>
                        </div>

                        {/* Receipt Footer Message - editable via Pencil + Checkmark style */}
                        <EditableField
                            label="Receipt Message Footer"
                            value={info.receipt_footer || ''}
                            onSave={val => saveField('receipt_footer', val)}
                            placeholder="Thank you for your visit!\nPlease come again."
                            icon={StickyNote}
                            multiline
                        />
                    </div>
                )}

                {/* 4. OPERATIONAL SETTINGS TAB */}
                {activeTab === 'operational' && (
                    <div className="space-y-5 animate-fade-in">
                        <h3 className="text-xs font-black text-[var(--foreground)] flex items-center gap-1.5 border-b border-[var(--border)] pb-3">
                            <Info size={14} className="text-[var(--accent-blue)]" /> Core Module Operations
                        </h3>

                        {info.business_type === 'Coffee Shop' ? (
                            <div className="flex items-center justify-between p-4 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl max-w-3xl">
                                <div className="space-y-1.5 flex-1 pr-4">
                                    <p className="text-xs font-bold text-[var(--foreground)]">Disable Dining Tables</p>
                                    <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                                        Hide the dining floor plan if your coffee shop operates pure takeaway checkouts. Updates the sidebar navigation immediately.
                                    </p>
                                </div>
                                <button
                                    onClick={async () => {
                                        const newVal = info.disable_tables === 1 ? 0 : 1;
                                        await saveField('disable_tables', newVal);
                                    }}
                                    className="focus:outline-none transition-all hover:scale-105 active:scale-95"
                                >
                                    {info.disable_tables === 1 ? (
                                        <ToggleRight size={38} className="text-[var(--accent-blue)]" />
                                    ) : (
                                        <ToggleLeft size={38} className="text-[var(--text-secondary)]" />
                                    )}
                                </button>
                            </div>
                        ) : info.business_type === 'Mart/Accessories Shop/Pharmacy/Bakery' ? (
                            <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-2xl flex gap-3 text-[10px] leading-relaxed max-w-3xl">
                                <Info size={16} className="flex-shrink-0 mt-0.5 text-amber-400" />
                                <div>
                                    <p className="font-bold uppercase tracking-wider text-amber-200">Retail / Shop Mode Active</p>
                                    <p className="mt-1">
                                        Dining floor plans are automatically disabled for this mode. POS runs in high-speed scanning and cashier checkouts exclusively — ideal for Marts, Accessories Shops, Pharmacies, and Bakeries.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 bg-sky-500/10 border border-sky-500/20 text-sky-300 rounded-2xl flex gap-3 text-[10px] leading-relaxed max-w-3xl">
                                <Info size={16} className="flex-shrink-0 mt-0.5 text-sky-400" />
                                <div>
                                    <p className="font-bold uppercase tracking-wider text-sky-200">Restaurant / Pub / Bar Active</p>
                                    <p className="mt-1">
                                        Dining tables and zones are fully active to coordinate table orders, split guest invoices, and kitchen operations.
                                    </p>
                                </div>
                            </div>
                        )}

                        {info.license_expires_at && (
                            <div className="p-4 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl space-y-1 max-w-3xl">
                                <p className="text-[9px] font-black uppercase text-[var(--text-secondary)] opacity-60">License Validity</p>
                                <p className="text-xs font-bold text-[var(--foreground)]">This business license is valid until {info.license_expires_at}.</p>
                            </div>
                        )}
                    </div>
                )}

            </div>

            {/* Setup-mode footer — tab advance + final "Get Started" */}
            {mode === 'setup' && (
                <div className="mt-6 flex items-center justify-between">
                    <button
                        onClick={() => {
                            const tabs: SubTabType[] = ['identity', 'address', 'branding', 'operational'];
                            const idx = tabs.indexOf(activeTab as SubTabType);
                            if (idx > 0) setActiveSubTab(tabs[idx - 1]);
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--bg-elevated)] transition-all ${activeTab === 'identity' ? 'invisible' : ''}`}
                    >
                        ← Back
                    </button>

                    {activeTab === 'operational' ? (
                        <button
                            onClick={onNext}
                            className="px-5 py-2.5 rounded-xl bg-[var(--accent-blue)] text-white text-xs font-black flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[var(--accent-blue)]/20"
                        >
                            Get Started <ArrowRight size={14} />
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                const tabs: SubTabType[] = ['identity', 'address', 'branding', 'operational'];
                                const idx = tabs.indexOf(activeTab as SubTabType);
                                if (idx < tabs.length - 1) setActiveSubTab(tabs[idx + 1]);
                            }}
                            className="px-5 py-2.5 rounded-xl bg-[var(--accent-blue)] text-white text-xs font-black flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[var(--accent-blue)]/20"
                        >
                            Next <ArrowRight size={14} />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}