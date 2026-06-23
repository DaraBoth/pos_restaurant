'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Printer, Usb, FileDown } from 'lucide-react';
import { THERMAL_PRINT_EVENT, type ThermalPrintJob } from '@/lib/receipt';
import { useLanguage } from '@/providers/LanguageProvider';

export default function ReceiptPrintSheet() {
    const { t } = useLanguage();
    const [job, setJob] = useState<ThermalPrintJob | null>(null);
    const [open, setOpen] = useState(false);
    const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    function handleClose() {
        setOpen(false);
        window.setTimeout(() => setJob(null), 220);
    }

    useEffect(() => {
        function onPrint(e: Event) {
            const detail = (e as CustomEvent<ThermalPrintJob>).detail;
            if (!detail || !detail.templates?.length) return;
            setJob(detail);
            const remembered = detail.rememberKey
                ? window.localStorage.getItem(detail.rememberKey)
                : null;
            const fallback = detail.defaultTemplateId || detail.templates[0].id;
            const valid = detail.templates.find(t =>
                t.id === remembered || t.id === fallback,
            );
            setActiveTemplateId(
                detail.templates.find(t => t.id === remembered)?.id
                ?? valid?.id
                ?? detail.templates[0].id,
            );
            requestAnimationFrame(() => setOpen(true));
        }
        window.addEventListener(THERMAL_PRINT_EVENT, onPrint);
        return () => window.removeEventListener(THERMAL_PRINT_EVENT, onPrint);
    }, []);

    useEffect(() => {
        if (!job) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                setOpen(false);
                window.setTimeout(() => setJob(null), 220);
            }
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [job]);

    const activeTemplate = useMemo(() => {
        if (!job || !activeTemplateId) return null;
        return job.templates.find(t => t.id === activeTemplateId) || job.templates[0];
    }, [job, activeTemplateId]);

    if (!job || !activeTemplate) return null;

    const isSmall = job.paperWidth === '58mm';
    const showTabs = job.templates.length > 1;

    function pickTemplate(id: string) {
        setActiveTemplateId(id);
        if (job?.rememberKey) {
            window.localStorage.setItem(job.rememberKey, id);
        }
    }

    function triggerPrint() {
        const template = activeTemplate;
        if (!template) return;

        const printFrame = document.createElement('iframe');
        printFrame.setAttribute('aria-hidden', 'true');
        printFrame.style.cssText = `position:fixed;left:-9999px;top:0;width:${isSmall ? 220 : 302}px;height:1px;border:0;visibility:hidden;pointer-events:none;`;
        printFrame.srcdoc = template.html;
        document.body.appendChild(printFrame);

        const cleanup = () => {
            window.setTimeout(() => {
                if (document.body.contains(printFrame)) {
                    document.body.removeChild(printFrame);
                }
            }, 1000);
        };

        printFrame.onload = () => {
            const win = printFrame.contentWindow;
            if (!win) {
                cleanup();
                return;
            }

            win.focus();
            // Same call for paper and PDF — the OS print dialog lets the cashier
            // either pick a configured USB / LAN / Bluetooth thermal printer
            // OR pick "Save as PDF" / "Microsoft Print to PDF" as the destination.
            win.print();
            cleanup();
        };
    }

    function handleFrameLoad() {
        const iframe = iframeRef.current;
        const doc = iframe?.contentDocument;
        if (!iframe || !doc) return;

        const body = doc.body;
        const html = doc.documentElement;
        const height = Math.max(
            body?.scrollHeight || 0,
            body?.offsetHeight || 0,
            html?.scrollHeight || 0,
            html?.offsetHeight || 0,
        );

        if (height > 0) {
            iframe.style.height = `${height}px`;
        }
    }

    return (
        <div className="fixed inset-0 z-[70] flex justify-end">
            <button
                type="button"
                aria-label="Close print preview"
                onClick={handleClose}
                className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
            />
            <aside
                role="dialog"
                aria-modal="true"
                className={`relative h-full w-full max-w-[460px] bg-[var(--bg-card)] border-l border-[var(--border)] shadow-2xl flex flex-col transform transition-transform duration-200 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
            >
                <header className="flex items-start justify-between px-5 py-4 border-b border-[var(--border)] flex-shrink-0">
                    <div className="space-y-1">
                        <h2 className="text-sm font-black text-[var(--foreground)] uppercase tracking-widest">
                            {job.title}
                        </h2>
                        <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest opacity-60 text-[var(--text-secondary)]">
                            <Usb size={11} />
                            {job.paperWidth} thermal{job.subtitle ? ` · ${job.subtitle}` : ''}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
                    >
                        <X size={18} />
                    </button>
                </header>

                {showTabs && (
                    <div className="px-5 pt-3 pb-3 border-b border-[var(--border)] flex-shrink-0">
                        <div className="text-[9px] font-black uppercase tracking-widest opacity-50 text-[var(--text-secondary)] mb-2">
                            Template
                        </div>
                        <div className="flex gap-1.5 flex-wrap" role="tablist">
                            {job.templates.map(tpl => {
                                const isActive = tpl.id === activeTemplate.id;
                                return (
                                    <button
                                        key={tpl.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={isActive}
                                        onClick={() => pickTemplate(tpl.id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all border ${
                                            isActive
                                                ? 'bg-[var(--accent)] border-[var(--accent)] text-black'
                                                : 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:border-[var(--accent)]/40'
                                        }`}
                                    >
                                        {tpl.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-auto bg-[#e5e5e5] p-5 flex items-start justify-center">
                    <div
                        className="bg-white shadow-xl flex-shrink-0 overflow-hidden"
                        style={{ width: isSmall ? 220 : 302 }}
                    >
                        <iframe
                            ref={iframeRef}
                            srcDoc={activeTemplate.html}
                            title={`${job.title} · ${activeTemplate.label}`}
                            onLoad={handleFrameLoad}
                            style={{ width: '100%', height: 0, minHeight: 0, border: 'none', display: 'block' }}
                        />
                    </div>
                </div>

                <div className="px-5 py-3 text-[10px] leading-snug text-[var(--text-secondary)] opacity-70 border-t border-[var(--border)] flex-shrink-0">
                    {t('printerInstructions')}
                </div>

                <footer className="flex gap-2 p-4 border-t border-[var(--border)] flex-shrink-0">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="flex-1 py-3 rounded-xl text-sm font-black border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-white/5 uppercase tracking-widest transition-colors"
                    >
                        Skip
                    </button>
                    <button
                        type="button"
                        onClick={triggerPrint}
                        className="flex-1 py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--foreground)] hover:bg-white/5 uppercase tracking-widest transition-colors"
                        title="Pick &quot;Save as PDF&quot; in the print dialog"
                    >
                        <FileDown size={15} strokeWidth={2.5} />
                        PDF
                    </button>
                    <button
                        type="button"
                        onClick={triggerPrint}
                        className="flex-1 py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 pos-btn-primary uppercase tracking-widest active:scale-[0.98]"
                    >
                        <Printer size={16} strokeWidth={2.5} />
                        Print
                    </button>
                </footer>
            </aside>
        </div>
    );
}
