'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MonitorSmartphone, TableProperties, ShoppingCart } from 'lucide-react';
import ProductGrid from '@/components/pos/ProductGrid';
import SidebarCart from '@/components/layout/SidebarCart';
import CheckoutModal from '@/components/pos/CheckoutModal';
import { useOrder } from '@/contexts/OrderContext';

export default function POSPage() {
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const { tableId, items, orderId } = useOrder();
    const router = useRouter();

    if (!tableId) {
        return (
            <div className="h-full w-full flex items-center justify-center p-8" style={{ background: 'var(--bg-dark)' }}>
                <div className="pos-card max-w-xl w-full p-8 text-center">
                    <div className="mx-auto mb-5 w-14 h-14 rounded-2xl flex items-center justify-center bg-[var(--accent-blue)]/15 border border-[var(--accent-blue)]/30">
                        <MonitorSmartphone size={28} className="text-[var(--accent-blue)]" />
                    </div>
                    <h1 className="text-3xl font-black text-[var(--foreground)] mb-3">Select A Table To Start</h1>
                    <p className="text-[var(--text-secondary)] mb-8">
                        Real POS flow starts from floor plan. Choose a table first, then add items and checkout.
                    </p>
                    <button
                        className="pos-btn-primary px-6 py-3 text-sm uppercase tracking-widest"
                        onClick={() => router.push('/pos/tables')}
                    >
                        Open Floor Plan
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="flex flex-col flex-1 w-full min-h-0" style={{ background: 'var(--bg-dark)' }}>
                <header className="flex-shrink-0 px-5 py-3 border-b border-[var(--border)] bg-[var(--bg-card)]/95 backdrop-blur-xl">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[var(--accent-blue)]/15 border border-[var(--accent-blue)]/30 flex items-center justify-center">
                                <TableProperties size={18} className="text-[var(--accent-blue)]" />
                            </div>
                            <div>
                                <p className="pos-label">Current Service</p>
                                <p className="font-black text-[var(--foreground)]">Table {tableId}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <div className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                                Order: <span className="font-mono text-[var(--foreground)]">{orderId ? orderId.slice(0, 8) : 'New'}</span>
                            </div>
                            <div className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] flex items-center gap-1.5">
                                <ShoppingCart size={14} />
                                <span className="font-black text-[var(--foreground)]">{items.length}</span>
                                <span>items</span>
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
