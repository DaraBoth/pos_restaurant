'use client';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { OrderItem, Order, Product, ProductVariant, ProductModifierOption } from '@/types';
import { getActiveOrderForTable, getSessionRounds, getOrderItems, createOrder as apiCreateOrder, addOrderItem as apiAddOrderItem } from '@/lib/api/orders';
import { getExchangeRate } from '@/lib/api/system';
import { getRestaurant } from '@/lib/api/restaurant';
import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { calculateTotals, OrderTotals } from '@/lib/currency';
import Toast from '@/components/ui/Toast';

export interface LocalCartItem {
    productId: string;
    productName: string;
    khmerName?: string;
    priceCents: number;
    qty: number;
    imagePath?: string;
    note?: string;
    variantId?: string;
    variantName?: string;
    variantNameKm?: string;
    modifierOptionIds?: string[];
    modifierLabel?: string;
}

interface OrderContextValue {
    orderId: string | null;
    items: OrderItem[];
    totals: OrderTotals;
    exchangeRate: number;
    rateEffectiveFrom: string | null;
    rateIsDefault: boolean;
    tableId: string;
    sessionId: string | null;
    rounds: Order[];
    isTakeout: boolean;
    isDirect: boolean;
    localCart: LocalCartItem[];
    orderNote: string;
    setOrderId: (id: string | null) => void;
    setItems: (items: OrderItem[]) => void;
    setTableId: (t: string) => void;
    setSessionId: (id: string | null) => void;
    setRounds: (rounds: Order[]) => void;
    switchRound: (orderId: string) => Promise<void>;
    setTakeout: (v: boolean) => void;
    setDirect: (v: boolean) => void;
    setOrderNote: (note: string) => void;
    refreshRate: () => void;
    clearOrder: () => void;
    loadTableSession: (tId: string) => Promise<void>;
    addToLocalCart: (product: Product, qty?: number, variant?: ProductVariant, modifiers?: ProductModifierOption[]) => Promise<void> | void;
    updateLocalCartQty: (productId: string, qty: number, variantId?: string, modifierKey?: string) => void;
    setLocalCartItemNote: (productId: string, note: string, variantId?: string, modifierKey?: string) => void;
    commitLocalCart: (userId: string) => Promise<void>;
}

const EMPTY_TOTALS: OrderTotals = {
    subtotalCents: 0, vatCents: 0, pltCents: 0, totalUsdCents: 0, totalKhr: 0,
};

const OrderContext = createContext<OrderContextValue>({
    orderId: null, items: [], totals: EMPTY_TOTALS,
    exchangeRate: 4100, rateEffectiveFrom: null, rateIsDefault: false, tableId: '', sessionId: null, rounds: [], isTakeout: false, isDirect: false,
    localCart: [], orderNote: '',
    setOrderId: () => { }, setItems: () => { }, setTableId: () => { },
    setSessionId: () => { }, setRounds: () => { }, switchRound: async () => {},
    setTakeout: () => { }, setDirect: () => { }, setOrderNote: () => { }, refreshRate: () => { }, clearOrder: () => { },
    loadTableSession: async () => {},
    addToLocalCart: async () => { }, updateLocalCartQty: () => { }, setLocalCartItemNote: () => { }, commitLocalCart: async () => {},
});

export function OrderProvider({ children }: { children: React.ReactNode }) {
    const [orderId, setOrderId] = useState<string | null>(null);
    const [items, setItemsState] = useState<OrderItem[]>([]);
    const [exchangeRate, setExchangeRate] = useState(4100);
    const [rateEffectiveFrom, setRateEffectiveFrom] = useState<string | null>(null);
    const [rateIsDefault, setRateIsDefault] = useState(false);
    const [tableId, setTableId] = useState('');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [rounds, setRounds] = useState<Order[]>([]);
    const [isTakeout, setTakeout] = useState(false);
    const [isDirect, setDirect] = useState(false);
    const [localCart, setLocalCart] = useState<LocalCartItem[]>([]);
    const [orderNote, setOrderNote] = useState('');
    const [vatEnabled, setVatEnabled] = useState(false);
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
    const { user, reportActiveOrder } = useAuth();
    const { t } = useLanguage();
    const restaurantId = user?.restaurant_id;

    // Let AuthProvider know when an order is in progress so idle-logout can warn harder.
    useEffect(() => {
        reportActiveOrder(items.length > 0 || localCart.length > 0);
    }, [items.length, localCart.length, reportActiveOrder]);

    useEffect(() => {
        if (!restaurantId) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        getRestaurant(restaurantId).then(r => setVatEnabled((r.vat_enabled ?? 0) === 1)).catch(() => {});
    }, [restaurantId]);

    const subtotalCents = items.reduce(
        (sum, item) => sum + item.price_at_order * item.quantity, 0
    );
    const totals = calculateTotals(subtotalCents, exchangeRate, vatEnabled);

    const setItems = useCallback((newItems: OrderItem[]) => {
        setItemsState(newItems);
    }, []);

    const refreshRate = useCallback(async () => {
        try {
            const rate = await getExchangeRate(restaurantId || undefined);
            setExchangeRate(rate.rate);
            setRateEffectiveFrom(rate.effective_from ?? null);
            setRateIsDefault(!!rate.is_default);
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
        setOrderNote('');
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
            setToast({ msg: t('failedLoadTable'), ok: false });
        }
    }, [restaurantId, tableId, t]); // Added tableId to prevent stale on mount

    const switchRound = useCallback(async (oId: string) => {
        setOrderId(oId);
        try {
            const currentItems = await getOrderItems(oId, restaurantId || '');
            setItemsState(currentItems);
        } catch (e) {
            console.error('Failed to switch round', e);
            setToast({ msg: t('failedSwitchRound'), ok: false });
        }
    }, [restaurantId, sessionId, t]);

    const addToLocalCart = useCallback(async (product: Product, qty: number = 1, variant?: ProductVariant, modifiers?: ProductModifierOption[]) => {
        const addQty = Math.max(1, Math.floor(qty));
        const mods = modifiers ?? [];
        const modDelta = mods.reduce((s, m) => s + m.price_delta_cents, 0);
        // A chosen variant fully overrides the product price; modifier deltas add on top.
        const effectivePrice = (variant ? variant.price_cents : product.price_cents) + modDelta;
        const variantId = variant?.id;
        const modifierOptionIds = mods.map(m => m.id);
        const modifierLabel = mods.map(m => m.name).join(', ') || undefined;
        if (orderId) {
            try {
                await apiAddOrderItem(orderId, product.id, addQty, restaurantId || '', undefined, variantId, modifierOptionIds);
                const currentItems = await getOrderItems(orderId, restaurantId || '');
                setItemsState(currentItems);
            } catch (e) {
                console.error('Failed to add live item:', e, { orderId, productId: product.id, restaurantId });
                setToast({ msg: t('failedAddItem'), ok: false });
            }
            return;
        }

        setLocalCart(prev => {
            // Lines with modifiers are always distinct; otherwise merge same product+variant.
            const existing = mods.length === 0
                ? prev.find(i => i.productId === product.id && (i.variantId || '') === (variantId || '') && !(i.modifierOptionIds && i.modifierOptionIds.length))
                : undefined;
            if (existing) {
                return prev.map(i => (i === existing ? { ...i, qty: i.qty + addQty } : i));
            }
            return [...prev, {
                productId: product.id,
                productName: product.name,
                khmerName: product.khmer_name,
                priceCents: effectivePrice,
                qty: addQty,
                imagePath: product.image_path,
                variantId,
                variantName: variant?.name,
                variantNameKm: variant?.name_km,
                modifierOptionIds: modifierOptionIds.length ? modifierOptionIds : undefined,
                modifierLabel,
            }];
        });
    }, [orderId, restaurantId, t]); // Add restaurantId dependency

    const updateLocalCartQty = useCallback((productId: string, qty: number, variantId?: string, modifierKey?: string) => {
        const matches = (i: LocalCartItem) => i.productId === productId
            && (i.variantId || '') === (variantId || '')
            && ((i.modifierOptionIds || []).join(',')) === (modifierKey || '');
        if (qty <= 0) {
            setLocalCart(prev => prev.filter(i => !matches(i)));
        } else {
            setLocalCart(prev => prev.map(i => matches(i) ? { ...i, qty } : i));
        }
    }, []);

    const setLocalCartItemNote = useCallback((productId: string, note: string, variantId?: string, modifierKey?: string) => {
        setLocalCart(prev => prev.map(i => (i.productId === productId
            && (i.variantId || '') === (variantId || '')
            && ((i.modifierOptionIds || []).join(',')) === (modifierKey || '')) ? { ...i, note: note || undefined } : i));
    }, []);

    const commitLocalCart = useCallback(async (userId: string) => {
        if (localCart.length === 0) return;
        const newOrderId = await apiCreateOrder(userId, tableId || undefined, restaurantId || '', orderNote || undefined);
        for (const item of localCart) {
            await apiAddOrderItem(newOrderId, item.productId, item.qty, restaurantId || '', item.note, item.variantId, item.modifierOptionIds);
        }
        if (tableId) {
            await loadTableSession(tableId);
        } else {
            setOrderId(newOrderId);
            const updatedItems = await getOrderItems(newOrderId, restaurantId || '');
            setItemsState(updatedItems);
        }
        setLocalCart([]);
    }, [localCart, tableId, loadTableSession, restaurantId, orderNote]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        refreshRate();
    }, [refreshRate]);

    return (
        <OrderContext.Provider value={{
            orderId, items, totals, exchangeRate, rateEffectiveFrom, rateIsDefault, tableId, sessionId, rounds, isTakeout, isDirect,
            localCart, orderNote,
            setOrderId, setItems, setTableId, setSessionId, setRounds, setTakeout, setDirect, setOrderNote,
            refreshRate, clearOrder, loadTableSession, switchRound,
            addToLocalCart, updateLocalCartQty, setLocalCartItemNote, commitLocalCart,
        }}>
            {children}
            {toast && <Toast message={toast.msg} variant={toast.ok ? 'success' : 'error'} onClose={() => setToast(null)} />}
        </OrderContext.Provider>
    );
}

export const useOrder = () => useContext(OrderContext);
