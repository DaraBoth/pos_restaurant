'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { getAppReleases, createAppRelease, deleteAppRelease, type AppRelease } from '@/lib/api/releases';
import { 
    Download, Plus, Trash2, History, ArrowLeft, 
    Monitor, ShieldCheck, ExternalLink, RefreshCw,
    AlertCircle, FileDown, Rocket, Check
} from 'lucide-react';

export default function ReleaseManagementPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { t } = useLanguage();
    
    const [releases, setReleases] = useState<AppRelease[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    
    const [form, setForm] = useState({
        version: '',
        releaseNotes: '',
        windowsFile: '',
        windowsSignature: '',
        macFile: '',
        macSignature: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [fileStatus, setFileStatus] = useState<{ windows?: string, mac?: string }>({});

    useEffect(() => {
        if (user?.role !== 'super_admin') {
            router.replace('/login');
            return;
        }
        load();
    }, [user, router]);

    async function load() {
        setLoading(true);
        try {
            const data = await getAppReleases();
            setReleases(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(prev => ({ ...prev, [k]: e.target.value }));

    const handleFile = (os: 'windows' | 'mac', e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 30 * 1024 * 1024) {
            alert("File is too large (>30MB). Please use an external URL for large installers.");
            e.target.value = '';
            return;
        }

        setFileStatus(prev => ({ ...prev, [os]: 'Processing...' }));

        const reader = new FileReader();
        reader.onload = (ev) => {
            const b64 = ev.target?.result as string;
            if (os === 'windows') setForm(prev => ({ ...prev, windowsFile: b64 }));
            else setForm(prev => ({ ...prev, macFile: b64 }));
            setFileStatus(prev => ({ ...prev, [os]: `Ready (${(file.size / 1024 / 1024).toFixed(1)} MB)` }));
        };
        reader.onerror = () => {
            setFileStatus(prev => ({ ...prev, [os]: 'Error reading file' }));
        };
        reader.readAsDataURL(file);
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.version) return;
        setSubmitting(true);
        try {
            await createAppRelease({
                version: form.version,
                release_notes: form.releaseNotes,
                windows_file: form.windowsFile,
                windows_signature: form.windowsSignature,
                mac_file: form.macFile,
                mac_signature: form.macSignature
            });
            setShowCreate(false);
            setForm({ version: '', releaseNotes: '', windowsFile: '', windowsSignature: '', macFile: '', macSignature: '' });
            setFileStatus({});
            load();
        } catch (err) {
            alert(err instanceof Error ? err.message : String(err));
        } finally {
            setSubmitting(false);
        }
    }

    async function handleDelete(id: string) {
        if (!window.confirm('Delete this release? Users won\'t be able to download it anymore.')) return;
        try {
            await deleteAppRelease(id);
            load();
        } catch (err) {
            alert(err instanceof Error ? err.message : String(err));
        }
    }

    return (
        <div className="min-h-screen bg-[var(--background)]">
            <header className="sticky top-0 z-30 bg-[var(--sidebar-bg)] border-b border-[var(--border)] px-8 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => router.back()}
                            className="p-2 rounded-xl hover:bg-[var(--bg-elevated)] transition-colors text-[var(--text-secondary)]"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
                                <Rocket size={20} className="text-purple-400" />
                            </div>
                            <div>
                                <h1 className="text-lg font-black text-[var(--foreground)] uppercase tracking-widest">Release Management</h1>
                                <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-50 uppercase tracking-widest">Manage Production App Versions</p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowCreate(!showCreate)}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--accent)] text-black font-black text-xs uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-[var(--accent)]/20"
                    >
                        {showCreate ? <ArrowLeft size={14} strokeWidth={3} /> : <Plus size={14} strokeWidth={3} />}
                        {showCreate ? 'Back to List' : 'Publish New Version'}
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-8">
                {showCreate ? (
                    <div className="max-w-3xl mx-auto">
                        <div className="pos-card p-8 border-purple-500/20 bg-purple-500/5 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                                < Rocket size={200} strokeWidth={1} />
                            </div>
                            
                            <form onSubmit={handleSubmit} className="space-y-8 relative">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-6">
                                        <div className="space-y-4">
                                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-purple-400 flex items-center gap-2">
                                                <History size={14} /> Basic Information
                                            </h3>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60">Version Number *</label>
                                                <input value={form.version} onChange={update('version')} required className="pos-input w-full" placeholder="e.g. 1.0.9" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60">Release Notes</label>
                                                <textarea value={form.releaseNotes} onChange={update('releaseNotes')} className="pos-input w-full min-h-[120px] py-3" placeholder="What's new in this version..." />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-8">
                                        <div className="space-y-6">
                                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-blue-400 flex items-center gap-2">
                                                <Monitor size={14} /> Windows Platform
                                            </h3>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60 block">External Download URL</label>
                                                <input value={form.windowsFile} onChange={update('windowsFile')} className="pos-input w-full" placeholder="https://github.com/..." />
                                                <div className="relative flex items-center gap-3">
                                                    <div className="flex-1 h-px bg-[var(--border)]" />
                                                    <span className="text-[9px] font-black text-[var(--text-secondary)] opacity-40 uppercase">OR Upload File</span>
                                                    <div className="flex-1 h-px bg-[var(--border)]" />
                                                </div>
                                                <input type="file" accept=".msi" onChange={(e) => handleFile('windows', e)} className="block w-full text-[10px] text-[var(--text-secondary)] file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-blue-500/10 file:text-blue-400 cursor-pointer" />
                                                {fileStatus.windows && (
                                                    <div className={`text-[10px] font-black uppercase tracking-tighter ${fileStatus.windows.includes('Ready') ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                        {fileStatus.windows}
                                                    </div>
                                                )}
                                                <input value={form.windowsSignature} onChange={update('windowsSignature')} className="pos-input w-full font-mono text-[10px]" placeholder="Signature (base64)" />
                                            </div>
                                        </div>

                                        <div className="space-y-6 pt-4 border-t border-[var(--border)] border-dashed">
                                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-2">
                                                <ShieldCheck size={14} /> macOS Platform
                                            </h3>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60 block">External Download URL</label>
                                                <input value={form.macFile} onChange={update('macFile')} className="pos-input w-full" placeholder="https://github.com/..." />
                                                <input type="file" accept=".dmg" onChange={(e) => handleFile('mac', e)} className="block w-full text-[10px] text-[var(--text-secondary)] file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-emerald-500/10 file:text-emerald-400 cursor-pointer" />
                                                {fileStatus.mac && (
                                                    <div className={`text-[10px] font-black uppercase tracking-tighter ${fileStatus.mac.includes('Ready') ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                        {fileStatus.mac}
                                                    </div>
                                                )}
                                                <input value={form.macSignature} onChange={update('macSignature')} className="pos-input w-full font-mono text-[10px]" placeholder="Signature (base64)" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-8 flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-10 py-3 rounded-2xl bg-purple-500 text-white font-black text-sm uppercase tracking-[0.2em] hover:brightness-110 transition-all disabled:opacity-50 shadow-xl shadow-purple-500/20"
                                    >
                                        {submitting ? 'Publishing...' : 'Publish Release'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-20">
                                <RefreshCw className="animate-spin" size={32} />
                                <p className="text-[10px] font-black uppercase tracking-widest">Fetching release history...</p>
                            </div>
                        ) : releases.length === 0 ? (
                            <div className="pos-card p-24 text-center space-y-4 opacity-40">
                                <Monitor size={48} className="mx-auto" strokeWidth={1} />
                                <p className="text-[10px] font-black uppercase tracking-[0.2em]">No release history found</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {releases.map((r, idx) => (
                                    <div key={r.id} className={`pos-card p-6 flex items-center gap-8 ${idx === 0 ? 'border-purple-500/30 bg-purple-500/5' : ''}`}>
                                        <div className="flex-shrink-0 text-center space-y-1 w-24 border-r border-[var(--border)] pr-8">
                                            <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Version</p>
                                            <p className="text-xl font-black font-mono">v{r.version}</p>
                                            {idx === 0 && <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500 text-[8px] font-black uppercase tracking-tighter">Current</span>}
                                        </div>

                                        <div className="flex-1 min-w-0 space-y-2">
                                            <div className="flex items-center gap-3">
                                                <History size={14} className="text-[var(--text-secondary)] opacity-40" />
                                                <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed truncate max-w-xl">
                                                    {r.release_notes || 'No release notes provided.'}
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                {r.windows_file && (
                                                    <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${r.windows_file.startsWith('data:') ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-neutral-500/10 text-neutral-400 border border-neutral-500/20'}`}>
                                                        {r.windows_file.startsWith('data:') ? <FileDown size={10}/> : <ExternalLink size={10}/>}
                                                        Windows ({r.windows_file.startsWith('data:') ? 'Internal' : 'External'})
                                                    </span>
                                                )}
                                                {r.mac_file && (
                                                    <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${r.mac_file.startsWith('data:') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-neutral-500/10 text-neutral-400 border border-neutral-500/20'}`}>
                                                         {r.mac_file.startsWith('data:') ? <FileDown size={10}/> : <ExternalLink size={10}/>}
                                                        macOS ({r.mac_file.startsWith('data:') ? 'Internal' : 'External'})
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex-shrink-0 text-right space-y-3">
                                            <p className="text-[10px] font-black uppercase tracking-widest opacity-40">{new Date(r.created_at).toLocaleDateString()}</p>
                                            <button
                                                onClick={() => handleDelete(r.id)}
                                                className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all ml-auto block"
                                                title="Delete release"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
