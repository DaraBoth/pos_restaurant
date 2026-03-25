import { call } from './client';
import { InventoryItem } from '@/types';

export const getInventoryItems = (restaurant_id?: string) =>
    call<InventoryItem[]>('get_inventory_items', { restaurantId: restaurant_id });

export const createInventoryItem = (
    name: string,
    khmer_name: string | undefined,
    unit_label: string,
    stock_qty: number,
    min_stock_qty: number,
    cost_per_unit: number,
    restaurant_id?: string
) => call<InventoryItem>('create_inventory_item', {
    name, khmerName: khmer_name, unitLabel: unit_label, stockQty: stock_qty, 
    minStockQty: min_stock_qty, costPerUnit: cost_per_unit, 
    restaurantId: restaurant_id
});

export const updateInventoryItem = (
    id: string,
    name: string,
    khmer_name: string | undefined,
    unit_label: string,
    stock_qty: number,
    min_stock_qty: number,
    cost_per_unit: number,
    restaurant_id: string
) => call<InventoryItem>('update_inventory_item', {
    id, name, khmerName: khmer_name, unitLabel: unit_label, stockQty: stock_qty, 
    minStockQty: min_stock_qty, costPerUnit: cost_per_unit, 
    restaurantId: restaurant_id
});

export const deleteInventoryItem = (id: string, restaurantId: string) =>
    call<void>('delete_inventory_item', { id, restaurantId });


export const getInventoryLogs = (restaurant_id?: string) => 
    call<any[]>('get_inventory_logs', { restaurantId: restaurant_id });
