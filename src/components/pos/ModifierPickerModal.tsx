'use client';
import { useState } from 'react';
import { useLanguage } from '@/providers/LanguageProvider';
import { formatUsd } from '@/lib/currency';
import { X, Check } from 'lucide-react';
import type { Product, ProductModifierOption } from '@/types';

interface ModifierPickerModalProps {
    product: Product;
    onConfirm: (options: ProductModifierOption[]) => void;
    onClose: () => void;
}

export default function ModifierPickerModal({ product, onConfirm, onClose }: ModifierPickerModalProps) {
    const { t, lang } = useLanguage();
    const groups = (product.modifier_groups || [])
        .map(g => ({ ...g, options: g.options.filter(o => o.is_active !== 0) }))
        .filter(g => g.options.length > 0);
    // selected option ids
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const productName = lang === 'km' ? (product.khmer_name || product.name) : product.name;

    function toggleOption(group: typeof groups[number], optionId: string) {
        setSelected(prev => {
            const next = new Set(prev);
            if (group.multi_select !== 0) {
                if (next.has(optionId)) next.delete(optionId); else next.add(optionId);
            } else {
                // single-select: clear other options in this group, then set this one
                for (const o of group.options) next.delete(o.id);
                next.add(optionId);
            }
            return next;
        });
    }

    const allOptions: ProductModifierOption[] = groups.flatMap(g => g.options);
    const chosen = allOptions.filter(o => selected.has(o.id));
    const deltaTotal = chosen.reduce((s, o) => s + o.price_delta_cents, 0);
    const total = product.price_cents + deltaTotal;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-96 max-w-[92vw] mx-4 animate-fade-in flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-2 px-5 pt-4 pb-3 border-b border-[var(--border)]">
                    <div className="min-w-0">
                        <p className={`text-sm font-black text-[var(--foreground)] leading-tight line-clamp-2 ${lang === 'km' ? 'khmer' : ''}`}>{productName}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mt-0.5">{t('selectModifiers')}</p>
                    </div>
                    <button onClick={onClose} className="flex-shrink-0 p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--bg-elevated)] transition-all">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-4 space-y-4 overflow-y-auto">
                    {groups.map(group => {
                        const gName = lang === 'km' ? (group.name_km || group.name) : group.name;
                        return (
                            <div key={group.id} className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-black uppercase tracking-widest text-[var(--text-secondary)]">{gName}</span>
                                    {group.required !== 0 && (
                                        <span className="text-[9px] font-black uppercase tracking-wider text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5">{t('required')}</span>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {group.options.map(o => {
                                        const oName = lang === 'km' ? (o.name_km || o.name) : o.name;
                                        const isSel = selected.has(o.id);
                                        return (
                                            <button
                                                key={o.id}
                                                onClick={() => toggleOption(group, o.id)}
                                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 ${isSel
                                                    ? 'bg-[var(--accent)]/15 border-[var(--accent)] text-[var(--accent)]'
                                                    : 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)]/50'}`}
                                            >
                                                {isSel && <Check size={12} strokeWidth={3} />}
                                                <span className={lang === 'km' ? 'khmer' : ''}>{oName}</span>
                                                {o.price_delta_cents !== 0 && (
                                                    <span className="font-mono opacity-70">{o.price_delta_cents > 0 ? '+' : ''}{formatUsd(o.price_delta_cents)}</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="p-4 border-t border-[var(--border)]">
                    <button
                        onClick={() => onConfirm(chosen)}
                        className="w-full py-3 rounded-xl bg-[var(--accent)] text-black font-black text-sm uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        {t('addToCart')} · {formatUsd(total)}
                    </button>
                </div>
            </div>
        </div>
    );
}
