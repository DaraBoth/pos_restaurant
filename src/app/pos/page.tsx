'use client';
import { useState } from 'react';
import ProductGrid from '@/components/pos/ProductGrid';
import SidebarCart from '@/components/layout/SidebarCart';
import CheckoutModal from '@/components/pos/CheckoutModal';

export default function POSPage() {
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

    return (
        <>
            <div className="flex flex-1 w-full min-h-0" style={{ background: 'var(--bg-dark)' }}>
                {/* Main Product Area */}
                <div className="flex-1 flex flex-col min-w-0 min-h-0">
                    <ProductGrid />
                </div>

                {/* Sidebar Cart */}
                <SidebarCart onCheckout={() => setIsCheckoutOpen(true)} />
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
