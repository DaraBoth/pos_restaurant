'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useOrder } from '@/providers/OrderProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { AlertTriangle, X } from 'lucide-react';

const STALE_MS = 24 * 60 * 60 * 1000;

export default function StaleRateBanner() {
    const { rateEffectiveFrom } = useOrder();
    const { t } = useLanguage();

    // Compute per-day dismissal key at render time so it stays correct across midnight.
    const today = new Date().toISOString().slice(0, 10);
    const dismissKey = `dineos.rate.dismissed.${today}`;

    const [mountMs] = useState<number>(() =>
        typeof window !== 'undefined' ? Date.now() : 0
    );
    const [dismissed, setDismissed] = useState<boolean>(() =>
        typeof window !== 'undefined'
            ? localStorage.getItem(dismissKey) === '1'
            : true
    );

    const isStale =
        mountMs > 0 &&
        rateEffectiveFrom != null &&
        mountMs - new Date(rateEffectiveFrom).getTime() > STALE_MS;

    if (!isStale || dismissed) return null;

    function handleDismiss() {
        if (typeof window !== 'undefined') {
            localStorage.setItem(dismissKey, '1');
        }
        setDismissed(true);
    }

    return (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/15 border-b border-amber-500/30 text-amber-400 text-xs font-bold">
            <AlertTriangle size={13} className="flex-shrink-0" />
            <Link href="/settings/business/exchange-rate" className="flex-1 hover:underline">
                {t('staleRateWarning')}
            </Link>
            <button
                onClick={handleDismiss}
                className="flex-shrink-0 p-0.5 rounded hover:bg-amber-500/20 transition-colors"
                aria-label={t('dismiss') ?? 'Dismiss'}
            >
                <X size={12} />
            </button>
        </div>
    );
}
