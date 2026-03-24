'use client';

import { useState } from 'react';
import { CloudOff, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { triggerSyncReset } from '@/lib/api/restaurant';

interface CloudResetDialogProps {
    restaurantId: string;
}

export function CloudResetDialog({ restaurantId }: CloudResetDialogProps) {
    const [status, setStatus] = useState<'idle' | 'confirming' | 'resetting' | 'done'>('idle');

    async function handleReset() {
        if (!restaurantId) return;
        setStatus('resetting');
        try {
            await triggerSyncReset(restaurantId);
            setStatus('done');
            setTimeout(() => setStatus('idle'), 3000);
        } catch (error) {
            console.error(error);
            alert('Failed to reset sync state.');
            setStatus('idle');
        }
    }

    return (
        <section className="pos-card p-5 rounded-2xl border-l-[6px] border-l-amber-500/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-[100px] pointer-events-none" />
            
            <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-500/15 border border-amber-500/30">
                    <CloudOff size={16} className="text-amber-500" />
                </div>
                <h2 className="text-sm font-black uppercase tracking-widest text-[var(--foreground)]">
                    Cloud Sync & Repair
                </h2>
            </div>

            <div className="space-y-4">
                <p className="text-xs font-bold text-[var(--text-secondary)] leading-relaxed uppercase tracking-wider">
                    If your cloud database was recently wiped or changes aren't appearing, 
                    you can force a full re-synchronization.
                </p>
                
                <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] font-bold text-amber-200/80 leading-relaxed uppercase tracking-widest">
                        This will mark all local data as "new" for the cloud on the next sync cycle. 
                        Safe to use if the cloud is empty or desynced.
                    </p>
                </div>

                <div className="pt-2">
                    {status === 'idle' && (
                        <button
                            onClick={() => setStatus('confirming')}
                            className="px-6 py-3 rounded-xl border border-amber-500/40 text-amber-500 hover:bg-amber-500/10 transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                        >
                            <RefreshCw size={14} />
                            Reset Sync Cursor
                        </button>
                    )}

                    {status === 'confirming' && (
                        <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 transition-all">
                            <button
                                onClick={handleReset}
                                className="px-6 py-3 rounded-xl bg-amber-600 text-white hover:bg-amber-500 transition-all text-[10px] font-black uppercase tracking-widest"
                            >
                                Confirm Reset
                            </button>
                            <button
                                onClick={() => setStatus('idle')}
                                className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--foreground)]"
                            >
                                Cancel
                            </button>
                        </div>
                    )}

                    {status === 'resetting' && (
                        <div className="flex items-center gap-3 text-amber-500 transition-all">
                            <RefreshCw size={16} className="animate-spin" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Resetting Sync...</span>
                        </div>
                    )}

                    {status === 'done' && (
                        <div className="flex items-center gap-3 text-green-500 animate-in zoom-in-95 transition-all">
                            <CheckCircle2 size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Sync set to full re-upload</span>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
