# DineOS — Project Context for Agents

Lean reference for agents. Read this instead of re-scanning the whole repo. Verify specific symbols with Grep/Read if you need exact signatures.

## Identity
**DineOS** v1.1.0 — offline-first Tauri 2 + Next.js 16 desktop POS for Cambodian restaurants. Dual currency USD/KHR (GDT/NBC 100-riel rounding), Khmer/English bilingual, per-restaurant Turso cloud sync.

## Stack
| Layer | Tech |
|-------|------|
| Frontend | Next.js 16.1.6, React 19, App Router, static SPA export (`output:"export"`) |
| Desktop shell | Tauri 2 (Rust, edition 2024), crate `dineos` |
| Styling | Tailwind CSS v4 |
| Package manager | **pnpm** |
| Local DB | libsql/SQLite at `app_data_dir/khpos.db` |
| Remote sync | Turso (libsql), bidirectional, 30s polling, per-restaurant |

## Commands
```bash
pnpm dev          # Next.js frontend only, port 3000
pnpm tauri:dev    # Full desktop app (spawns pnpm dev first)
pnpm build        # Static export → ./out
pnpm tauri:build  # Production bundle (uses ./out)
pnpm lint         # ESLint 9 — must pass before marking any task done
```
No test framework. Do not invent test commands.

## Source layout
```
src/
  app/              # Next.js App Router pages
    login/          # /login
    setup/          # /setup
    pos/            # /pos, /pos/tables, /pos/kitchen
    management/     # /management/* (admin console)
    super-admin/    # /super-admin/* (cross-restaurant ops)
    history/        # /history (order history)
  lib/
    api/            # Typed Tauri IPC wrappers (domain modules)
      client.ts     # call<T>(cmd, args) — THE ONLY invoke entrypoint
      index.ts      # re-exports all domain modules
    currency.ts     # roundKhr(), USD↔KHR conversion
    i18n.ts         # translations.en + translations.km
    tauri-commands.ts # back-compat re-export
  types/index.ts    # ALL TypeScript types (import via @/types)
  components/
    auth/RouteGuard.tsx   # Login gate, sync trigger, role routing
    ui/UpdateStatus.tsx   # Auto-updater 4-step state machine

src-tauri/src/
  commands/         # ~60 Tauri IPC commands grouped by domain
    auth.rs / restaurant.rs / products.rs / orders.rs
    inventory.rs / analytics.rs / exchange.rs / tables.rs
    kitchen.rs / releases.rs / reports.rs / rbac.rs
  db/
    mod.rs          # init_db, BAKED_URL/BAKED_TOKEN, ensure_critical_columns()
    sync.rs         # bidirectional sync daemon, ActiveSyncId sentinel
    migrations/     # versioned SQL files (tracked in _migrations table)
  lib.rs            # run() — registers all IPC commands, asset:// handler
```

## Critical conventions
- **IPC**: always `src/lib/api/client.ts::call<T>()`. Never `invoke()` directly from a component.
- **Money**: integer cents (`price_cents`, `total_usd`), integer riels (`total_khr`). No floats.
- **KHR rounding**: `roundKhr()` from `src/lib/currency.ts` — round to nearest 100 riels.
- **New DB columns**: add to a migration file in `src-tauri/src/db/migrations/` AND to `ensure_critical_columns()` in `src-tauri/src/db/mod.rs`.
- **Types**: only in `src/types/index.ts`. Import via `@/types`.
- **Bilingual**: add BOTH `translations.en.<key>` and `translations.km.<key>` in `src/lib/i18n.ts`.
- **Assets**: product images and logos served via `asset://<filename>` URI scheme (not `file://`).
- **Comments**: none unless the WHY is non-obvious. No docstrings.
- **`"use client"`**: all UI components (Tauri IPC needs `window`).

## Auth & routing
- `RouteGuard` (`src/components/auth/RouteGuard.tsx`) is the single source of truth for routing gates.
- Session persisted in `localStorage` under `dineos_session`.
- `super_admin` role → `/super-admin`; all others → `/pos`.
- `triggerSync(restaurant_id)` called once per session by `RouteGuard` after login.

## Multi-tenant model
Every data row has `restaurant_id`. All IPC commands require the caller to pass `restaurant_id` (from `user.restaurant_id` in the session). `super_admin` is restaurant-less.

## Deploy / release
**Never run this manually.** Human runs `release.ps1` (Windows) or `release.sh` (bash) — bumps `package.json` + `tauri.conf.json`, commits, tags `vX.Y.Z`, pushes → CI builds all platforms + publishes GitHub Release.
