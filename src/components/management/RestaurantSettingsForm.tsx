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
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Toast from '@/components/ui/Toast';

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
    receipt_footer_khmer: '',
    receipt_width: '80mm',
    license_expires_at: '',
    license_support_contact: '',
    business_type: 'Restaurant/Pub/Bar',
    disable_tables: 0,
    vat_enabled: 0,
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
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
    const [confirmRemoveLogo, setConfirmRemoveLogo] = useState(false);
    const [pendingBizType, setPendingBizType] = useState<string | null>(null);

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
                        receipt_footer_khmer: restaurant.receipt_footer_khmer || '',
                        receipt_width: restaurant.receipt_width || '80mm',
                        license_expires_at: restaurant.license_expires_at || '',
                        license_support_contact: restaurant.license_support_contact || '',
                        business_type: restaurant.business_type || 'Restaurant/Pub/Bar',
                        disable_tables: restaurant.disable_tables || 0,
                        vat_enabled: restaurant.vat_enabled ?? 0,
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
    async function saveField(field: keyof RestaurantInput, value: RestaurantInput[keyof RestaurantInput]) {
        const updatedInfo = { ...info, [field]: value };
        try {
            await updateRestaurant(updatedInfo, restaurantId || undefined);
            setInfo(updatedInfo);
            // Dispatch update event
            window.dispatchEvent(new Event('business-updated'));
            return true;
        } catch (error) {
            console.error(error);
            setToast({ msg: t('failedUpdateBusiness'), ok: false });
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
            setToast({ msg: t('failedProcessLogo'), ok: false });
        }
    }

    function handleLogoRemove() {
        setConfirmRemoveLogo(true);
    }

    async function doLogoRemove() {
        setConfirmRemoveLogo(false);
        await saveField('logo_path', '');
    }

    // Business type dynamic redirect & warning change handler
    const handleBusinessTypeChange = (newType: string) => {
        if (newType === info.business_type) return;
        setPendingBizType(newType);
    };

    async function doBusinessTypeChange() {
        const newType = pendingBizType;
        setPendingBizType(null);
        if (!newType) return;
        // Reset disable tables flag if not coffee shop
        const disableTablesVal = newType === 'Coffee Shop' ? info.disable_tables : 0;
        const updatedInfo = {
            ...info,
            business_type: newType,
            disable_tables: disableTablesVal
        };
        try {
            await updateRestaurant(updatedInfo, restaurantId || undefined);
            window.dispatchEvent(new Event('business-updated'));
            window.location.reload();
        } catch (e) {
            console.error(e);
            setToast({ msg: t('failedUpdateBusinessType'), ok: false });
        }
    }

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
                        <Building2 size={13} /> {t('settingsIdentityType')}
                    </button>
                    <button
                        onClick={() => setActiveSubTab('address')}
                        className={`px-3 py-2 border-b-2 text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                            activeTab === 'address'
                                ? 'border-[var(--accent-blue)] text-[var(--accent-blue)] font-black'
                                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--foreground)]'
                        }`}
                    >
                        <MapPin size={13} /> {t('settingsAddressDetails')}
                    </button>
                    <button
                        onClick={() => setActiveSubTab('branding')}
                        className={`px-3 py-2 border-b-2 text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                            activeTab === 'branding'
                                ? 'border-[var(--accent-blue)] text-[var(--accent-blue)] font-black'
                                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--foreground)]'
                        }`}
                    >
                        <ImageIcon size={13} /> {t('settingsBrandingReceipt')}
                    </button>
                    <button
                        onClick={() => setActiveSubTab('operational')}
                        className={`px-3 py-2 border-b-2 text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                            activeTab === 'operational'
                                ? 'border-[var(--accent-blue)] text-[var(--accent-blue)] font-black'
                                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--foreground)]'
                        }`}
                    >
                        <Info size={13} /> {t('settingsOperational')}
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
                                {t('settingsBusinessType')}
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
                                    {t('settingsBusinessTypeWarning')}
                                </p>
                            </div>
                        </div>

                        {/* Text fields editable in-place via pencil/checkmark buttons */}
                        <EditableField label={t('settingsBizNameEn')} value={info.name || ''} onSave={val => saveField('name', val)} placeholder="Volt Coffee" icon={Building2} />
                        <EditableField label={t('settingsBizNameKh')} value={info.khmer_name || ''} onSave={val => saveField('khmer_name', val)} placeholder="ហាងកាហ្វេវ៉ុល" icon={Building2} />
                        <EditableField label={t('settingsPhoneNumber')} value={info.phone || ''} onSave={val => saveField('phone', val)} placeholder="+855 12 345 678" icon={Phone} />
                        <EditableField label={t('settingsWebsiteUrl')} value={info.website || ''} onSave={val => saveField('website', val)} placeholder="voltcoffee.kh" icon={Globe} />

                        {/* VAT Registration Toggle — grouped with the other business-registration fields */}
                        <div className="space-y-4 p-4 border border-[var(--border)] rounded-2xl">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <p className="text-xs font-black text-[var(--foreground)] uppercase tracking-widest">{t('settingsVatRegistration')}</p>
                                    <p className="text-[10px] text-[var(--text-secondary)] opacity-70 max-w-md">
                                        {t('settingsVatDesc')}
                                    </p>
                                </div>
                                <button
                                    onClick={async () => {
                                        const newVal = (info.vat_enabled ?? 0) === 1 ? 0 : 1;
                                        await saveField('vat_enabled', newVal);
                                    }}
                                    className="focus:outline-none transition-all hover:scale-105 active:scale-95 flex-shrink-0"
                                >
                                    {(info.vat_enabled ?? 0) === 1 ? (
                                        <ToggleRight size={38} className="text-[var(--accent-blue)]" />
                                    ) : (
                                        <ToggleLeft size={38} className="text-[var(--text-secondary)]" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. ADDRESS DETAILS TAB */}
                {activeTab === 'address' && (
                    <div className="space-y-6 animate-fade-in">
                        <EditableField label={t('settingsAddressEn')} value={info.address || ''} onSave={val => saveField('address', val)} placeholder="No. 123, Monivong Blvd, Phnom Penh" icon={MapPin} />
                        <EditableField label={t('settingsAddressKh')} value={info.address_kh || ''} onSave={val => saveField('address_kh', val)} placeholder="ផ្ទះលេខ ១២៣ មហាវិថីមុនីវង្ស ភ្នំពេញ" icon={MapPin} />
                    </div>
                )}

                {/* 3. BRANDING & RECEIPT COMBINED TAB */}
                {activeTab === 'branding' && (
                    <div className="space-y-6 animate-fade-in">
                        
                        {/* Logo upload - instant save, no save button */}
                        <div className="border-b border-[var(--border)] pb-5">
                            <label className="block text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60 mb-3">
                                {t('settingsLogoImage')}
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
                                    <h3 className="text-xs font-black text-[var(--foreground)]">{t('settingsLogoTitle')}</h3>
                                    <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                                        {t('settingsLogoDesc')}
                                    </p>
                                    {info.logo_path && (
                                        <button
                                            onClick={handleLogoRemove}
                                            className="text-[9px] font-black text-red-500 uppercase tracking-widest mt-2 hover:text-red-400 block transition-all"
                                        >
                                            {t('settingsLogoRemove')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Receipt Paper Size Dropdown */}
                        <div className="border-b border-[var(--border)] pb-5 space-y-2.5">
                            <label className="block text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60">
                                {t('settingsReceiptPaperSize')}
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
                            label={t('settingsReceiptFooter')}
                            value={info.receipt_footer || ''}
                            onSave={val => saveField('receipt_footer', val)}
                            placeholder="Thank you for your visit!\nPlease come again."
                            icon={StickyNote}
                            multiline
                        />
                        <EditableField
                            label={t('settingsKhmerFooter')}
                            value={info.receipt_footer_khmer || ''}
                            onSave={val => saveField('receipt_footer_khmer', val)}
                            placeholder="អរគុណ!\nសូមមកម្ដងទៀត"
                            icon={StickyNote}
                            multiline
                        />
                    </div>
                )}

                {/* 4. OPERATIONAL SETTINGS TAB */}
                {activeTab === 'operational' && (
                    <div className="space-y-5 animate-fade-in">
                        <h3 className="text-xs font-black text-[var(--foreground)] flex items-center gap-1.5 border-b border-[var(--border)] pb-3">
                            <Info size={14} className="text-[var(--accent-blue)]" /> {t('settingsCoreModuleOps')}
                        </h3>

                        {info.business_type === 'Coffee Shop' ? (
                            <div className="flex items-center justify-between p-4 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl max-w-3xl">
                                <div className="space-y-1.5 flex-1 pr-4">
                                    <p className="text-xs font-bold text-[var(--foreground)]">{t('settingsDisableTables')}</p>
                                    <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                                        {t('settingsDisableTablesDesc')}
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
                                    <p className="font-bold uppercase tracking-wider text-amber-200">{t('settingsRetailModeActive')}</p>
                                    <p className="mt-1">
                                        {t('settingsRetailModeDesc')}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 bg-sky-500/10 border border-sky-500/20 text-sky-300 rounded-2xl flex gap-3 text-[10px] leading-relaxed max-w-3xl">
                                <Info size={16} className="flex-shrink-0 mt-0.5 text-sky-400" />
                                <div>
                                    <p className="font-bold uppercase tracking-wider text-sky-200">{t('settingsRestaurantModeActive')}</p>
                                    <p className="mt-1">
                                        {t('settingsRestaurantModeDesc')}
                                    </p>
                                </div>
                            </div>
                        )}

                        {info.license_expires_at && (
                            <div className="p-4 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl space-y-1 max-w-3xl">
                                <p className="text-[9px] font-black uppercase text-[var(--text-secondary)] opacity-60">{t('settingsLicenseValidity')}</p>
                                <p className="text-xs font-bold text-[var(--foreground)]">{t('settingsLicenseValidUntil')} {info.license_expires_at}.</p>
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
                        {t('settingsBack')}
                    </button>

                    {activeTab === 'operational' ? (
                        <button
                            onClick={onNext}
                            className="px-5 py-2.5 rounded-xl bg-[var(--accent-blue)] text-white text-xs font-black flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[var(--accent-blue)]/20"
                        >
                            {t('settingsGetStarted')} <ArrowRight size={14} />
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
                            {t('settingsNext')} <ArrowRight size={14} />
                        </button>
                    )}
                </div>
            )}

            <ConfirmDialog
                open={confirmRemoveLogo}
                danger
                title={t('removeLogo')}
                message={t('removeLogoConfirm')}
                confirmLabel={t('removeLogo')}
                cancelLabel={t('cancel')}
                onConfirm={doLogoRemove}
                onCancel={() => setConfirmRemoveLogo(false)}
            />
            <ConfirmDialog
                open={pendingBizType !== null}
                title={t('changeBusinessType')}
                message={t('changeBusinessTypeWarning')}
                confirmLabel={t('confirm')}
                cancelLabel={t('cancel')}
                onConfirm={doBusinessTypeChange}
                onCancel={() => setPendingBizType(null)}
            />
            {toast && <Toast message={toast.msg} variant={toast.ok ? 'success' : 'error'} onClose={() => setToast(null)} />}
        </div>
    );
}