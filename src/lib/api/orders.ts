import { call } from './client';
import type { Order, OrderItem, PaymentInput, Payment } from '@/types';

export const createOrder = (user_id: string, table_id?: string) =>
    call<string>('create_order', { userId: user_id, tableId: table_id });

export const addOrderItem = (
    order_id: string, product_id: string, quantity: number, note?: string
) => call<OrderItem>('add_order_item', { orderId: order_id, productId: product_id, quantity, note });

export const updateOrderItemQuantity = (item_id: string, quantity: number) =>
    call<void>('update_order_item_quantity', { itemId: item_id, quantity });

export const updateOrderItemNote = (item_id: string, note: string | undefined) =>
    call<void>('update_order_item_note', { itemId: item_id, note: note ?? null });

export const getOrderItems = (order_id: string) =>
    call<OrderItem[]>('get_order_items', { orderId: order_id });

export const getOrders = (status?: string, start_date?: string, end_date?: string) =>
    call<Order[]>('get_orders', { status, startDate: start_date, endDate: end_date });

export const getActiveOrderForTable = (table_id: string) =>
    call<Order | null>('get_active_order_for_table', { tableId: table_id });

export const getOrdersForTable = (table_id: string) =>
    call<Order[]>('get_orders_for_table', { tableId: table_id });

export const getSessionRounds = (session_id: string) =>
    call<Order[]>('get_session_rounds', { sessionId: session_id });

export const addRound = (user_id: string, session_id: string) =>
    call<string>('add_round', { userId: user_id, sessionId: session_id });

export const checkoutSession = (session_id: string, payments: PaymentInput[], discount_cents = 0) =>
    call<void>('checkout_session', { sessionId: session_id, payments, discountCents: discount_cents });

export const checkoutOrder = (order_id: string, payments: PaymentInput[], discount_cents = 0) =>
    call<Order>('checkout_order', { orderId: order_id, payments, discountCents: discount_cents });

export const voidOrder = (order_id: string) =>
    call<void>('void_order', { orderId: order_id });

export const holdOrder = (order_id: string, customer_name?: string, customer_phone?: string) =>
    call<void>('hold_order', { orderId: order_id, customerName: customer_name, customerPhone: customer_phone });


export const getPaymentsForOrder = (order_id: string) =>
    call<Payment[]>('get_payments_for_order', { orderId: order_id });
