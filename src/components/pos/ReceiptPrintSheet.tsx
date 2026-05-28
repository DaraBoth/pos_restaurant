'use client';
import { useEffect, useRef, useState } from 'react';
import { X, Printer, Usb } from 'lucide-react';
import { getReceiptHtml, RECEIPT_PREVIEW_EVENT, type ReceiptPrintPayload } from '@/lib/receipt';

export default function ReceiptPrintSheet() {
    const [payload, setPayload] = useState<ReceiptPrintPayload | null>(null);
    const [open, setOpen] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        function onPreview(e: Event) {
            const detail = (e as CustomEvent<ReceiptPrintPayload>).detail;
            if (!detail) return;
            setPayload(detail);
            requestAnimationFrame(() => setOpen(true));
        }
        window.addEventListener(RECEIPT_PREVIEW_EVENT, onPreview);
        return () => window.removeEventListener(RECEIPT_PREVIEW_EVENT, onPreview);
    }, []);

    useEffect(() => {
        if (!payload) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') handleClose();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [payload]);

    if (!payload) return null;

    const html = getReceiptHtml(payload);
    const isSmall = payload.restaurant.receipt_width === '58mm';
    const paperLabel = payload.restaurant.receipt_width || '80mm';
    const receiptCode = payload.orderId.slice(0, 8).toUpperCase();

    function handleClose() {
        setOpen(false);
        // Wait for the slide-out transition before unmounting so the sheet
        // animates out instead of disappearing instantly.
        window.setTimeout(() => setPayload(null), 220);
    }

    function handlePrint() {
        const win = iframeRef.current?.contentWindow;
        if (!win) return;
        win.focus();
        // Opens the OS print dialog — the cashier picks the configured USB /
        // LAN / Bluetooth thermal printer there. @page CSS in the receipt HTML
        // pins paper width and zero margins so the driver gets clean output.
        win.print();
    }

    return (
        <div className="fixed inset-0 z-[70] flex justify-end">
            <button
                type="button"
                aria-label="Close receipt preview"
                onClick={handleClose}
                className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
            />
            <aside
                role="dialog"
                aria-modal="true"
                className={`relative h-full w-full max-w-[440px] bg-[var(--bg-card)] border-l border-[var(--border)] shadow-2xl flex flex-col transform transition-transform duration-200 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
            >
                <header className="flex items-start justify-between px-5 py-4 border-b border-[var(--border)] flex-shrink-0">
                    <div className="space-y-1">
                        <h2 className="text-sm font-black text-[var(--foreground)] uppercase tracking-widest">
                            Receipt Preview
                        </h2>
                        <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest opacity-60 text-[var(--text-secondary)]">
                            <Usb size={11} />
                            {paperLabel} thermal · #{receiptCode}
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

                <div className="flex-1 overflow-auto bg-[#e5e5e5] p-5 flex items-start justify-center">
                    <div
                        className="bg-white shadow-xl flex-shrink-0"
                        style={{ width: isSmall ? 220 : 302 }}
                    >
                        <iframe
                            ref={iframeRef}
                            srcDoc={html}
                            title="Receipt Preview"
                            style={{ width: '100%', height: 600, border: 'none', display: 'block' }}
                        />
                    </div>
                </div>

                <div className="px-5 py-3 text-[10px] leading-snug text-[var(--text-secondary)] opacity-70 border-t border-[var(--border)] flex-shrink-0">
                    Pick the configured USB / LAN thermal printer in the next dialog.
                    For best results set <span className="font-bold">Margins: None</span> and disable
                    Headers &amp; Footers. The driver&apos;s &quot;Cut paper after print&quot; option
                    controls the auto-cut.
                </div>

                <footer className="flex gap-3 p-4 border-t border-[var(--border)] flex-shrink-0">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="flex-1 py-3 rounded-xl text-sm font-black border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-white/5 uppercase tracking-widest transition-colors"
                    >
                        Skip
                    </button>
                    <button
                        type="button"
                        onClick={handlePrint}
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
