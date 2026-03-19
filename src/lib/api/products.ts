import { call } from './client';
import type { Category, Product } from '@/types';

export const getCategories = () => call<Category[]>('get_categories');

export const getProducts = (category_id?: string) =>
    call<Product[]>('get_products', { categoryId: category_id });

export const createProduct = (
    category_id: string, name: string,
    khmer_name?: string, price_cents?: number, stock_quantity?: number,
    image_path?: string
) => call<string>('create_product', {
    categoryId: category_id, name, khmerName: khmer_name,
    priceCents: price_cents || 0, stockQuantity: stock_quantity || 0,
    imagePath: image_path,
});

export const updateProduct = (
    id: string, name: string, khmer_name: string | undefined,
    price_cents: number, stock_quantity: number, category_id: string,
    is_available: boolean, image_path?: string
) => call<void>('update_product', {
    id, name, khmerName: khmer_name, priceCents: price_cents,
    stockQuantity: stock_quantity, categoryId: category_id,
    isAvailable: is_available, imagePath: image_path,
});

export const updateStock = (id: string, delta: number) =>
    call<void>('update_stock', { id, delta });

export const deleteProduct = (id: string) => call<void>('delete_product', { id });

export const createCategory = (name: string, khmer_name?: string) =>
    call<string>('create_category', { name, khmerName: khmer_name });

export const updateCategory = (id: string, name: string, khmer_name?: string) =>
    call<void>('update_category', { id, name, khmerName: khmer_name });

export const deleteCategory = (id: string) =>
    call<void>('delete_category', { id });

export const getInventoryLogs = () => call<any[]>('get_inventory_logs');
