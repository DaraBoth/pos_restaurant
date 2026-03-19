import { call } from './client';
import type { Restaurant, RestaurantInput, SetupStatus } from '@/types';

export const getRestaurant = () => call<Restaurant>('get_restaurant');

export const getSetupStatus = () => call<SetupStatus>('get_setup_status');

export const updateRestaurant = (input: RestaurantInput) =>
    call<Restaurant>('update_restaurant', { input });

export const saveLogo = (filename: string, content: Uint8Array) =>
    call<string>('save_logo', { filename, content: Array.from(content) });
