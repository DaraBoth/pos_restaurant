'use client';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { OrderItem, Order, Product, getExchangeRate, getActiveOrderForTable, getSessionRounds, getOrderItems, createOrder as apiCreateOrder, addOrderItem as apiAddOrderItem } from '@/lib/tauri-commands';
import { calculateTotals, OrderTotals } from '@/lib/currency';

export interface LocalCartItem {
    productId: string;
    productName: string;
    khmerName?: string;
    priceCents: number;
    qty: number;
}

interface OrderContextValue {
    orderId: string | null;
    items: OrderItem[];
    totals: OrderTotals;
    exchangeRate: number;
    tableId: string;
    sessionId: string | null;
    rounds: Order[];
    isTakeout: boolean;
    localCart: LocalCartItem[];
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
    addToLocalCart: (product: Product) => void;
    updateLocalCartQty: (productId: string, qty: number) => void;
    commitLocalCart: (userId: string) => Promise<void>;
}

const EMPTY_TOTALS: OrderTotals = {
    subtotalCents: 0, vatCents: 0, pltCents: 0, totalUsdCents: 0, totalKhr: 0,
};

const OrderContext = createContext<OrderContextValue>({
    orderId: null, items: [], totals: EMPTY_TOTALS,
    exchangeRate: 4100, tableId: '', sessionId: null, rounds: [], isTakeout: false,
    localCart: [],
    setOrderId: () => { }, setItems: () => { }, setTableId: () => { },
    setSessionId: () => { }, setRounds: () => { }, switchRound: async () => {},
    setTakeout: () => { }, refreshRate: () => { }, clearOrder: () => { },
    loadTableSession: async () => {},
    addToLocalCart: () => { }, updateLocalCartQty: () => { }, commitLocalCart: async () => {},
});

export function OrderProvider({ children }: { children: React.ReactNode }) {
    const [orderId, setOrderId] = useState<string | null>(null);
    const [items, setItemsState] = useState<OrderItem[]>([]);
    const [exchangeRate, setExchangeRate] = useState(4100);
    const [tableId, setTableId] = useState('');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [rounds, setRounds] = useState<Order[]>([]);
    const [isTakeout, setTakeout] = useState(false);
    const [localCart, setLocalCart] = useState<LocalCartItem[]>([]);

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
        setLocalCart([]);
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

    const addToLocalCart = useCallback((product: Product) => {
        setLocalCart(prev => {
            const existing = prev.find(i => i.productId === product.id);
            if (existing) {
                return prev.map(i => i.productId === product.id ? { ...i, qty: i.qty + 1 } : i);
            }
            return [...prev, {
                productId: product.id,
                productName: product.name,
                khmerName: product.khmer_name,
                priceCents: product.price_cents,
                qty: 1,
            }];
        });
    }, []);

    const updateLocalCartQty = useCallback((productId: string, qty: number) => {
        if (qty <= 0) {
            setLocalCart(prev => prev.filter(i => i.productId !== productId));
        } else {
            setLocalCart(prev => prev.map(i => i.productId === productId ? { ...i, qty } : i));
        }
    }, []);

    const commitLocalCart = useCallback(async (userId: string) => {
        if (localCart.length === 0) return;
        const newOrderId = await apiCreateOrder(userId, tableId || undefined);
        for (const item of localCart) {
            await apiAddOrderItem(newOrderId, item.productId, item.qty);
        }
        if (tableId) {
            await loadTableSession(tableId);
        } else {
            setOrderId(newOrderId);
            const updatedItems = await getOrderItems(newOrderId);
            setItemsState(updatedItems);
        }
        setLocalCart([]);
    }, [localCart, tableId, loadTableSession]);

    useEffect(() => {
        refreshRate();
    }, [refreshRate]);

    return (
        <OrderContext.Provider value={{
            orderId, items, totals, exchangeRate, tableId, sessionId, rounds, isTakeout,
            localCart,
            setOrderId, setItems, setTableId, setSessionId, setRounds, setTakeout,
            refreshRate, clearOrder, loadTableSession, switchRound,
            addToLocalCart, updateLocalCartQty, commitLocalCart,
        }}>
            {children}
        </OrderContext.Provider>
    );
}

export const useOrder = () => useContext(OrderContext);
