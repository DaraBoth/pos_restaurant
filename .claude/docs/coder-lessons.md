# Coder Prevention Rules (Lessons Learned)

This file is **append-only**. The code-reviewer agent appends dated rules after analyzing `wf:error` tasks.
The coder agent reads this file at the start of every `/implement` cycle to avoid repeating past mistakes.

**Do NOT edit or delete existing entries.** Only append new entries below.

---

<!-- ENTRIES START — append new rules below this line -->

## 2026-06-29 — ESLint does not typecheck; always run pnpm build before completing (related task: 244482c6)
`pnpm lint` runs ESLint only — it does NOT invoke `tsc` and will NOT catch TypeScript type errors. `next build` runs the full TypeScript compiler as part of its pipeline and WILL catch them. A type error that passes `pnpm lint` will still break the CI release build (`beforeBuildCommand: pnpm build` in tauri.conf.json). Always run `pnpm build` (zero errors) in addition to `pnpm lint` before marking any task done. Evidence: `roleI18nKey` returning `string` instead of `TranslationKey` passed lint but broke the v3.0.2 release build (run 28349689538).
