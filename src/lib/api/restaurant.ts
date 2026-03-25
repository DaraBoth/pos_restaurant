import { call } from './client';
import type { Restaurant, RestaurantInput, RestaurantLicenseStatus, SetupStatus } from '@/types';

export const getRestaurant = (restaurantId?: string) => call<Restaurant>('get_restaurant', { restaurantId: restaurantId || '' });

export const getSetupStatus = (restaurantId?: string) => call<SetupStatus>('get_setup_status', { restaurantId: restaurantId || '' });

export const updateRestaurant = (input: RestaurantInput, restaurantId?: string) =>
    call<Restaurant>('update_restaurant', { input, restaurantId });

export const updateRestaurantLicense = (
    restaurantId: string,
    licenseExpiresAt?: string,
    licenseSupportContact?: string
) => call<Restaurant>('update_restaurant_license', {
    restaurantId,
    licenseExpiresAt: licenseExpiresAt || null,
    licenseSupportContact: licenseSupportContact || null,
});

export const verifyRestaurantLicense = (restaurantId: string) =>
    call<RestaurantLicenseStatus>('verify_restaurant_license', { restaurantId });

export const saveLogo = (filename: string, content: Uint8Array) =>
    call<string>('save_logo', { filename, content: Array.from(content) });

export const triggerSyncReset = (restaurantId: string) =>
    call<void>('trigger_sync_reset', { restaurantId });
