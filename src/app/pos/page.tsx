'use client';
import { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { TableProperties, ShoppingCart, ArrowLeft, ShoppingBag, UtensilsCrossed } from 'lucide-react';
import ProductGrid from '@/components/pos/ProductGrid';
import SidebarCart from '@/components/pos/SidebarCart';
import CheckoutModal from '@/components/pos/CheckoutModal';
import FloorPlanView from '@/components/pos/FloorPlanView';
import HoldPaymentModal from '@/components/pos/HoldPaymentModal';
import { useOrder } from '@/providers/OrderProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { getRestaurant, Restaurant } from '@/lib/tauri-commands';

export default function POSPage() {
    const router = useRouter();
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [isHoldOpen, setIsHoldOpen] = useState(false);
    const searchParams = useSearchParams();
    const mode = searchParams.get('mode');
    const { tableId, isTakeout, isDirect, items, clearOrder, localCart, orderId, commitLocalCart, setDirect, setTakeout, setTableId, refreshRate } = useOrder();
    const { user } = useAuth();
    const { lang, t } = useLanguage();

    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [isLoadingRestaurant, setIsLoadingRestaurant] = useState(true);

    useEffect(() => {
        refreshRate();
    }, [refreshRate]);

    const tablesDisabled = !restaurant || 
        restaurant.business_type === 'Mart/Accessories Shop/Pharmacy/Bakery' || 
        (restaurant.business_type === 'Coffee Shop' && restaurant.disable_tables === 1);

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

    const handleBack = useCallback(() => {
        clearOrder();
        if (!tablesDisabled) {
            router.push('/pos?mode=table');
        }
    }, [clearOrder, tablesDisabled, router]);

    // Fetch restaurant data to check if tables are disabled
    useEffect(() => {
        let isMounted = true;
        getRestaurant(user?.restaurant_id || undefined)
            .then(res => {
                if (isMounted) {
                    setRestaurant(res);
                    setIsLoadingRestaurant(false);
                }
            })
            .catch(err => {
                console.error('Failed to get restaurant:', err);
                if (isMounted) {
                    setIsLoadingRestaurant(false);
                }
            });
        return () => {
            isMounted = false;
        };
    }, [user?.restaurant_id]);

    // Handle mode changes and redirects based on restaurant settings
    useEffect(() => {
        if (isLoadingRestaurant) return;

        if (tablesDisabled) {
            // Tables are disabled: MUST use direct mode
            if (!isDirect) {
                setDirect(true);
            }
            if (mode !== 'direct') {
                router.replace('/pos?mode=direct', { scroll: false });
            }
        } else {
            // Tables are enabled: use query param, or default to table mode if none specified
            if (mode === 'direct') {
                if (!isDirect) {
                    setDirect(true);
                }
            } else { // mode === 'table' or mode is null
                if (isDirect) {
                    setDirect(false);
                }
                if (mode !== 'table') {
                    router.replace('/pos?mode=table', { scroll: false });
                }
            }
        }
    }, [isLoadingRestaurant, tablesDisabled, mode, isDirect, setDirect, router]);

    if (isLoadingRestaurant) {
        return (
            <div className="flex items-center justify-center flex-1 h-screen" style={{ background: 'var(--bg-dark)' }}>
                <div className="text-center">
                    <div className="w-16 h-16 border-4 rounded-full animate-spin mx-auto mb-4"
                        style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
                    <p style={{ color: 'var(--text-secondary)' }}>{t('loading')}...</p>
                </div>
            </div>
        );
    }

    // Show floor plan IF we are in Table mode AND no table is selected
    if (!isDirect && !tableId && !isTakeout) {
        return <FloorPlanView />;
    }

    return (
        <>
            <div className="flex flex-col flex-1 w-full min-h-0" style={{ background: 'var(--bg-dark)' }}>
                <header className="flex-shrink-0 px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-card)] backdrop-blur-xl">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            {!tablesDisabled && (
                                <button
                                    onClick={handleBack}
                                    className="w-7 h-7 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
                                    title={t('backToFloorPlan')}
                                >
                                    <ArrowLeft size={13} strokeWidth={2.5} />
                                </button>
                            )}

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
                            ) : isDirect ? (
                                <>
                                    <div className="w-7 h-7 rounded-lg bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center">
                                        <UtensilsCrossed size={14} className="text-[var(--accent)]" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--accent)] leading-none mb-0.5">DIRECT</p>
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
                            <span className="text-xs font-black text-[var(--foreground)]">{items?.length || 0}</span>
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
