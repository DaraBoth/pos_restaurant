'use client';
import { useRef } from 'react';
import { X, Printer } from 'lucide-react';

interface Props {
    html: string;
    onClose: () => void;
    onPrint: () => void;
}

export default function ReceiptPreviewModal({ html, onClose, onPrint }: Props) {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    function handlePrint() {
        // Try printing directly from the preview iframe first
        const win = iframeRef.current?.contentWindow;
        if (win) {
            win.focus();
            win.print();
        } else {
            // Fall back to the caller-provided print handler
            onPrint();
        }
        onClose();
    }

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
            onClick={e => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl border border-[var(--border)] flex flex-col overflow-hidden"
                style={{ width: 380, maxHeight: '90vh' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)] flex-shrink-0">
                    <h2 className="text-sm font-black text-[var(--foreground)] uppercase tracking-widest">
                        Receipt Preview
                    </h2>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Receipt iframe */}
                <div className="flex-1 overflow-auto bg-[#f0f0f0] p-4 flex items-start justify-center">
                    <div className="bg-white shadow-lg" style={{ width: 300 }}>
                        <iframe
                            ref={iframeRef}
                            srcDoc={html}
                            title="Receipt Preview"
                            style={{ width: 300, height: 600, border: 'none', display: 'block' }}
                            scrolling="yes"
                        />
                    </div>
                </div>

                {/* Footer buttons */}
                <div className="flex gap-3 p-4 border-t border-[var(--border)] flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl text-sm font-black border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-white/[0.07] transition-colors uppercase tracking-widest"
                    >
                        Skip
                    </button>
                    <button
                        onClick={handlePrint}
                        className="flex-1 py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 pos-btn-primary uppercase tracking-widest active:scale-[0.98] transition-all"
                    >
                        <Printer size={16} strokeWidth={2.5} />
                        Print Receipt
                    </button>
                </div>
            </div>
        </div>
    );
}
