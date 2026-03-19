// ============================================================
// Shared TypeScript types for the DineOS POS system
// ============================================================

// --------------- Auth ---------------
export interface UserSession {
    id: string;
    username: string;
    role: 'admin' | 'manager' | 'cashier' | 'waiter' | 'chef';
    full_name?: string;
    khmer_name?: string;
}

// --------------- Restaurant ---------------
export interface Restaurant {
    id: string;
    name: string;
    khmer_name?: string;
    tin?: string;
    address?: string;
    address_kh?: string;
    phone?: string;
    website?: string;
    vat_number?: string;
    receipt_footer?: string;
    logo_path?: string;
}

export interface RestaurantInput {
    name: string;
    khmer_name?: string;
    tin?: string;
    address?: string;
    address_kh?: string;
    phone?: string;
    website?: string;
    vat_number?: string;
    receipt_footer?: string;
    logo_path?: string;
}

export interface SetupStatus {
    needs_restaurant_setup: boolean;
}

// --------------- Products ---------------
export interface Category {
    id: string;
    name: string;
    khmer_name?: string;
    sort_order: number;
}

export interface Product {
    id: string;
    category_id?: string;
    name: string;
    khmer_name?: string;
    price_cents: number;
    stock_quantity: number;
    is_available: number;
    image_path?: string;
    category_name?: string;
    category_khmer?: string;
}

// --------------- Tables ---------------
export interface FloorTable {
    id: string;
    name: string;
    /** available = green, ordering = yellow, serving = red */
    status: 'available' | 'ordering' | 'serving';
    seat_count: number;
}

// --------------- Orders ---------------
export interface Order {
    id: string;
    user_id?: string;
    table_id?: string;
    status: 'open' | 'completed' | 'cancelled' | 'void';
    total_usd: number;
    total_khr: number;
    tax_vat: number;
    tax_plt: number;
    bakong_bill_number?: string;
    notes?: string;
    created_at: string;
    updated_at?: string;
    completed_at?: string;
}

export interface OrderItem {
    id: string;
    order_id: string;
    product_id: string;
    quantity: number;
    price_at_order: number;
    note?: string;
    /** pending = in order queue, cooking = kitchen picked up, done = ready to serve */
    kitchen_status: 'pending' | 'cooking' | 'done';
    product_name?: string;
    product_khmer?: string;
}

export interface KitchenOrderItem {
    id: string;
    product_name: string;
    product_khmer?: string;
    quantity: number;
    note?: string;
    kitchen_status: 'pending' | 'cooking' | 'done';
    created_at: string;
}

export interface KitchenOrder {
    order_id: string;
    table_id?: string;
    created_at: string;
    items: KitchenOrderItem[];
}

export interface PaymentInput {
    method: 'cash' | 'khqr' | 'card';
    currency: 'USD' | 'KHR';
    amount: number;
    bakong_transaction_hash?: string;
}

export interface Payment {
    id: string;
    order_id: string;
    method: string;
    currency: string;
    amount: number;
    bakong_transaction_hash?: string;
    created_at: string;
}

// --------------- System ---------------
export interface ExchangeRate {
    id: string;
    rate: number;
    effective_from: string;
}

export interface DbStatus {
    connected: boolean;
    path: string;
    mode: string;
}

// --------------- Analytics ---------------
export interface RevenueSummary {
    today_usd: number;
    today_orders: number;
    month_usd: number;
    month_orders: number;
    year_usd: number;
    year_orders: number;
    open_orders: number;
}

export interface RevenueByDay {
    date: string;
    total_usd: number;
    order_count: number;
}
