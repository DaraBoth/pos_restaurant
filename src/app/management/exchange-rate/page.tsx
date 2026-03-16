'use client';
import { useState, useEffect } from 'react';
import { getExchangeRate, setExchangeRate, getDbStatus, ExchangeRate } from '@/lib/tauri-commands';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatKhr } from '@/lib/currency';
import { Settings, RefreshCw } from 'lucide-react';

export default function ExchangeRateManagement() {
    const [rate, setRate] = useState<ExchangeRate | null>(null);
    const [newRateInput, setNewRateInput] = useState('');
    const [loading, setLoading] = useState(false);
    const { t } = useLanguage();

    useEffect(() => {
        loadRate();
    }, []);

    async function loadRate() {
        try {
            const current = await getExchangeRate();
            setRate(current);
            if (current) setNewRateInput(current.rate.toString());
        } catch (e) {
            console.error(e);
        }
    }

    async function handleUpdate() {
        const val = parseInt(newRateInput, 10);
        if (isNaN(val) || val <= 0) return alert('Invalid rate');

        setLoading(true);
        try {
            await setExchangeRate(val);
            await loadRate();
            alert('Updated successfully');
        } catch (e) {
            console.error(e);
            alert(t('error'));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="max-w-2xl mx-auto auto-fade-in relative z-10 space-y-6 pt-10">
            <div className="glass p-8 rounded-3xl border border-[var(--border)] relative overflow-hidden">

                {/* Background Decorative Icon */}
                <Settings className="absolute -bottom-10 -right-10 w-64 h-64 text-[var(--accent)]/5 -z-10" />

                <h1 className="text-3xl font-bold mb-2">Exchange Rate</h1>
                <p className="text-[var(--text-secondary)] mb-8">
                    Manage the system-wide USD to KHR exchange rate. This affects all prices and checkout calculations.
                </p>

                <div className="bg-[var(--bg-dark)] border border-[var(--border)] rounded-2xl p-6 mb-8 flex items-center justify-between">
                    <div>
                        <div className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Current Rate</div>
                        <div className="text-4xl font-black font-mono text-[var(--accent)]">
                            {rate ? formatKhr(rate.rate * 100).replace('៛', '') : '---'} <span className="text-xl text-[var(--text-secondary)] ml-1">KHR/USD</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-[var(--text-secondary)] mb-1">Last Updated</div>
                        <div className="text-sm font-medium">
                            {rate && rate.effective_from ? new Date(rate.effective_from + 'Z').toLocaleString() : 'Never'}
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <label className="block text-sm font-semibold text-[var(--text-secondary)]">
                        Set New Rate (KHR per 1 USD)
                    </label>
                    <div className="flex gap-4">
                        <input
                            type="number"
                            value={newRateInput}
                            onChange={e => setNewRateInput(e.target.value)}
                            className="input-dark flex-1 px-4 py-3 rounded-xl text-lg font-mono font-bold"
                        />
                        <button
                            onClick={handleUpdate}
                            disabled={loading || !newRateInput || parseInt(newRateInput) === rate?.rate}
                            className="btn-primary px-8 py-3 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <RefreshCw className="animate-spin" size={20} /> : 'Update Rate'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
