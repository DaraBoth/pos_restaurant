import React, { useState, useEffect } from 'react';
import { Download, Plus, Trash2, X, RefreshCw } from 'lucide-react';
import { getAppReleases, createAppRelease, deleteAppRelease, type AppRelease } from '@/lib/api/releases';

export function ManageReleasesModal({ onClose }: { onClose: () => void }) {
    const [releases, setReleases] = useState<AppRelease[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    const [form, setForm] = useState({
        version: '',
        releaseNotes: '',
        windowsFile: '',
        windowsSignature: '',
        macFile: '',
        macSignature: ''
    });

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const loadReleases = async () => {
        setLoading(true);
        try {
            const data = await getAppReleases();
            setReleases(data);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReleases();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!form.version.trim()) {
            setError("Version is required.");
            return;
        }

        setSubmitting(true);
        try {
            await createAppRelease({
                version: form.version.trim(),
                release_notes: form.releaseNotes.trim() || undefined,
                windows_file: form.windowsFile.trim() || undefined,
                windows_signature: form.windowsSignature.trim() || undefined,
                mac_file: form.macFile.trim() || undefined,
                mac_signature: form.macSignature.trim() || undefined,
            });
            setIsCreating(false);
            setForm({ version: '', releaseNotes: '', windowsFile: '', windowsSignature: '', macFile: '', macSignature: '' });
            await loadReleases();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this release?")) return;
        try {
            await deleteAppRelease(id);
            await loadReleases();
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : String(err));
        }
    };

    const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(prev => ({ ...prev, [k]: e.target.value }));

    // File input handlers to read as Base64.
    const handleFile = (os: 'windows' | 'mac', e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const b64 = ev.target?.result as string;
            if (os === 'windows') setForm(prev => ({ ...prev, windowsFile: b64 }));
            else setForm(prev => ({ ...prev, macFile: b64 }));
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            
            <div 
                className="relative w-full max-w-2xl h-full bg-[var(--bg-card)] border-l border-[var(--border)] shadow-2xl flex flex-col overflow-hidden"
                style={{ animation: 'slideInRight 0.28s cubic-bezier(0.32,0.72,0,1) both' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center">
                            <Download size={15} className="text-[var(--accent)]" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-[var(--text-main)] leading-none mb-1">
                                App Store Releases
                            </h2>
                            <p className="text-sm text-[var(--text-muted)]">Upload installers to your internal App Store.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {!isCreating && (
                            <button
                                onClick={loadReleases}
                                className="w-8 h-8 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)] flex items-center justify-center transition-colors"
                            >
                                <RefreshCw size={16} />
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)] flex items-center justify-center transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="m-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                        {error}
                    </div>
                )}

                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {isCreating ? (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Version (e.g., 1.0.8)*</label>
                                <input required value={form.version} onChange={update('version')} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]" placeholder="1.0.8" />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Release Notes</label>
                                <textarea value={form.releaseNotes} onChange={update('releaseNotes')} rows={3} className="w-full py-2 px-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] resize-none" placeholder="What's new..." />
                            </div>

                            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-main)]/50 space-y-3">
                                <h3 className="font-medium text-sm text-[var(--text-main)]">Windows Installer (.msi)</h3>
                                <input type="file" accept=".msi" onChange={(e) => handleFile('windows', e)} className="block w-full text-sm text-[var(--text-muted)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[var(--accent)]/10 file:text-[var(--accent)] hover:file:bg-[var(--accent)]/20" />
                                
                                {form.windowsFile && (
                                    <div className="text-xs text-green-500">File attached!</div>
                                )}
                                
                                <input value={form.windowsSignature} onChange={update('windowsSignature')} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] text-xs font-mono" placeholder="Tauri updater signature (from .msi.zip.sig)" />
                            </div>

                            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-main)]/50 space-y-3">
                                <h3 className="font-medium text-sm text-[var(--text-main)]">macOS Installer (.dmg)</h3>
                                <input type="file" accept=".dmg" onChange={(e) => handleFile('mac', e)} className="block w-full text-sm text-[var(--text-muted)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[var(--accent)]/10 file:text-[var(--accent)] hover:file:bg-[var(--accent)]/20" />
                                
                                {form.macFile && (
                                    <div className="text-xs text-green-500">File attached!</div>
                                )}
                                
                                <input value={form.macSignature} onChange={update('macSignature')} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] text-xs font-mono" placeholder="Tauri updater signature (from .app.tar.gz.sig)" />
                            </div>

                            <div className="flex gap-2 pt-2 border-t border-[var(--border)]">
                                <button type="button" onClick={() => setIsCreating(false)} className="flex-1 h-10 rounded-xl font-medium border border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={submitting} className="flex-1 h-10 rounded-xl font-medium bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 transition-colors">
                                    {submitting ? 'Uploading...' : 'Publish Release'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-[var(--bg-main)] p-4 rounded-xl border border-[var(--border)]">
                                <p className="text-sm text-[var(--text-muted)]">Users will see these versions in their App Store. We automatically prune to keep only the latest 3 updates.</p>
                                <button onClick={() => setIsCreating(true)} className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity">
                                    <Plus size={16} /> New Release
                                </button>
                            </div>

                            {loading ? (
                                <p className="text-center text-sm text-[var(--text-muted)] py-10">Loading releases...</p>
                            ) : releases.length === 0 ? (
                                <p className="text-center text-sm text-[var(--text-muted)] py-10">No releases published yet.</p>
                            ) : (
                                <div className="space-y-3">
                                    {releases.map(r => (
                                        <div key={r.id} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-main)]/50 group">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h4 className="font-semibold text-[var(--text-main)]">Version {r.version}</h4>
                                                    <span className="text-xs text-[var(--text-muted)] block mt-0.5">{r.created_at}</span>
                                                </div>
                                                <button onClick={() => handleDelete(r.id)} className="w-8 h-8 rounded-lg text-red-500/50 hover:bg-red-500/10 hover:text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                            {r.release_notes && (
                                                <p className="text-sm text-[var(--text-muted)] mb-3 bg-[var(--bg-card)] p-3 rounded-lg border border-[var(--border)]/50">
                                                    {r.release_notes}
                                                </p>
                                            )}
                                            <div className="flex gap-2">
                                                {r.windows_file && <span className="px-2 py-1 bg-blue-500/10 text-blue-500 text-xs rounded-md font-medium border border-blue-500/20">Windows ({r.windows_file.startsWith('http') ? 'External' : 'Internal'})</span>}
                                                {r.mac_file && <span className="px-2 py-1 bg-gray-500/10 text-gray-500 text-xs rounded-md font-medium border border-gray-500/20">macOS ({r.mac_file.startsWith('http') ? 'External' : 'Internal'})</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
