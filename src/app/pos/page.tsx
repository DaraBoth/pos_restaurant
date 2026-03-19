'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MonitorSmartphone, TableProperties, ShoppingCart } from 'lucide-react';
import ProductGrid from '@/components/pos/ProductGrid';
import SidebarCart from '@/components/pos/SidebarCart';
import CheckoutModal from '@/components/pos/CheckoutModal';
import { useOrder } from '@/providers/OrderProvider';
import { useLanguage } from '@/providers/LanguageProvider';

export default function POSPage() {
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const { tableId, items, orderId } = useOrder();
    const { lang } = useLanguage();
    const router = useRouter();

    if (!tableId) {
        return (
            <div className="h-full w-full flex items-center justify-center p-6" style={{ background: 'var(--bg-dark)' }}>
                <div className="pos-card max-w-sm w-full p-6 text-center">
                    <div className="mx-auto mb-4 w-12 h-12 rounded-xl flex items-center justify-center bg-[var(--accent-blue)]/15 border border-[var(--accent-blue)]/30">
                        <MonitorSmartphone size={22} className="text-[var(--accent-blue)]" />
                    </div>
                    <h1 className="text-base font-black text-[var(--foreground)] mb-2">
                        {lang === 'km' ? 'សូមជ្រើសរើសតុ' : 'Select a Table'}
                    </h1>
                    <p className="text-xs text-[var(--text-secondary)] mb-5">
                        {lang === 'km' ? 'ជ្រើសរើសតុមួយដើម្បីចាប់ផ្តើម' : 'Choose a table from the floor to start taking orders.'}
                    </p>
                    <button
                        className="pos-btn-primary px-5 py-2.5 text-xs uppercase tracking-widest"
                        onClick={() => router.push('/pos/tables')}
                    >
                        {lang === 'km' ? 'ចូលអ្នកបម្រើ' : 'Open Floor Plan'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="flex flex-col flex-1 w-full min-h-0" style={{ background: 'var(--bg-dark)' }}>
                <header className="flex-shrink-0 px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-card)] backdrop-blur-xl">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-[var(--accent-blue)]/15 border border-[var(--accent-blue)]/30 flex items-center justify-center">
                                <TableProperties size={14} className="text-[var(--accent-blue)]" />
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-secondary)] leading-none mb-0.5">{lang === 'km' ? 'តុ' : 'Table'}</p>
                                <p className="text-sm font-black text-[var(--foreground)] leading-none">{tableId}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                            <div className="px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] flex items-center gap-1">
                                <ShoppingCart size={11} />
                                <span className="font-black text-[var(--foreground)]">{items.length}</span>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="flex flex-1 min-h-0">
                {/* Main Product Area */}
                <div className="flex-1 flex flex-col min-w-0 min-h-0">
                    <ProductGrid />
                </div>

                {/* Sidebar Cart */}
                <SidebarCart onCheckout={() => setIsCheckoutOpen(true)} />
                </div>
            </div>

            {isCheckoutOpen && (
                <CheckoutModal
                    onClose={() => setIsCheckoutOpen(false)}
                    onComplete={() => setIsCheckoutOpen(false)}
                />
            )}
        </>
    );
}
