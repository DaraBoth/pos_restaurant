// ============================================================
// tauri-commands.ts — Type-safe IPC wrappers for all Tauri commands
// ============================================================

let invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

// Safely import Tauri invoke - falls back to mock in browser/dev
if (typeof window !== 'undefined') {
    import('@tauri-apps/api/core').then((m) => {
        invoke = m.invoke;
    });
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    if (typeof invoke === 'undefined') {
        throw new Error('Tauri not available — running outside of desktop app.');
    }
    return invoke<T>(cmd, args);
}

// --------------- Types ---------------
export interface UserSession {
    id: string;
    username: string;
    role: 'admin' | 'manager' | 'cashier' | 'waiter';
    full_name?: string;
    khmer_name?: string;
}

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
    category_name?: string;
    category_khmer?: string;
}

export interface FloorTable {
    id: string;
    name: string;
    status: string;
}

export interface OrderItem {
    id: string;
    order_id: string;
    product_id: string;
    quantity: number;
    price_at_order: number;
    note?: string;
    product_name?: string;
    product_khmer?: string;
}

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

export interface ExchangeRate {
    id: string;
    rate: number;
    effective_from: string;
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

export interface DbStatus {
    connected: boolean;
    path: string;
    mode: string;
}

// --------------- Auth Commands ---------------
export const login = (username: string, password: string) =>
    call<UserSession>('login', { username, password });

export const createUser = (
    username: string, password: string, role: string,
    full_name?: string, khmer_name?: string
) => call<string>('create_user', { username, password, role, fullName: full_name, khmerName: khmer_name });

export const getUsers = () => call<UserSession[]>('get_users');

export const deleteUser = (id: string) => call<void>('delete_user', { id });

// --------------- Product Commands ---------------
export const getCategories = () => call<Category[]>('get_categories');

export const getProducts = (category_id?: string) =>
    call<Product[]>('get_products', { categoryId: category_id });

export const createProduct = (
    category_id: string, name: string,
    khmer_name?: string, price_cents?: number, stock_quantity?: number
) => call<string>('create_product', { categoryId: category_id, name, khmerName: khmer_name, priceCents: price_cents || 0, stockQuantity: stock_quantity || 0 });

export const updateProduct = (
    id: string, name: string, khmer_name: string | undefined,
    price_cents: number, stock_quantity: number, category_id: string, is_available: boolean
) => call<void>('update_product', {
    id, name, khmerName: khmer_name, priceCents: price_cents, stockQuantity: stock_quantity,
    categoryId: category_id, isAvailable: is_available
});

export const updateStock = (id: string, delta: number) =>
    call<void>('update_stock', { id, delta });

export const deleteProduct = (id: string) => call<void>('delete_product', { id });

export const createCategory = (name: string, khmer_name?: string) =>
    call<string>('create_category', { name, khmerName: khmer_name });

// --------------- Order Commands ---------------
export const createOrder = (user_id: string, table_id?: string) =>
    call<string>('create_order', { userId: user_id, tableId: table_id });

export const addOrderItem = (
    order_id: string, product_id: string, quantity: number, note?: string
) => call<OrderItem>('add_order_item', { orderId: order_id, productId: product_id, quantity, note });

export const updateOrderItemQuantity = (item_id: string, quantity: number) =>
    call<void>('update_order_item_quantity', { itemId: item_id, quantity });

export const getOrderItems = (order_id: string) =>
    call<OrderItem[]>('get_order_items', { orderId: order_id });

export const getOrders = (status?: string) =>
    call<Order[]>('get_orders', { status });

export const checkoutOrder = (order_id: string, payments: PaymentInput[]) =>
    call<Order>('checkout_order', { orderId: order_id, payments });

export const voidOrder = (order_id: string) =>
    call<void>('void_order', { orderId: order_id });

// --------------- Exchange Rate & Status ---------------
export const getExchangeRate = () => call<ExchangeRate>('get_exchange_rate');

export const setExchangeRate = (rate: number) =>
    call<ExchangeRate>('set_exchange_rate', { rate });

export const getDbStatus = () => call<DbStatus>('get_db_status');

export const getPaymentsForOrder = (order_id: string) =>
    call<Payment[]>('get_payments_for_order', { orderId: order_id });

// --------------- Table Commands ---------------
export const getTables = () => call<FloorTable[]>('get_tables');
export const createTable = (name: string) => call<FloorTable>('create_table', { name });
export const deleteTable = (id: string) => call<void>('delete_table', { id });
