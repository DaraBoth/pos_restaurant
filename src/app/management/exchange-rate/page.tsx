'use client';
import { useState, useEffect } from 'react';
import { getExchangeRate, setExchangeRate, ExchangeRate } from '@/lib/tauri-commands';
import { useLanguage } from '@/providers/LanguageProvider';
import { formatKhr } from '@/lib/currency';
import { RefreshCw, Save, ArrowRightLeft } from 'lucide-react';

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
        } catch (e) {
            console.error(e);
            alert(t('error'));
        } finally {
            setLoading(false);
        }
    }

    const hasChanged = rate && parseInt(newRateInput, 10) !== rate.rate;

    return (
        <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-[#181a20] p-6 rounded-2xl border border-white/5 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#3b82f6]/10">
                        <ArrowRightLeft size={24} className="text-[#3b82f6]" strokeWidth={2} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-1">Currency Exchange</h1>
                        <p className="text-sm font-medium text-[var(--text-secondary)]">
                            Manage the USD ↔ KHR checkout calculation
                        </p>
                    </div>
                </div>

                <div className="flex gap-4">
                    {/* Active Status Pill */}
                    <div className="px-4 py-2.5 rounded-xl bg-[#0f1115] border border-white/5 flex items-center gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-[#3b82f6] animate-pulse" />
                        <span className="text-xs font-semibold tracking-wider text-[var(--text-secondary)] uppercase">Rate Active</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Current Rate Card */}
                <div className="bg-[#181a20] p-8 rounded-2xl border border-white/5 relative overflow-hidden shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-4 relative z-10">
                        Live Rate
                    </p>
                    
                    <div className="flex items-baseline gap-3 mb-2 relative z-10">
                        <div className="text-4xl font-bold font-mono text-[#3b82f6]">
                            {rate ? formatKhr(rate.rate * 100).replace('៛', '') : '---'}
                        </div>
                        <span className="text-lg font-bold text-[var(--text-secondary)]">KHR</span>
                    </div>
                    <p className="text-sm font-medium text-[var(--text-secondary)] relative z-10">
                        per 1.00 USD
                    </p>

                    <div className="mt-8 pt-6 border-t border-white/5 relative z-10">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">Last Updated</p>
                        <p className="text-sm font-bold text-white font-mono">
                            {rate && rate.effective_from ? new Date(rate.effective_from + 'Z').toLocaleString() : 'Never'}
                        </p>
                    </div>
                </div>

                {/* Set New Rate Card */}
                <div className="bg-[#181a20] p-8 rounded-2xl border border-white/5 flex flex-col relative shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-4">
                        Adjust Rate
                    </p>
                    
                    <div className="relative mb-6">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 font-mono font-bold text-[var(--text-secondary)] text-xl">
                            ៛
                        </span>
                        <input
                            type="number"
                            value={newRateInput}
                            onChange={e => setNewRateInput(e.target.value)}
                            className="w-full bg-[#0f1115] border border-white/5 text-[#3b82f6] pl-14 pr-6 py-5 rounded-xl text-3xl font-bold font-mono transition-all focus:border-[#3b82f6]/50 focus:outline-none"
                        />
                    </div>

                    <p className="text-xs font-medium text-[var(--text-secondary)] mb-auto">
                        Note: Updating immediately alters future checkouts. Historical orders keep their locked rate.
                    </p>

                    <button
                        onClick={handleUpdate}
                        disabled={loading || !newRateInput || !hasChanged}
                        className={`w-full mt-6 py-4 rounded-xl font-semibold uppercase tracking-wider text-sm flex items-center justify-center gap-2 transition-all ${
                            hasChanged 
                                ? 'bg-[#3b82f6] text-white hover:bg-blue-600 shadow-sm' 
                                : 'bg-white/5 text-[var(--text-secondary)] cursor-not-allowed border border-white/5'
                        }`}
                    >
                        {loading ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                        Save New Rate
                    </button>
                </div>
            </div>
        </div>
    );
}
