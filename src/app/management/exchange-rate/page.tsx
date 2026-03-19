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
        <div className="animate-fade-in space-y-6">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--bg-card)] p-5 rounded-2xl border border-[var(--border)]">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-500/15 border border-blue-500/30">
                        <ArrowRightLeft size={18} className="text-blue-400" strokeWidth={2} />
                    </div>
                    <div>
                        <h1 className="text-base font-black text-[var(--foreground)] leading-none">Currency Exchange</h1>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                            Manage the USD ↔ KHR checkout calculation
                        </p>
                    </div>
                </div>

                <div className="flex gap-3">
                    {/* Active Status Pill */}
                    <div className="px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                        <span className="text-[10px] font-black tracking-wider text-[var(--text-secondary)] uppercase">Rate Active</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Current Rate Card */}
                <div className="bg-[var(--bg-card)] p-6 rounded-2xl border border-[var(--border)] relative overflow-hidden">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-4 relative z-10">
                        Live Rate
                    </p>
                    
                    <div className="flex items-baseline gap-3 mb-2 relative z-10">
                        <div className="text-3xl font-black font-mono text-blue-400">
                            {rate ? formatKhr(rate.rate * 100).replace('៛', '') : '---'}
                        </div>
                        <span className="text-base font-black text-[var(--text-secondary)]">KHR</span>
                    </div>
                    <p className="text-xs font-medium text-[var(--text-secondary)] relative z-10">
                        per 1.00 USD
                    </p>

                    <div className="mt-6 pt-4 border-t border-[var(--border)] relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-1">Last Updated</p>
                        <p className="text-sm font-bold text-[var(--foreground)] font-mono">
                            {rate && rate.effective_from ? new Date(rate.effective_from + 'Z').toLocaleString() : 'Never'}
                        </p>
                    </div>
                </div>

                {/* Set New Rate Card */}
                <div className="bg-[var(--bg-card)] p-6 rounded-2xl border border-[var(--border)] flex flex-col">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-4">
                        Adjust Rate
                    </p>
                    
                    <div className="relative mb-4">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-black text-[var(--text-secondary)] text-lg">
                            ៛
                        </span>
                        <input
                            type="number"
                            value={newRateInput}
                            onChange={e => setNewRateInput(e.target.value)}
                            className="w-full bg-white/[0.07] border border-white/20 text-blue-400 pl-12 pr-4 py-4 rounded-xl text-2xl font-black font-mono transition-all focus:border-blue-400/60 focus:bg-white/[0.09] outline-none"
                        />
                    </div>

                    <p className="text-xs font-medium text-[var(--text-secondary)] mb-auto">
                        Note: Updating immediately alters future checkouts. Historical orders keep their locked rate.
                    </p>

                    <button
                        onClick={handleUpdate}
                        disabled={loading || !newRateInput || !hasChanged}
                        className={`w-full mt-6 py-3 rounded-xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all ${
                            hasChanged 
                                ? 'bg-blue-500 text-white hover:bg-blue-600' 
                                : 'bg-white/[0.05] text-[var(--text-secondary)] cursor-not-allowed border border-white/10'
                        }`}
                    >
                        {loading ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                        Save New Rate
                    </button>
                </div>
            </div>
        </div>
    );
}
