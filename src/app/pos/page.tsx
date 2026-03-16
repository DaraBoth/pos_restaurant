'use client';
import { useState } from 'react';
import ProductGrid from '@/components/pos/ProductGrid';
import SidebarCart from '@/components/layout/SidebarCart';
import CheckoutModal from '@/components/pos/CheckoutModal';

export default function POSPage() {
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

    return (
        <>
            <div className="flex h-full w-full bg-[var(--bg-dark)]">
                {/* Main Product Area */}
                <div className="flex-1 flex flex-col relative">
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
