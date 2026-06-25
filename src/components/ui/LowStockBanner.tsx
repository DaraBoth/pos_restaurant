'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { getInventoryItems } from '@/lib/api/inventory';
import { AlertTriangle, X } from 'lucide-react';

const SESSION_KEY = 'dineos.lowstock.dismissed';

export default function LowStockBanner() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [lowCount, setLowCount] = useState(0);
    const [dismissed, setDismissed] = useState<boolean>(() =>
        typeof window !== 'undefined'
            ? sessionStorage.getItem(SESSION_KEY) === '1'
            : true
    );

    useEffect(() => {
        if (!user?.restaurant_id) return;
        getInventoryItems(user.restaurant_id)
            .then(items => setLowCount(items.filter(i => i.stock_qty <= i.min_stock_qty).length))
            .catch(() => setLowCount(0));
    }, [user?.restaurant_id]);

    if (lowCount === 0 || dismissed) return null;

    function handleDismiss() {
        if (typeof window !== 'undefined') {
            sessionStorage.setItem(SESSION_KEY, '1');
        }
        setDismissed(true);
    }

    const msg = (t('lowStockBanner') ?? '{count} items are low in stock — check Inventory').replace('{count}', String(lowCount));

    return (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-500/15 border-b border-red-500/30 text-red-400 text-xs font-bold">
            <AlertTriangle size={13} className="flex-shrink-0" />
            <Link href="/management/inventory" className="flex-1 hover:underline">
                {msg}
            </Link>
            <button
                onClick={handleDismiss}
                className="flex-shrink-0 p-0.5 rounded hover:bg-red-500/20 transition-colors"
                aria-label={t('dismiss') ?? 'Dismiss'}
            >
                <X size={12} />
            </button>
        </div>
    );
}
