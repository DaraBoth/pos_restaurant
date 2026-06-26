'use client';
import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * Bilingual confirm modal — replaces window.confirm(), which returns false
 * synchronously in some Tauri WebView builds and cannot be translated.
 * Callers pass already-translated strings via t().
 */
export default function ConfirmDialog({
    open, title, message, confirmLabel, cancelLabel, danger = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
            else if (e.key === 'Enter') { e.preventDefault(); onConfirm(); }
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onConfirm, onCancel]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
        >
            <div
                className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-96 max-w-[90vw] mx-4 p-6 space-y-4 animate-fade-in"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-2.5">
                    {danger && (
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-500/10 border border-red-500/20 text-red-500 flex-shrink-0">
                            <AlertTriangle size={18} />
                        </div>
                    )}
                    <h3 className={`text-sm font-black uppercase tracking-widest ${danger ? 'text-red-500' : 'text-[var(--foreground)]'}`}>
                        {title}
                    </h3>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">{message}</p>
                <div className="flex gap-2 pt-1">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-all"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-white transition-all ${danger ? 'bg-red-500 hover:bg-red-600' : 'bg-[var(--accent)] hover:brightness-110'}`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
