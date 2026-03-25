import { call } from './client';
import type { Category, Product } from '@/types';

export const getCategories = (restaurant_id?: string) => 
    call<Category[]>('get_categories', { restaurantId: restaurant_id });

export const getProducts = (category_id?: string, restaurant_id?: string) =>
    call<Product[]>('get_products', { categoryId: category_id, restaurantId: restaurant_id });

export const createProduct = (
    category_id: string, name: string,
    khmer_name?: string, price_cents?: number, stock_quantity?: number,
    image_path?: string, inventory_item_id?: string, inventory_item_usage?: number, 
    restaurant_id?: string
) => call<string>('create_product', {
    categoryId: category_id, name, khmerName: khmer_name,
    priceCents: price_cents || 0, stockQuantity: stock_quantity || 0,
    imagePath: image_path,
    inventoryItemId: inventory_item_id,
    inventoryItemUsage: inventory_item_usage || 1.0,
    restaurantId: restaurant_id
});

export const updateProduct = (
    id: string, name: string, khmer_name: string | undefined,
    price_cents: number, stock_quantity: number, category_id: string,
    is_available: boolean, image_path: string | undefined,
    inventory_item_id: string | undefined, inventory_item_usage: number,
    restaurant_id: string
) => call<void>('update_product', {
    id, name, khmerName: khmer_name, priceCents: price_cents,
    stockQuantity: stock_quantity, categoryId: category_id,
    isAvailable: is_available, imagePath: image_path,
    inventoryItemId: inventory_item_id, inventoryItemUsage: inventory_item_usage,
    restaurantId: restaurant_id
});

export const updateStock = (id: string, delta: number, restaurant_id: string) =>
    call<void>('update_stock', { id, delta, restaurantId: restaurant_id });

export const deleteProduct = (id: string, restaurant_id: string) => 
    call<void>('delete_product', { id, restaurantId: restaurant_id });

export const createCategory = (name: string, khmer_name?: string, restaurant_id?: string) =>
    call<string>('create_category', { name, khmerName: khmer_name, restaurantId: restaurant_id });

export const updateCategory = (id: string, name: string, khmer_name: string | undefined, restaurant_id: string) =>
    call<void>('update_category', { id, name, khmerName: khmer_name, restaurantId: restaurant_id });

export const deleteCategory = (id: string, restaurant_id: string) =>
    call<void>('delete_category', { id, restaurantId: restaurant_id });

export const saveProductImage = (filename: string, content: Uint8Array) =>
    call<string>('save_product_image', { filename, content: Array.from(content) });
