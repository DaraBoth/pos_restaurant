// ============================================================
// tauri-commands.ts — backward-compatibility re-export facade
// All types live in @/types. All API calls live in @/lib/api.
// Existing imports from this file continue to work unchanged.
// ============================================================

export * from '@/types';
export * from './api/client';
export * from './api';