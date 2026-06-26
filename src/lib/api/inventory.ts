import { call } from './client';
import { InventoryItem, StockMovement } from '@/types';

export const getInventoryItems = (restaurant_id?: string) =>
    call<InventoryItem[]>('get_inventory_items', { restaurantId: restaurant_id });

export const createInventoryItem = (data: {
    name: string,
    khmer_name?: string,
    unit_label: string,
    stock_qty: number,
    min_stock_qty: number,
    max_stock_qty?: number | null,
    cost_per_unit: number,
    restaurant_id?: string,
    restaurantId?: string
}) => call<InventoryItem>('create_inventory_item', {
    name: data.name,
    khmerName: data.khmer_name,
    unitLabel: data.unit_label,
    stockQty: data.stock_qty,
    minStockQty: data.min_stock_qty,
    maxStockQty: data.max_stock_qty ?? null,
    costPerUnit: data.cost_per_unit,
    restaurantId: data.restaurant_id || data.restaurantId
});

export const updateInventoryItem = (data: {
    id: string,
    name: string,
    khmer_name?: string,
    unit_label: string,
    stock_qty: number,
    min_stock_qty: number,
    max_stock_qty?: number | null,
    cost_per_unit: number,
    restaurant_id?: string,
    restaurantId?: string
}) => call<InventoryItem>('update_inventory_item', {
    id: data.id,
    name: data.name,
    khmerName: data.khmer_name,
    unitLabel: data.unit_label,
    stockQty: data.stock_qty,
    minStockQty: data.min_stock_qty,
    maxStockQty: data.max_stock_qty ?? null,
    costPerUnit: data.cost_per_unit,
    restaurantId: data.restaurant_id || data.restaurantId
});

export const deleteInventoryItem = (id: string, restaurantId: string, actorUserId: string) =>
    call<void>('delete_inventory_item', { id, restaurantId, actorUserId });


export const getInventoryLogs = (
    restaurant_id?: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => call<any[]>('get_inventory_logs', { restaurantId: restaurant_id });

export const receiveStock = (
    inventoryItemId: string,
    quantity: number,
    note: string | undefined,
    userId: string,
    restaurantId: string
) => call<InventoryItem>('receive_stock', { inventoryItemId, quantity, note, userId, restaurantId });

export const getStockMovements = (
    inventoryItemId: string,
    restaurantId: string,
    limit?: number
) => call<StockMovement[]>('get_stock_movements', { inventoryItemId, restaurantId, limit });
