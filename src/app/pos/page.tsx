'use client';
import { useState, useCallback } from 'react';
import { TableProperties, ShoppingCart, ArrowLeft, ShoppingBag } from 'lucide-react';
import ProductGrid from '@/components/pos/ProductGrid';
import SidebarCart from '@/components/pos/SidebarCart';
import CheckoutModal from '@/components/pos/CheckoutModal';
import FloorPlanView from '@/components/pos/FloorPlanView';
import HoldPaymentModal from '@/components/pos/HoldPaymentModal';
import { useOrder } from '@/providers/OrderProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';

export default function POSPage() {
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [isHoldOpen, setIsHoldOpen] = useState(false);
    const { tableId, isTakeout, items, clearOrder, localCart, orderId, commitLocalCart } = useOrder();
    const { user } = useAuth();
    const { lang, t } = useLanguage();

    // Commit local cart first if no order exists yet (table or takeout), then open checkout
    const handleCheckout = useCallback(async () => {
        if (!orderId && localCart.length > 0 && user) {
            try {
                await commitLocalCart(user.id);
            } catch (e) {
                console.error('Failed to commit cart:', e);
                return;
            }
        }
        setIsCheckoutOpen(true);
    }, [orderId, localCart, user, commitLocalCart]);


    // No table and not takeout → show floor plan
    if (!tableId && !isTakeout && localCart.length === 0) {
        return <FloorPlanView />;
    }

    return (
        <>
            <div className="flex flex-col flex-1 w-full min-h-0" style={{ background: 'var(--bg-dark)' }}>
                <header className="flex-shrink-0 px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-card)] backdrop-blur-xl">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={clearOrder}
                                className="w-7 h-7 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
                                title={t('backToFloorPlan')}
                            >
                                <ArrowLeft size={13} strokeWidth={2.5} />
                            </button>

                            {isTakeout ? (
                                <>
                                    <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                                        <ShoppingBag size={14} className="text-emerald-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest font-bold text-emerald-400 leading-none mb-0.5">{t('takeout')}</p>
                                        <p className="text-sm font-black text-[var(--foreground)] leading-none">{t('newOrder')}</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="w-7 h-7 rounded-lg bg-[var(--accent-blue)]/15 border border-[var(--accent-blue)]/30 flex items-center justify-center">
                                        <TableProperties size={14} className="text-[var(--accent-blue)]" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-secondary)] leading-none mb-0.5">{t('tableLabel')}</p>
                                        <p className="text-sm font-black text-[var(--foreground)] leading-none">{tableId}</p>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] flex items-center gap-1">
                            <ShoppingCart size={11} />
                            <span className="text-xs font-black text-[var(--foreground)]">{items.length}</span>
                        </div>
                    </div>
                </header>

                <div className="flex flex-1 min-h-0">
                {/* Main Product Area */}
                <div className="flex-1 flex flex-col min-w-0 min-h-0">
                    <ProductGrid />
                </div>

                {/* Sidebar Cart */}
                <SidebarCart onCheckout={handleCheckout} onHold={() => setIsHoldOpen(true)} isTakeout={isTakeout} />
                </div>
            </div>

            {isCheckoutOpen && (
                <CheckoutModal
                    onClose={() => setIsCheckoutOpen(false)}
                    onComplete={() => {
                        setIsCheckoutOpen(false);
                    }}
                />
            )}
            {isHoldOpen && (
                <HoldPaymentModal
                    onClose={() => setIsHoldOpen(false)}
                    onComplete={() => { setIsHoldOpen(false); clearOrder(); }}
                />
            )}

        </>
    );
}
