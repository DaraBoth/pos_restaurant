'use client';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { OrderItem, getExchangeRate } from '@/lib/tauri-commands';
import { calculateTotals, OrderTotals } from '@/lib/currency';

interface OrderContextValue {
    orderId: string | null;
    items: OrderItem[];
    totals: OrderTotals;
    exchangeRate: number;
    tableId: string;
    setOrderId: (id: string | null) => void;
    setItems: (items: OrderItem[]) => void;
    setTableId: (t: string) => void;
    refreshRate: () => void;
    clearOrder: () => void;
}

const EMPTY_TOTALS: OrderTotals = {
    subtotalCents: 0, vatCents: 0, pltCents: 0, totalUsdCents: 0, totalKhr: 0,
};

const OrderContext = createContext<OrderContextValue>({
    orderId: null, items: [], totals: EMPTY_TOTALS,
    exchangeRate: 4100, tableId: '',
    setOrderId: () => { }, setItems: () => { }, setTableId: () => { },
    refreshRate: () => { }, clearOrder: () => { },
});

export function OrderProvider({ children }: { children: React.ReactNode }) {
    const [orderId, setOrderId] = useState<string | null>(null);
    const [items, setItemsState] = useState<OrderItem[]>([]);
    const [exchangeRate, setExchangeRate] = useState(4100);
    const [tableId, setTableId] = useState('');

    const subtotalCents = items.reduce(
        (sum, item) => sum + item.price_at_order * item.quantity, 0
    );
    const totals = calculateTotals(subtotalCents, exchangeRate);

    const setItems = useCallback((newItems: OrderItem[]) => {
        setItemsState(newItems);
    }, []);

    const refreshRate = useCallback(async () => {
        try {
            const rate = await getExchangeRate();
            setExchangeRate(rate.rate);
        } catch {
            // Keep default rate if Tauri not available
        }
    }, []);

    const clearOrder = useCallback(() => {
        setOrderId(null);
        setItemsState([]);
        setTableId('');
    }, []);

    useEffect(() => {
        refreshRate();
    }, [refreshRate]);

    return (
        <OrderContext.Provider value={{
            orderId, items, totals, exchangeRate, tableId,
            setOrderId, setItems, setTableId, refreshRate, clearOrder,
        }}>
            {children}
        </OrderContext.Provider>
    );
}

export const useOrder = () => useContext(OrderContext);
