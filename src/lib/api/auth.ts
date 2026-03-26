import { call } from './client';
import type { UserSession, RestaurantSummary } from '@/types';

export const login = (username: string, password: string) =>
    call<UserSession>('login', { username, password });



export const createUser = (
    username: string, password: string, role: string,
    restaurantId: string, full_name?: string, khmer_name?: string
) => call<string>('create_user', { 
    username, password, role, restaurantId, 
    fullName: full_name, khmerName: khmer_name 
});

export const getUsers = (restaurantId: string) => call<UserSession[]>('get_users', { restaurantId });

export const updateUser = (
    id: string, password: string | undefined, role: string,
    restaurantId: string, full_name?: string, khmer_name?: string
) => call<void>('update_user', { 
    id, password, role, restaurantId, 
    fullName: full_name, khmerName: khmer_name 
});

export const deleteUser = (id: string, restaurantId: string) => 
    call<void>('delete_user', { id, restaurantId });

export const listAllRestaurants = () =>
    call<RestaurantSummary[]>('list_all_restaurants');

export const createRestaurantWithAdmin = (params: {
    restaurantName: string;
    restaurantAddress?: string;
    restaurantPhone?: string;
    licenseExpiresAt?: string;
    licenseSupportContact?: string;
    adminUsername: string;
    adminPassword: string;
    adminFullName?: string;
}) => call<string>('create_restaurant_with_admin', {
    restaurantName: params.restaurantName,
    restaurantAddress: params.restaurantAddress,
    restaurantPhone: params.restaurantPhone,
    licenseExpiresAt: params.licenseExpiresAt,
    licenseSupportContact: params.licenseSupportContact,
    adminUsername: params.adminUsername,
    adminPassword: params.adminPassword,
    adminFullName: params.adminFullName,
});

export const superadminCreateRestaurantUser = (params: {
    restaurantId: string;
    username: string;
    password: string;
    role: string;
    fullName?: string;
    khmerName?: string;
}) => call<string>('superadmin_create_restaurant_user', {
    restaurantId: params.restaurantId,
    username: params.username,
    password: params.password,
    role: params.role,
    fullName: params.fullName,
    khmerName: params.khmerName,
});

export const deleteRestaurant = (restaurantId: string) =>
    call<void>('delete_restaurant', { restaurantId });

export const superadminUpdateAdmin = (params: {
    adminId: string;
    newUsername?: string;
    newPassword?: string;
    newFullName?: string;
}) => call<void>('superadmin_update_admin', {
    adminId: params.adminId,
    newUsername: params.newUsername,
    newPassword: params.newPassword,
    newFullName: params.newFullName,
});

export const updateSuperadminProfile = (params: {
    superadminId: string;
    newUsername?: string;
    newPassword?: string;
    newFullName?: string;
}) => call<void>('update_superadmin_profile', {
    superadminId: params.superadminId,
    newUsername: params.newUsername,
    newPassword: params.newPassword,
    newFullName: params.newFullName,
});

export interface SuperadminUserView {
    id: string;
    restaurant_id: string | null;
    restaurant_name: string | null;
    username: string;
    role: string;
    full_name: string | null;
    created_at: string;
}

export const superadminGetAllUsers = () =>
    call<SuperadminUserView[]>('superadmin_get_all_users');

export const superadminMoveUser = (params: { userId: string; newRestaurantId: string }) =>
    call<void>('superadmin_move_user', { userId: params.userId, newRestaurantId: params.newRestaurantId });

export const createSuperadminAccount = (params: {
    username: string;
    password: string;
    fullName?: string;
}) => call<void>('create_superadmin_account', {
    username: params.username,
    password: params.password,
    fullName: params.fullName,
});
