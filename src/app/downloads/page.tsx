'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/providers/LanguageProvider';
import { getAppReleases, type AppRelease } from '@/lib/api/releases';
import { Download, Monitor, HardDrive, Cpu, ShieldCheck, History, ArrowRight, ExternalLink } from 'lucide-react';

export default function DownloadsPage() {
    const { t } = useLanguage();
    const [releases, setReleases] = useState<AppRelease[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getAppReleases().then(setReleases).catch(console.error).finally(() => setLoading(false));
    }, []);

    const latest = releases[0];

    // Helper to trigger download from Base64 or URL
    const handleDownload = (fileData: string | undefined, filename: string) => {
        if (!fileData) return;
        
        if (fileData.startsWith('data:')) {
            // Base64 download
            const link = document.createElement('a');
            link.href = fileData;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else if (fileData.startsWith('http')) {
            // URL download
            window.open(fileData, '_blank');
        }
    };

    return (
        <div className="flex-1 overflow-y-auto bg-[var(--background)]">
            <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">
                {/* Header Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center">
                            <Download size={24} className="text-[var(--accent)]" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-[var(--foreground)] uppercase tracking-tight">{t('downloads')}</h1>
                            <p className="text-[var(--text-secondary)] font-medium opacity-60">{t('downloadsDesc')}</p>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-20">
                        <div className="w-12 h-12 border-4 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
                        <p className="font-black uppercase tracking-widest text-sm">Checking for updates...</p>
                    </div>
                ) : !latest ? (
                    <div className="pos-card p-12 text-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center mx-auto opacity-40">
                            <Monitor size={32} />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-xl font-black">{t('noResults')}</h2>
                            <p className="text-[var(--text-secondary)] opacity-60">No releases have been published yet.</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                        {/* Featured Latest Release */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-[var(--accent)] via-purple-500 to-blue-500 rounded-[2.5rem] blur opacity-15 group-hover:opacity-25 transition duration-1000"></div>
                                <div className="relative pos-card p-8 bg-[var(--bg-card)]/80 backdrop-blur-xl border border-[var(--border)] rounded-[2.2rem] overflow-hidden">
                                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                                        <Monitor size={320} strokeWidth={1} />
                                    </div>
                                    
                                    <div className="space-y-8 relative">
                                        <div className="flex flex-wrap items-center justify-between gap-4">
                                            <div className="space-y-1">
                                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase tracking-widest mb-2">
                                                    <ShieldCheck size={12} />
                                                    Latest Stable Build
                                                </div>
                                                <h2 className="text-4xl font-black font-mono">v{latest.version}</h2>
                                                <p className="text-sm text-[var(--text-secondary)] font-medium opacity-60 uppercase tracking-widest">Released on {new Date(latest.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>

                                        {latest.release_notes && (
                                            <div className="space-y-3">
                                                <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60 flex items-center gap-2">
                                                    <History size={14} /> What's New
                                                </h3>
                                                <div className="p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)]/50 text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">
                                                    {latest.release_notes}
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {/* Windows Download */}
                                            <button 
                                                onClick={() => handleDownload(latest.windows_file, `DineOS_${latest.version}_x64_en-US.msi`)}
                                                disabled={!latest.windows_file}
                                                className={`flex flex-col items-start p-5 rounded-3xl border transition-all ${latest.windows_file 
                                                    ? 'bg-blue-600 hover:bg-blue-500 border-blue-400/30 text-white shadow-xl shadow-blue-600/20 active:scale-[0.98]' 
                                                    : 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-secondary)] opacity-40 cursor-not-allowed'}`}
                                            >
                                                <div className="flex items-center justify-between w-full mb-3">
                                                    <Cpu size={24} strokeWidth={1.5} />
                                                    <Download size={18} />
                                                </div>
                                                <span className="text-xs font-black uppercase tracking-widest opacity-80 mb-0.5">Windows</span>
                                                <span className="text-lg font-black tracking-tight">Desktop Installer (x64)</span>
                                                {latest.windows_file?.startsWith('http') && <span className="mt-2 text-[10px] font-mono opacity-50 flex items-center gap-1"><ExternalLink size={10} /> github.com</span>}
                                            </button>

                                            {/* macOS Download */}
                                            <button 
                                                onClick={() => handleDownload(latest.mac_file, `DineOS_${latest.version}_Universal.dmg`)}
                                                disabled={!latest.mac_file}
                                                className={`flex flex-col items-start p-5 rounded-3xl border transition-all ${latest.mac_file 
                                                    ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-black shadow-xl shadow-white/5 active:scale-[0.98]' 
                                                    : 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-secondary)] opacity-40 cursor-not-allowed'}`}
                                            >
                                                <div className="flex items-center justify-between w-full mb-3">
                                                    <HardDrive size={24} strokeWidth={1.5} />
                                                    <Download size={18} />
                                                </div>
                                                <span className="text-xs font-black uppercase tracking-widest opacity-80 mb-0.5">macOS</span>
                                                <span className="text-lg font-black tracking-tight">Apple Silicon & Intel</span>
                                                {latest.mac_file?.startsWith('http') && <span className="mt-2 text-[10px] font-mono opacity-50 flex items-center gap-1"><ExternalLink size={10} /> github.com</span>}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex gap-4 items-center">
                                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                                    <ShieldCheck className="text-amber-400" size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-amber-300">Automatic Updates</p>
                                    <p className="text-xs text-amber-200/60 leading-relaxed">Once installed, DineOS will automatically check for and apply security patches and new features upon restart. You don't need to manually download future updates.</p>
                                </div>
                            </div>
                        </div>

                        {/* Recent History Sidebar */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2">
                                <History size={16} className="text-[var(--text-secondary)]" />
                                <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60">Previous Versions</h3>
                            </div>
                            
                            <div className="space-y-3">
                                {releases.slice(1).length === 0 ? (
                                    <div className="p-6 rounded-3xl border-2 border-dashed border-[var(--border)] text-center opacity-40">
                                        <p className="text-xs font-bold uppercase tracking-widest">No history yet</p>
                                    </div>
                                ) : (
                                    releases.slice(1).map(r => (
                                        <div key={r.id} className="pos-card p-5 group hover:border-[var(--accent)]/30 transition-all">
                                            <div className="flex items-center justify-between mb-2">
                                               <span className="text-sm font-black font-mono">v{r.version}</span>
                                               <span className="text-[10px] font-bold opacity-40 uppercase">{new Date(r.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex gap-2">
                                               <button 
                                                   onClick={() => handleDownload(r.windows_file, `DineOS_${r.version}_old.msi`)}
                                                   className="flex-1 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] text-[10px] font-black uppercase tracking-widest hover:bg-[var(--bg-hover)] transition-colors"
                                               >
                                                   Windows
                                               </button>
                                               <button 
                                                   onClick={() => handleDownload(r.mac_file, `DineOS_${r.version}_old.dmg`)}
                                                   className="flex-1 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] text-[10px] font-black uppercase tracking-widest hover:bg-[var(--bg-hover)] transition-colors"
                                               >
                                                   macOS
                                               </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="pos-card p-6 bg-purple-500/5 border-purple-500/20 space-y-3 text-center">
                                <p className="text-xs font-black uppercase tracking-widest text-purple-400">Developer SDK</p>
                                <p className="text-[10px] text-purple-300/60 leading-relaxed">Looking for CLI tools or API access for platform integration?</p>
                                <button className="w-full py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[10px] font-black uppercase tracking-widest text-purple-300 hover:bg-purple-500/20 transition-all">
                                    Contact Support <ArrowRight size={10} className="inline ml-1" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
