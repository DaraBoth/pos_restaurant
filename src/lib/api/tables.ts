import { call } from './client';
import type { FloorTable } from '@/types';

export const getTables = () => call<FloorTable[]>('get_tables');

export const createTable = (name: string) => call<FloorTable>('create_table', { name });

export const deleteTable = (id: string) => call<void>('delete_table', { id });
