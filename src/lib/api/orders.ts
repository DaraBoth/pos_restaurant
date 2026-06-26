import { call } from './client';
import type { Order, OrderItem, PaymentInput, Payment } from '@/types';

export const createOrder = (user_id: string, table_id?: string, restaurant_id?: string, notes?: string) =>
    call<string>('create_order', { userId: user_id, tableId: table_id, restaurantId: restaurant_id, notes });

export const addOrderItem = (
    order_id: string, product_id: string, quantity: number, restaurantId: string, note?: string, variant_id?: string, modifier_option_ids?: string[]
) => call<OrderItem>('add_order_item', { orderId: order_id, productId: product_id, quantity, restaurantId, note, variantId: variant_id ?? null, modifierOptionIds: modifier_option_ids ?? null });

export const updateOrderItemQuantity = (item_id: string, quantity: number, restaurantId: string) =>
    call<void>('update_order_item_quantity', { itemId: item_id, quantity, restaurantId });

export const updateOrderItemNote = (item_id: string, note: string | undefined, restaurantId: string) =>
    call<void>('update_order_item_note', { itemId: item_id, note: note ?? null, restaurantId });

export const getOrderItems = (order_id: string, restaurantId: string) =>
    call<OrderItem[]>('get_order_items', { orderId: order_id, restaurantId });

export const getOrders = (status?: string, start_date?: string, end_date?: string, restaurant_id?: string) =>
    call<Order[]>('get_orders', { status, startDate: start_date, endDate: end_date, restaurantId: restaurant_id });

export const getActiveOrderForTable = (table_id: string, restaurant_id?: string) =>
    call<Order | null>('get_active_order_for_table', { tableId: table_id, restaurantId: restaurant_id });

export const getOrdersForTable = (table_id: string, restaurant_id?: string) =>
    call<Order[]>('get_orders_for_table', { tableId: table_id, restaurantId: restaurant_id });

export const getSessionRounds = (session_id: string, restaurant_id?: string) =>
    call<Order[]>('get_session_rounds', { sessionId: session_id, restaurantId: restaurant_id });

export const getSessionOrderItems = (session_id: string, restaurant_id: string) =>
    call<OrderItem[]>('get_session_order_items', { sessionId: session_id, restaurantId: restaurant_id });

export const addRound = (user_id: string, session_id: string, restaurant_id?: string) =>
    call<string>('add_round', { userId: user_id, sessionId: session_id, restaurantId: restaurant_id });

export const checkoutSession = (session_id: string, payments: PaymentInput[], restaurantId: string, discount_cents = 0) =>
    call<void>('checkout_session', { sessionId: session_id, payments, restaurantId, discountCents: discount_cents });

export const checkoutOrder = (order_id: string, payments: PaymentInput[], restaurantId: string, discount_cents = 0, customer_name?: string, notes?: string) =>
    call<Order>('checkout_order', { orderId: order_id, payments, restaurantId, discountCents: discount_cents, customerName: customer_name, notes });

export const voidOrder = (order_id: string, restaurantId: string, voided_by: string, void_reason: string) =>
    call<void>('void_order', { orderId: order_id, restaurantId, voidedBy: voided_by, voidReason: void_reason });

export const holdOrder = (order_id: string, restaurantId: string, customer_name?: string, customer_phone?: string) =>
    call<void>('hold_order', { orderId: order_id, restaurantId, customerName: customer_name, customerPhone: customer_phone });

export interface HeldOrderSummary {
    id: string;
    customer_name?: string;
    table_id?: string;
    total_usd: number;
    item_count: number;
    held_at: string;
    receipt_number?: string;
    takeout_counter?: number;
}

export const getHeldOrders = (restaurantId: string) =>
    call<HeldOrderSummary[]>('get_held_orders', { restaurantId });

export const resumeOrder = (orderId: string, restaurantId: string) =>
    call<Order>('resume_order', { orderId, restaurantId });


export const getPaymentsForOrder = (order_id: string, restaurant_id?: string) =>
    call<Payment[]>('get_payments_for_order', { orderId: order_id, restaurantId: restaurant_id });

export const deleteOrderHistory = (
    sessionId: string | null,
    orderId: string | null,
    restaurantId: string,
    actorUserId: string
) => call<void>('delete_order_history', { sessionId, orderId, restaurantId, actorUserId });
