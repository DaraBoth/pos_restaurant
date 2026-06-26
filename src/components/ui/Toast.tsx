'use client';
import { useEffect } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';

interface ToastProps {
    message: string;
    variant?: 'success' | 'error';
    duration?: number;
    onClose: () => void;
}

/**
 * Dismissible bottom-right toast — replaces window.alert() so messages can be
 * bilingual and non-blocking. Auto-dismisses after `duration` ms.
 */
export default function Toast({ message, variant = 'success', duration = 4000, onClose }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(onClose, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const isError = variant === 'error';

    return (
        <div className="fixed bottom-4 right-4 z-[500] animate-fade-in">
            <div className={`flex items-start gap-2.5 max-w-sm px-4 py-3 rounded-xl shadow-2xl border ${
                isError
                    ? 'bg-red-500/10 border-red-500/30 text-red-500'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
            } backdrop-blur-md`}>
                {isError ? <XCircle size={16} className="flex-shrink-0 mt-0.5" /> : <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />}
                <span className="text-xs font-bold leading-relaxed text-[var(--foreground)]">{message}</span>
                <button onClick={onClose} className="flex-shrink-0 text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors">
                    <X size={14} />
                </button>
            </div>
        </div>
    );
}
