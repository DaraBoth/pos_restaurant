'use client';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { OrderItem, Order, Product } from '@/types';
import { getActiveOrderForTable, getSessionRounds, getOrderItems, createOrder as apiCreateOrder, addOrderItem as apiAddOrderItem } from '@/lib/api/orders';
import { getExchangeRate } from '@/lib/api/system';
import { useAuth } from '@/providers/AuthProvider';
import { calculateTotals, OrderTotals } from '@/lib/currency';

export interface LocalCartItem {
    productId: string;
    productName: string;
    khmerName?: string;
    priceCents: number;
    qty: number;
    imagePath?: string;
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
    isDirect: boolean;
    localCart: LocalCartItem[];
    setOrderId: (id: string | null) => void;
    setItems: (items: OrderItem[]) => void;
    setTableId: (t: string) => void;
    setSessionId: (id: string | null) => void;
    setRounds: (rounds: Order[]) => void;
    switchRound: (orderId: string) => Promise<void>;
    setTakeout: (v: boolean) => void;
    setDirect: (v: boolean) => void;
    refreshRate: () => void;
    clearOrder: () => void;
    loadTableSession: (tId: string) => Promise<void>;
    addToLocalCart: (product: Product) => Promise<void> | void;
    updateLocalCartQty: (productId: string, qty: number) => void;
    commitLocalCart: (userId: string) => Promise<void>;
}

const EMPTY_TOTALS: OrderTotals = {
    subtotalCents: 0, vatCents: 0, pltCents: 0, totalUsdCents: 0, totalKhr: 0,
};

const OrderContext = createContext<OrderContextValue>({
    orderId: null, items: [], totals: EMPTY_TOTALS,
    exchangeRate: 4100, tableId: '', sessionId: null, rounds: [], isTakeout: false, isDirect: false,
    localCart: [],
    setOrderId: () => { }, setItems: () => { }, setTableId: () => { },
    setSessionId: () => { }, setRounds: () => { }, switchRound: async () => {},
    setTakeout: () => { }, setDirect: () => { }, refreshRate: () => { }, clearOrder: () => { },
    loadTableSession: async () => {},
    addToLocalCart: async () => { }, updateLocalCartQty: () => { }, commitLocalCart: async () => {},
});

export function OrderProvider({ children }: { children: React.ReactNode }) {
    const [orderId, setOrderId] = useState<string | null>(null);
    const [items, setItemsState] = useState<OrderItem[]>([]);
    const [exchangeRate, setExchangeRate] = useState(4100);
    const [tableId, setTableId] = useState('');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [rounds, setRounds] = useState<Order[]>([]);
    const [isTakeout, setTakeout] = useState(false);
    const [isDirect, setDirect] = useState(false);
    const [localCart, setLocalCart] = useState<LocalCartItem[]>([]);
    const { user } = useAuth();
    const restaurantId = user?.restaurant_id;

    const subtotalCents = items.reduce(
        (sum, item) => sum + item.price_at_order * item.quantity, 0
    );
    const totals = calculateTotals(subtotalCents, exchangeRate);

    const setItems = useCallback((newItems: OrderItem[]) => {
        setItemsState(newItems);
    }, []);

    const refreshRate = useCallback(async () => {
        try {
            const rate = await getExchangeRate(restaurantId || undefined);
            setExchangeRate(rate.rate);
        } catch {
            // Keep default rate if Tauri not available
        }
    }, [restaurantId]);

    const clearOrder = useCallback(() => {
        setOrderId(null);
        setItemsState([]);
        setTableId('');
        setSessionId(null);
        setRounds([]);
        setTakeout(false);
        setDirect(false);
        setLocalCart([]);
    }, []);

    const loadTableSession = useCallback(async (tId: string) => {
        setTableId(tId);
        try {
            const order = await getActiveOrderForTable(tId, restaurantId || undefined);
            if (order) {
                setOrderId(order.id);
                setSessionId(order.session_id || null);
                if (order.session_id) {
                    const rs = await getSessionRounds(order.session_id, restaurantId || '');
                    setRounds(rs);
                } else {
                    setRounds([order]);
                }
                const currentItems = await getOrderItems(order.id, restaurantId || '');
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
    }, [restaurantId, tableId]); // Added tableId to prevent stale on mount

    const switchRound = useCallback(async (oId: string) => {
        setOrderId(oId);
        try {
            const currentItems = await getOrderItems(oId, restaurantId || '');
            setItemsState(currentItems);
        } catch (e) {
            console.error('Failed to switch round', e);
        }
    }, [restaurantId, sessionId]);

    const addToLocalCart = useCallback(async (product: Product) => {
        if (orderId) {
            try {
                await apiAddOrderItem(orderId, product.id, 1, restaurantId || '');
                const currentItems = await getOrderItems(orderId, restaurantId || '');
                setItemsState(currentItems);
            } catch (e) {
                console.error('Failed to add live item:', e, { orderId, productId: product.id, restaurantId });
            }
            return;
        }

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
                imagePath: product.image_path,
            }];
        });
    }, [orderId, restaurantId]); // Add restaurantId dependency

    const updateLocalCartQty = useCallback((productId: string, qty: number) => {
        if (qty <= 0) {
            setLocalCart(prev => prev.filter(i => i.productId !== productId));
        } else {
            setLocalCart(prev => prev.map(i => i.productId === productId ? { ...i, qty } : i));
        }
    }, []);

    const commitLocalCart = useCallback(async (userId: string) => {
        if (localCart.length === 0) return;
        const newOrderId = await apiCreateOrder(userId, tableId || undefined, restaurantId || '');
        for (const item of localCart) {
            await apiAddOrderItem(newOrderId, item.productId, item.qty, restaurantId || '');
        }
        if (tableId) {
            await loadTableSession(tableId);
        } else {
            setOrderId(newOrderId);
            const updatedItems = await getOrderItems(newOrderId, restaurantId || '');
            setItemsState(updatedItems);
        }
        setLocalCart([]);
    }, [localCart, tableId, loadTableSession, restaurantId]);

    useEffect(() => {
        refreshRate();
    }, [refreshRate]);

    return (
        <OrderContext.Provider value={{
            orderId, items, totals, exchangeRate, tableId, sessionId, rounds, isTakeout, isDirect,
            localCart,
            setOrderId, setItems, setTableId, setSessionId, setRounds, setTakeout, setDirect,
            refreshRate, clearOrder, loadTableSession, switchRound,
            addToLocalCart, updateLocalCartQty, commitLocalCart,
        }}>
            {children}
        </OrderContext.Provider>
    );
}

export const useOrder = () => useContext(OrderContext);
