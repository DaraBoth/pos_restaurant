# DineOS — Marketing site

Standalone Next.js 16 + Tailwind 4 landing page deployed on Vercel.
**Completely independent from the Tauri desktop app in the repo root** —
different `package.json`, different `node_modules`, different release flow.

## Local dev

```bash
cd web
pnpm install
pnpm dev        # http://localhost:3001
```

## Deploy on Vercel (one-time setup)

1. Create a new Vercel project pointed at this repo.
2. In **Project Settings → General → Root Directory**, set it to `web`.
3. Framework Preset: Next.js (auto-detected). Build / Install commands: defaults.
4. Deploy. No env vars needed.

After the project is created, every push to the default branch redeploys
automatically.

## Push a web-only change

**Use the dedicated `web/` scripts** — they stage only `web/` files and skip
the version bump + git tag that the root `release.ps1` / `release.sh` use for
the Tauri desktop release. (The Tauri release tag triggers the GitHub Actions
desktop build — you don't want that firing for a marketing-copy edit.)

```powershell
# From repo root (Windows / PowerShell)
./web/release.ps1                       # interactive, prompts for message
./web/release.ps1 -msg "update copy"    # one-liner
```

```bash
# From repo root (bash / macOS / Linux / WSL)
./web/release.sh                        # interactive
./web/release.sh -m "update copy"       # one-liner
```

What the script does:
1. Verifies there are uncommitted changes inside `web/`.
2. Warns if anything outside `web/` is already staged (so a stray edit
   doesn't accidentally land in a web-only commit).
3. `git add web/` (just the marketing files — never `git add .`).
4. Commits with the prefix `web: <your message>`.
5. Pushes to the current branch — Vercel picks it up and redeploys.

**Do not run the root `release.ps1` for web changes** — that one bumps the
Tauri version, tags `vX.Y.Z`, pushes the tag, and kicks off the desktop
release CI. Use it only when you ship a new desktop build.

## What the landing page shows

- Auto-detects the visitor's OS (Windows vs macOS) and highlights the
  matching installer as the primary CTA.
- Lists all three download assets explicitly: Windows MSI, macOS Intel DMG,
  macOS Apple Silicon DMG. Falls back to a GitHub Releases link if the API
  call fails (rate-limited, offline, etc.).
- Surfaces the latest version, release date, and a link to the GitHub
  release notes.
- Available in two languages: `/` (English) and `/km` (Khmer). Language
  switcher in the nav.

## When to push

Almost never — the page reads everything from GitHub at runtime, so new
desktop releases surface automatically without redeploying. Push only when:

- Editing copy in `app/_content/en.ts` or `app/_content/km.ts`.
- Tweaking UI in `app/_components/LandingPage.tsx` or `app/globals.css`.
- Swapping SEO / OG metadata in `app/layout.tsx` or `app/km/page.tsx`.
- Adding screenshots in `public/screenshots/`.
