import { call } from './client';
import type { Category, Product, IngredientInput, ProductVariant, ProductModifierGroup } from '@/types';

export const getCategories = (restaurant_id?: string) => 
    call<Category[]>('get_categories', { restaurantId: restaurant_id });

export const getProducts = (category_id?: string, restaurant_id?: string) =>
    call<Product[]>('get_products', { categoryId: category_id, restaurantId: restaurant_id });

export const createProduct = (
    category_id: string, name: string,
    khmer_name?: string, price_cents?: number,
    image_path?: string, ingredients: IngredientInput[] = [],
    restaurant_id?: string, sku?: string,
    description?: string, khmer_description?: string,
    cost_price_cents?: number,
    stock_quantity?: number | null
) => call<string>('create_product', {
    categoryId: category_id, name, khmerName: khmer_name,
    priceCents: price_cents || 0,
    imagePath: image_path,
    ingredients,
    restaurantId: restaurant_id,
    sku,
    description,
    khmerDescription: khmer_description,
    costPriceCents: cost_price_cents ?? null,
    stockQuantity: stock_quantity ?? null,
});

export const updateProduct = (
    id: string, name: string, khmer_name: string | undefined,
    price_cents: number, category_id: string,
    is_available: boolean, image_path: string | undefined,
    ingredients: IngredientInput[],
    restaurant_id: string, sku?: string,
    sold_out_today?: boolean,
    description?: string, khmer_description?: string,
    cost_price_cents?: number,
    stock_quantity?: number | null
) => call<void>('update_product', {
    id, name, khmerName: khmer_name, priceCents: price_cents,
    categoryId: category_id,
    isAvailable: is_available, imagePath: image_path,
    ingredients,
    restaurantId: restaurant_id,
    sku,
    soldOutToday: sold_out_today,
    description,
    khmerDescription: khmer_description,
    costPriceCents: cost_price_cents ?? null,
    stockQuantity: stock_quantity ?? null,
});

export const setSoldOutToday = (id: string, soldOut: boolean, restaurantId: string) =>
    call<void>('set_sold_out_today', { id, soldOut, restaurantId });



export const deleteProduct = (id: string, restaurant_id: string, actorUserId: string) =>
    call<void>('delete_product', { id, restaurantId: restaurant_id, actorUserId });

export const createCategory = (name: string, khmer_name?: string, parent_id?: string, restaurant_id?: string) =>
    call<string>('create_category', { name, khmerName: khmer_name, parentId: parent_id, restaurantId: restaurant_id });

export const updateCategory = (id: string, name: string, khmer_name: string | undefined, parent_id: string | undefined, restaurant_id: string) =>
    call<void>('update_category', { id, name, khmerName: khmer_name, parentId: parent_id, restaurantId: restaurant_id });

export const deleteCategory = (id: string, restaurant_id: string, actorUserId: string) =>
    call<void>('delete_category', { id, restaurantId: restaurant_id, actorUserId });

export const saveProductImage = (filename: string, content: Uint8Array) =>
    call<string>('save_product_image', { filename, content: Array.from(content) });

// ── Product variants ──
export const getProductVariants = (product_id: string, restaurant_id: string) =>
    call<ProductVariant[]>('get_product_variants', { productId: product_id, restaurantId: restaurant_id });

export const createProductVariant = (data: {
    product_id: string; name: string; name_km?: string; sku?: string;
    price_cents: number; stock_quantity?: number | null; sort_order?: number; restaurant_id: string;
}) => call<string>('create_product_variant', {
    productId: data.product_id, name: data.name, nameKm: data.name_km ?? null, sku: data.sku ?? null,
    priceCents: data.price_cents, stockQuantity: data.stock_quantity ?? null, sortOrder: data.sort_order ?? 0,
    restaurantId: data.restaurant_id,
});

export const updateProductVariant = (data: {
    id: string; name: string; name_km?: string; sku?: string; price_cents: number;
    stock_quantity?: number | null; is_active?: boolean; sort_order?: number; restaurant_id: string;
}) => call<void>('update_product_variant', {
    id: data.id, name: data.name, nameKm: data.name_km ?? null, sku: data.sku ?? null,
    priceCents: data.price_cents, stockQuantity: data.stock_quantity ?? null,
    isActive: data.is_active ?? true, sortOrder: data.sort_order ?? 0, restaurantId: data.restaurant_id,
});

export const deleteProductVariant = (id: string, restaurant_id: string) =>
    call<void>('delete_product_variant', { id, restaurantId: restaurant_id });

// ── Product modifier groups + options ──
export const getModifierGroups = (product_id: string, restaurant_id: string) =>
    call<ProductModifierGroup[]>('get_modifier_groups', { productId: product_id, restaurantId: restaurant_id });

export const createModifierGroup = (data: {
    product_id: string; name: string; name_km?: string; required?: boolean; multi_select?: boolean; sort_order?: number; restaurant_id: string;
}) => call<string>('create_modifier_group', {
    productId: data.product_id, name: data.name, nameKm: data.name_km ?? null,
    required: data.required ?? false, multiSelect: data.multi_select ?? false, sortOrder: data.sort_order ?? 0, restaurantId: data.restaurant_id,
});

export const updateModifierGroup = (data: {
    id: string; name: string; name_km?: string; required?: boolean; multi_select?: boolean; sort_order?: number; restaurant_id: string;
}) => call<void>('update_modifier_group', {
    id: data.id, name: data.name, nameKm: data.name_km ?? null,
    required: data.required ?? false, multiSelect: data.multi_select ?? false, sortOrder: data.sort_order ?? 0, restaurantId: data.restaurant_id,
});

export const deleteModifierGroup = (id: string, restaurant_id: string) =>
    call<void>('delete_modifier_group', { id, restaurantId: restaurant_id });

export const createModifierOption = (data: {
    group_id: string; name: string; name_km?: string; price_delta_cents: number; sort_order?: number; restaurant_id: string;
}) => call<string>('create_modifier_option', {
    groupId: data.group_id, name: data.name, nameKm: data.name_km ?? null,
    priceDeltaCents: data.price_delta_cents, sortOrder: data.sort_order ?? 0, restaurantId: data.restaurant_id,
});

export const updateModifierOption = (data: {
    id: string; name: string; name_km?: string; price_delta_cents: number; is_active?: boolean; sort_order?: number; restaurant_id: string;
}) => call<void>('update_modifier_option', {
    id: data.id, name: data.name, nameKm: data.name_km ?? null,
    priceDeltaCents: data.price_delta_cents, isActive: data.is_active ?? true, sortOrder: data.sort_order ?? 0, restaurantId: data.restaurant_id,
});

export const deleteModifierOption = (id: string, restaurant_id: string) =>
    call<void>('delete_modifier_option', { id, restaurantId: restaurant_id });
