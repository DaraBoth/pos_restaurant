import { call } from './client';
import type { KitchenOrder } from '@/types';

export const getKitchenOrders = () =>
    call<KitchenOrder[]>('get_kitchen_orders');

export const updateKitchenItemStatus = (
    item_id: string,
    status: 'pending' | 'cooking' | 'done'
) => call<void>('update_kitchen_item_status', { itemId: item_id, status });
