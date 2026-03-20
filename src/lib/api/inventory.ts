import { call } from '../tauri-commands';
import { InventoryItem, ProductIngredient } from '@/types';

export const getInventoryItems = () =>
    call<InventoryItem[]>('get_inventory_items');

export const createInventoryItem = (data: {
    name: string;
    khmer_name?: string;
    unit_label: string;
    stock_qty: number;
    stock_pct: number;
    min_stock_qty: number;
    cost_per_unit: number;
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
}) => call<InventoryItem>('update_inventory_item', data);

export const deleteInventoryItem = (id: string) =>
    call<void>('delete_inventory_item', { id });

export const getProductIngredients = (product_id: string) =>
    call<ProductIngredient[]>('get_product_ingredients', { productId: product_id });

export const setProductIngredient = (
    product_id: string,
    inventory_item_id: string,
    usage_percentage: number
) => call<ProductIngredient>('set_product_ingredient', { 
    productId: product_id, 
    inventoryItemId: inventory_item_id, 
    usagePercentage: usage_percentage 
});

export const removeProductIngredient = (
    product_id: string,
    inventory_item_id: string
) => call<void>('remove_product_ingredient', { 
    productId: product_id, 
    inventoryItemId: inventory_item_id 
});
