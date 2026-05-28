# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**DineOS** — an offline-first Tauri 2 + Next.js 16 (App Router, React 19) desktop POS for Cambodian restaurants. Dual currency (USD/KHR with GDT/NBC riel rounding), Khmer/English bilingual UI, per-restaurant cloud sync via Turso (libsql), and an embedded auto-updater.

Package manager is **pnpm** (see `pnpm-lock.yaml`). The Rust crate is in `src-tauri/` (crate name `dineos`, library `dineos_lib`, edition 2024).

## Common commands

```bash
pnpm dev             # Next.js dev server on :3000 (frontend only — Tauri IPC will throw)
pnpm tauri:dev       # Full desktop app (spawns `pnpm dev` via beforeDevCommand)
pnpm build           # next build → static export to ./out (next.config.ts: output:"export")
pnpm tauri:build     # Production desktop bundle (consumes ./out as frontendDist)
pnpm lint            # ESLint (next/core-web-vitals + next/typescript)
```

There is no test framework configured. Do not invent test commands.

### Signed production build (Windows)

`build-signed.ps1` loads `.env` and runs `pnpm tauri build`. It expects `TAURI_SIGNING_PRIVATE_KEY` (path or value), `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, and optionally `DATABASE_URL` / `AUTH_TOKEN` to override the baked Turso credentials in `src-tauri/src/db/mod.rs` (`BAKED_URL` / `BAKED_TOKEN`).

### Release / version bump

**Deployment is ONLY done via the release scripts** — do not hand-edit versions, manually tag, or push releases through any other path. Use `release.ps1` (Windows) or `release.sh` (bash); both bump the version in `package.json` AND `src-tauri/tauri.conf.json`, commit, tag `vX.Y.Z`, and push. CI (`.github/workflows/release.yml`) then runs `tauri-action` on Windows + macOS (x86_64 + aarch64) and **publishes** a GitHub Release (not a draft — required for auto-update, see below). **Both version fields must stay in sync** — the release scripts are the only supported way to keep them aligned.

### Auto-update

Running installs poll `tauri.conf.json::plugins.updater.endpoints[0]` (`https://github.com/DaraBoth/pos_restaurant/releases/latest/download/latest.json`) every 10 minutes via `src/components/ui/UpdateStatus.tsx` (mounted in the sidebar) using `@tauri-apps/plugin-updater::check()`. The UX is a four-step state machine in that one component: amber "Update v2.x.x" pill → click → blue "Downloading…" pill with progress → modal "Update Ready, Restart now or Later?" → user picks. "Restart now" calls `@tauri-apps/plugin-process::relaunch()`. "Later" drops to a green "Restart for v2.x.x" pill in the sidebar; the binary is already swapped on disk by `downloadAndInstall`, so a normal app close + open picks up the new version even without clicking the pill.

The flow requires three things to all be true; if any breaks, the updater silently returns "no update" and the pill never appears:
1. **Release is published, not draft.** `releaseDraft: false` in `release.yml`. GitHub's `/releases/latest` redirect resolves only to published releases.
2. **`latest.json` was uploaded to the release.** `createUpdaterArtifacts: true` in `tauri.conf.json::bundle` + signing-key env vars (`TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`) in the workflow are what make `tauri-action` generate and upload it. If those secrets are missing in GitHub repo settings, the manifest is never produced.
3. **The bundle is signed with the key matching `pubkey`** in `tauri.conf.json`. The pubkey is baked into every installed binary; bundles signed with a different key are rejected at install time even if downloaded successfully.

Debug a stuck updater by opening the running app's DevTools console — `[Updater]` lines log each check result (and the underlying error on failure). The endpoint URL can also be hit directly in a browser to confirm `latest.json` is reachable.

A `latest.json` file at the repo root is **not** read by anything at runtime — it's just dev-time debug output and is gitignored.

## Architecture

### Two-process split

- **Frontend** (`src/`): Next.js App Router exported as a static SPA (`output: "export"`, `trailingSlash: true`). Renders inside the Tauri WebView. No SSR; nothing in `src/` runs server-side at runtime.
- **Backend** (`src-tauri/src/`): Rust Tauri 2 app exposing ~60 IPC commands (`#[tauri::command]`). All registered in `lib.rs::run()` via `invoke_handler!`. Commands are grouped under `src-tauri/src/commands/{auth,restaurant,products,orders,inventory,analytics,exchange,tables,kitchen,releases}.rs`.

The frontend talks to Rust exclusively through `src/lib/api/client.ts::call<T>(cmd, args)`, which lazy-loads `@tauri-apps/api/core::invoke` once and caches the promise. Domain modules in `src/lib/api/*.ts` wrap each Tauri command in a typed function; `src/lib/api/index.ts` re-exports them, and `src/lib/tauri-commands.ts` is a back-compat facade that re-exports `@/types` + `./api`. **Add new IPC calls in `src/lib/api/<domain>.ts` and the matching Rust command file — do not call `invoke` directly from components.**

### Database — local SQLite + Turso remote sync

`src-tauri/src/db/mod.rs::init_db` opens a local libsql DB at `app_data_dir/khpos.db` and, if Turso credentials exist (env or `BAKED_URL`/`BAKED_TOKEN`), also opens a remote connection wrapped in `RemoteDb`. App states managed in `lib.rs::run()`:
- `Arc<libsql::Connection>` — local DB used by every command
- `RemoteDb(Option<Arc<Connection>>)` — remote, only for sync
- `ActiveSyncId(Arc<Mutex<Option<String>>>)` — sentinel for the currently syncing restaurant_id

**Sync model** (`src-tauri/src/db/sync.rs`): per-restaurant, bidirectional, polling every 30s. `RouteGuard` calls `triggerSync(restaurant_id)` after login; the Rust side spawns ONE daemon per active restaurant and checks the `ActiveSyncId` sentinel each cycle to terminate when the user logs out or switches restaurants. Switching restaurants kills the old daemon and starts a new one. PUSH/PULL is driven by `updated_at > _sync_state.synced_at` filtered by `restaurant_id` (directly on most tables, or via `orders` join for `order_items`/`payments` — see the `RESTAURANT_TABLES` table list and `SyncMode` enum).

**Migrations** (`src-tauri/src/db/mod.rs`):
- Versioned SQL files in `src-tauri/src/db/migrations/` embedded via `include_str!`, tracked in the `_migrations` table.
- `ensure_critical_columns()` runs after migrations and idempotently `ALTER TABLE ... ADD COLUMN` for columns introduced later. This is where schema drift between installs is reconciled — **add new columns here too if you can't ship a fresh migration**.
- Two ad-hoc rebuild migrations (`002_orders_remove_status_check`, `003_fix_broken_order_fks`) live in code rather than SQL files because SQLite can't `DROP CONSTRAINT`.
- `schema.sql` at the repo root is a reference snapshot; it is NOT executed — actual schema comes from the migration files + `ensure_critical_columns`.

### Frontend layout & routing

App Router under `src/app/`:
- `/login`, `/setup`, `/downloads` — public-ish
- `/pos`, `/pos/tables`, `/pos/kitchen` — cashier/waiter
- `/management/*` — admin console (products, categories, orders, inventory, tables, users, exchange-rate, analytics, settings, views)
- `/super-admin/*` — cross-restaurant ops (multi-tenant)
- `/history` — order history

The root `layout.tsx` wraps everything in `ThemeProvider → LanguageProvider → AuthProvider → OrderProvider → RouteGuard → AppShell`. **`RouteGuard` (`src/components/auth/RouteGuard.tsx`) is the single source of truth for navigation gating**: it enforces login, super-admin isolation, setup completion, license expiry, and the "initial sync pending" blocking screen. It also calls `triggerSync` exactly once per session via a `useRef` guard. Auth state is persisted to `localStorage` under `dineos_session` by `AuthProvider`.

### Multi-tenant model

Every business-data row carries a `restaurant_id`. Backend commands require the caller to pass `restaurant_id` (typically `user.restaurant_id` from the session). The `super_admin` role is restaurant-less and is force-redirected to `/super-admin` by `RouteGuard`; non-super_admin users are blocked from `/super-admin`.

### Currency & locale

- Money is stored as **integer USD cents** (`price_cents`, `total_usd`, etc.) and **integer KHR riels** (`total_khr`). Never use floats for storage.
- `src/lib/currency.ts::roundKhr` enforces "round to nearest 100 riels" (GDT/NBC rule). Use it whenever converting USD→KHR for display or payment.
- Bilingual strings live in `src/lib/i18n.ts` (`translations.en` / `translations.km`). Most user-facing entities have a `khmer_name` companion column.

### Asset serving (custom URI scheme)

`lib.rs::run()` registers an `asset://` URI handler that reads from `app_data_dir/product-images/` first, then falls back to `app_data_dir/logos/`. Product images and restaurant logos are saved via `save_product_image` / `save_logo` commands and referenced by `image_path` / `logo_path`. Use `asset://<filename>` URLs in the frontend — not file:// paths.

## Conventions worth knowing

- Path alias `@/*` → `./src/*` (tsconfig + components use it everywhere).
- All TS types live in `src/types/index.ts`; import via `@/types` or the re-export in `@/lib/tauri-commands`.
- Frontend is `"use client"` heavy (Tauri IPC requires `window`); `client.ts` guards against SSR-time invocation by throwing if `window` is undefined.
- Khmer Riel symbol is `៛`; locale `km-KH` is used for number formatting.
- Tauri credentials and signing keys: `private.key`, `signing.key.pub`, and the baked tokens in `db/mod.rs` exist in this repo — treat the working tree as containing secrets and avoid pushing leaked tokens upstream.
