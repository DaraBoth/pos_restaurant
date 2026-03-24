import { call } from './client';
import { InventoryItem, ProductIngredient } from '@/types';

export const getInventoryItems = (restaurant_id?: string) =>
    call<InventoryItem[]>('get_inventory_items', { restaurantId: restaurant_id });

export const createInventoryItem = (data: {
    name: string;
    khmer_name?: string;
    unit_label: string;
    stock_qty: number;
    stock_pct: number;
    min_stock_qty: number;
    cost_per_unit: number;
    restaurant_id: string;
}) => call<InventoryItem>('create_inventory_item', data);

export const updateInventoryItem = (data: {
    id: string;
    name: string;
    khmer_name?: string;
    unit_label: string;
    stock_qty: number;
    stock_pct: number;
    min_stock_qty: number;
    cost_per_unit: number;
    restaurantId: string;
}) => call<InventoryItem>('update_inventory_item', data);

export const deleteInventoryItem = (id: string, restaurantId: string) =>
    call<void>('delete_inventory_item', { id, restaurantId });

export const getProductIngredients = (product_id: string, restaurant_id: string) =>
    call<ProductIngredient[]>('get_product_ingredients', { productId: product_id, restaurantId: restaurant_id });

export const setProductIngredient = (
    product_id: string,
    inventory_item_id: string,
    usage_percentage: number,
    restaurant_id: string
) => call<ProductIngredient>('set_product_ingredient', { 
    productId: product_id, 
    inventoryItemId: inventory_item_id, 
    usagePercentage: usage_percentage,
    restaurantId: restaurant_id
});

export const removeProductIngredient = (
    product_id: string,
    inventory_item_id: string,
    restaurant_id: string
) => call<void>('remove_product_ingredient', { 
    productId: product_id, 
    inventoryItemId: inventory_item_id,
    restaurantId: restaurant_id
});

export const getInventoryLogs = (restaurant_id?: string) => 
    call<any[]>('get_inventory_logs', { restaurantId: restaurant_id });
