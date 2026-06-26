'use client';
import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/providers/LanguageProvider';
import { formatUsd } from '@/lib/currency';
import { X, Delete } from 'lucide-react';

interface QuantityModalProps {
    productName: string;
    unitPriceCents: number;
    isKhmer?: boolean;
    onConfirm: (qty: number) => void;
    onClose: () => void;
}

const MAX_QTY = 999;

export default function QuantityModal({ productName, unitPriceCents, isKhmer, onConfirm, onClose }: QuantityModalProps) {
    const { t } = useLanguage();
    const [value, setValue] = useState('1');

    const qty = Math.min(MAX_QTY, Math.max(0, parseInt(value || '0', 10) || 0));

    const confirm = useCallback(() => {
        if (qty > 0) onConfirm(qty);
    }, [qty, onConfirm]);

    const pressDigit = useCallback((d: string) => {
        setValue(prev => {
            const next = (prev === '0' ? '' : prev) + d;
            const n = parseInt(next, 10);
            if (isNaN(n)) return prev;
            if (n > MAX_QTY) return String(MAX_QTY);
            return String(n);
        });
    }, []);

    const backspace = useCallback(() => {
        setValue(prev => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
    }, []);

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key >= '0' && e.key <= '9') { pressDigit(e.key); e.preventDefault(); }
            else if (e.key === 'Backspace') { backspace(); e.preventDefault(); }
            else if (e.key === 'Enter') { confirm(); e.preventDefault(); }
            else if (e.key === 'Escape') { onClose(); e.preventDefault(); }
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [pressDigit, backspace, confirm, onClose]);

    return (
        <div
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-72 max-w-[90vw] mx-4 animate-fade-in"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 px-5 pt-4 pb-3 border-b border-[var(--border)]">
                    <div className="min-w-0">
                        <p className={`text-sm font-black text-[var(--foreground)] leading-tight line-clamp-2 ${isKhmer ? 'khmer' : ''}`}>
                            {productName}
                        </p>
                        <p className="text-xs font-mono font-bold text-[var(--accent-green)] mt-0.5">
                            {formatUsd(unitPriceCents)}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex-shrink-0 p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--bg-elevated)] transition-all"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Quantity display */}
                <div className="px-5 py-4 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-1">
                        {t('enterQuantity')}
                    </p>
                    <div className="text-4xl font-black font-mono text-[var(--foreground)] tabular-nums">{qty}</div>
                </div>

                {/* Keypad */}
                <div className="grid grid-cols-3 gap-2 px-5">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(k => (
                        <button
                            key={k}
                            onClick={() => pressDigit(k)}
                            className="py-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-lg font-black text-[var(--foreground)] hover:bg-[var(--accent)]/15 active:scale-95 transition-all"
                        >
                            {k}
                        </button>
                    ))}
                    <button
                        onClick={() => setValue('0')}
                        className="py-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-sm font-black text-[var(--text-secondary)] hover:text-[var(--foreground)] active:scale-95 transition-all"
                    >
                        C
                    </button>
                    <button
                        onClick={() => pressDigit('0')}
                        className="py-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-lg font-black text-[var(--foreground)] hover:bg-[var(--accent)]/15 active:scale-95 transition-all"
                    >
                        0
                    </button>
                    <button
                        onClick={backspace}
                        className="py-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-red-500 active:scale-95 transition-all flex items-center justify-center"
                    >
                        <Delete size={18} />
                    </button>
                </div>

                {/* Confirm */}
                <div className="px-5 py-4">
                    <button
                        onClick={confirm}
                        disabled={qty <= 0}
                        className="w-full py-3 rounded-xl bg-[var(--accent)] text-black font-black text-sm uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {t('addToCart')} · {qty}
                    </button>
                </div>
            </div>
        </div>
    );
}
