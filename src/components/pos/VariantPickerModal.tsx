'use client';
import { useLanguage } from '@/providers/LanguageProvider';
import { formatUsd } from '@/lib/currency';
import { X } from 'lucide-react';
import type { Product, ProductVariant } from '@/types';

interface VariantPickerModalProps {
    product: Product;
    onSelect: (variant: ProductVariant) => void;
    onClose: () => void;
}

export default function VariantPickerModal({ product, onSelect, onClose }: VariantPickerModalProps) {
    const { t, lang } = useLanguage();
    const variants = (product.variants || []).filter(v => v.is_active !== 0);
    const productName = lang === 'km' ? (product.khmer_name || product.name) : product.name;

    return (
        <div
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-80 max-w-[90vw] mx-4 animate-fade-in"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-2 px-5 pt-4 pb-3 border-b border-[var(--border)]">
                    <div className="min-w-0">
                        <p className={`text-sm font-black text-[var(--foreground)] leading-tight line-clamp-2 ${lang === 'km' ? 'khmer' : ''}`}>
                            {productName}
                        </p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mt-0.5">
                            {t('selectVariant')}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex-shrink-0 p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--bg-elevated)] transition-all"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="p-3 space-y-2 max-h-[60vh] overflow-y-auto">
                    {variants.map(v => {
                        const vName = lang === 'km' ? (v.name_km || v.name) : v.name;
                        return (
                            <button
                                key={v.id}
                                onClick={() => onSelect(v)}
                                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/10 active:scale-[0.98] transition-all text-left"
                            >
                                <span className={`text-sm font-bold text-[var(--foreground)] ${lang === 'km' ? 'khmer' : ''}`}>{vName}</span>
                                <span className="text-sm font-mono font-black text-[var(--accent-green)] flex-shrink-0">{formatUsd(v.price_cents)}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
