import { call } from './client';
import { InventoryItem } from '@/types';

export const getInventoryItems = (restaurant_id?: string) =>
    call<InventoryItem[]>('get_inventory_items', { restaurantId: restaurant_id });

export const createInventoryItem = (data: {
    name: string,
    khmer_name?: string,
    unit_label: string,
    stock_qty: number,
    min_stock_qty: number,
    cost_per_unit: number,
    restaurant_id?: string,
    restaurantId?: string
}) => call<InventoryItem>('create_inventory_item', {
    name: data.name, 
    khmerName: data.khmer_name, 
    unitLabel: data.unit_label, 
    stockQty: data.stock_qty, 
    minStockQty: data.min_stock_qty, 
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
    costPerUnit: data.cost_per_unit, 
    restaurantId: data.restaurant_id || data.restaurantId
});

export const deleteInventoryItem = (id: string, restaurantId: string) =>
    call<void>('delete_inventory_item', { id, restaurantId });


export const getInventoryLogs = (restaurant_id?: string) => 
    call<any[]>('get_inventory_logs', { restaurantId: restaurant_id });
