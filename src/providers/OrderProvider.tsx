'use client';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { OrderItem, Order, getExchangeRate, getActiveOrderForTable, getSessionRounds, getOrderItems } from '@/lib/tauri-commands';
import { calculateTotals, OrderTotals } from '@/lib/currency';

interface OrderContextValue {
    orderId: string | null;
    items: OrderItem[];
    totals: OrderTotals;
    exchangeRate: number;
    tableId: string;
    sessionId: string | null;
    rounds: Order[];
    isTakeout: boolean;
    setOrderId: (id: string | null) => void;
    setItems: (items: OrderItem[]) => void;
    setTableId: (t: string) => void;
    setSessionId: (id: string | null) => void;
    setRounds: (rounds: Order[]) => void;
    switchRound: (orderId: string) => Promise<void>;
    setTakeout: (v: boolean) => void;
    refreshRate: () => void;
    clearOrder: () => void;
    loadTableSession: (tId: string) => Promise<void>;
}

const EMPTY_TOTALS: OrderTotals = {
    subtotalCents: 0, vatCents: 0, pltCents: 0, totalUsdCents: 0, totalKhr: 0,
};

const OrderContext = createContext<OrderContextValue>({
    orderId: null, items: [], totals: EMPTY_TOTALS,
    exchangeRate: 4100, tableId: '', sessionId: null, rounds: [], isTakeout: false,
    setOrderId: () => { }, setItems: () => { }, setTableId: () => { },
    setSessionId: () => { }, setRounds: () => { }, switchRound: async () => {},
    setTakeout: () => { }, refreshRate: () => { }, clearOrder: () => { },
    loadTableSession: async () => {},
});

export function OrderProvider({ children }: { children: React.ReactNode }) {
    const [orderId, setOrderId] = useState<string | null>(null);
    const [items, setItemsState] = useState<OrderItem[]>([]);
    const [exchangeRate, setExchangeRate] = useState(4100);
    const [tableId, setTableId] = useState('');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [rounds, setRounds] = useState<Order[]>([]);
    const [isTakeout, setTakeout] = useState(false);

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
        setSessionId(null);
        setRounds([]);
        setTakeout(false);
    }, []);

    const loadTableSession = useCallback(async (tId: string) => {
        setTableId(tId);
        try {
            const order = await getActiveOrderForTable(tId);
            if (order) {
                setOrderId(order.id);
                setSessionId(order.session_id || null);
                if (order.session_id) {
                    const rs = await getSessionRounds(order.session_id);
                    setRounds(rs);
                } else {
                    setRounds([order]);
                }
                const currentItems = await getOrderItems(order.id);
                setItemsState(currentItems);
            } else {
                setOrderId(null);
                setSessionId(null);
                setRounds([]);
                setItemsState([]);
            }
        } catch (e) {
            console.error('Failed to load table session', e);
        }
    }, []);

    const switchRound = useCallback(async (oId: string) => {
        setOrderId(oId);
        try {
            const currentItems = await getOrderItems(oId);
            setItemsState(currentItems);
        } catch (e) {
            console.error('Failed to switch round', e);
        }
    }, []);

    useEffect(() => {
        refreshRate();
    }, [refreshRate]);

    return (
        <OrderContext.Provider value={{
            orderId, items, totals, exchangeRate, tableId, sessionId, rounds, isTakeout,
            setOrderId, setItems, setTableId, setSessionId, setRounds, setTakeout,
            refreshRate, clearOrder, loadTableSession, switchRound,
        }}>
            {children}
        </OrderContext.Provider>
    );
}

export const useOrder = () => useContext(OrderContext);
