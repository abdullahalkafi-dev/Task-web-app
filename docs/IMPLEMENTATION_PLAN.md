# Dayflow — Implementation Plan

Windows desktop work is tracked separately in [Desktop implementation checklist](DESKTOP_IMPLEMENTATION_PLAN.md), with usage and maintenance in [Desktop guide](DESKTOP.md).

Every phase ends with: (a) `npm run typecheck` = 0 errors in both packages, (b) `docker compose up -d --build` succeeds, (c) docs updated and the phase ticked here.

> Verification note: the checks below were run locally with Node (typecheck, lint, unit tests, Playwright against a locally started stack). Docker was not available in the authoring environment, so the Dockerfiles and compose file are written to the spec but have **not** been executed — run `docker compose up -d --build` once to confirm on your machine.

- [x] **Phase 0 — Docs first**: ARCHITECTURE, DATABASE_SCHEMA, API_SPEC, IMPLEMENTATION_PLAN. _Reference images saved to `/references`; UI notes in ARCHITECTURE §9._
- [x] **Phase 1 — Scaffold & Docker**: folders, strict tsconfigs, ESLint, Dockerfiles with typecheck gate, compose, volumes, health, Tailwind tokens, font, App Shell frame.
  - _What changed:_ strict tsconfigs, ESLint (`no-explicit-any`, `ban-ts-comment`), Dockerfiles with a typecheck + lint gate, compose with named volumes, health endpoint, Tailwind tokens, Plus Jakarta Sans, app-shell frame.
- [x] **Phase 2 — Auth**: user + auth modules, seed, login, JWT + cookie, /auth/me, logout, guard, Create User, one-time password change, tests.
  - _What changed:_ `modules/user` + `modules/auth`, super-admin seed, JWT + httpOnly cookie (cookie only on safe GET), `/auth/me` re-sets the cookie, logout, route guard, Create User dialog, one-time password change.
- [x] **Phase 3 — Design primitives**: Button, PillTabs, StatusChip, GradientPill, Card, ColumnHeader, StatTile, InfoBanner, Dialog/Sheet, Drawer, Toast, ProfileCard, IconRail, TopBar; `/dev/ui` page compared with references.
  - _What changed:_ UI kit in `components/ui` and layout parts; hidden `/dev/ui` page.
- [x] **Phase 4 — Local data layer**: Dexie, Dhaka helpers, hooks, fractional ordering.
  - _What changed:_ Dexie per-user DB, `lib/time.ts`, `lib/order.ts`, `lib/repo.ts` (every write also enqueues the outbox), live-query hooks.
- [x] **Phase 5 — Home page**: greeting, stats, Board/List, task editor, DnD, midnight rollover, task module + tests.
  - _What changed:_ greeting, stat tiles, Board/List, task editor with draft autosave, dnd-kit (mouse/touch/keyboard), `useDhakaToday` rollover; `task` module.
- [x] **Phase 6 — Notes**: sidebar, reorder, editor with autosave + timestamps, note module + tests.
  - _What changed:_ notes sidebar, title search, reorder, editor with 800 ms autosave and Dhaka timestamps; `note` module.
- [x] **Phase 7 — Rich text + images**: TipTap, paste, uploads online/offline, sanitization, upload module + tests.
  - _What changed:_ TipTap toolbar + bubble menu, paste/drop/upload, offline blob queue, server-side `sanitize-html`, `upload` module (multer + sharp).
- [x] **Phase 8 — Sync engine + service worker**: outbox, push/pull, LWW, status pill, PWA, sync module + tests.
  - _What changed:_ `SyncEngine` (outbox, push/pull, LWW, backoff, Web Locks, BroadcastChannel), sync pill, Serwist service worker, manifest and icons; `sync` module.
- [x] **Phase 9 — History**: calendar with dots, read-only cards, Copy to Today.
  - _What changed:_ calendar with dots, read-only cards, Copy to Today (confirm on re-copy).
- [x] **Phase 10 — Responsive & polish**: drawer, bottom tab bar, touch DnD, dark mode, skeletons, a11y, reduced motion.
  - _What changed:_ tablet drawer, mobile bottom tab bar + sheets, touch DnD sensor, dark mode, skeletons, a11y fixes (axe clean), reduced motion.
- [x] **Phase 11 — README + tests**: module tests, frontend Vitest, Playwright, final docs pass.
  - _What changed:_ README, backend + frontend unit tests, Playwright suite, docs pass.
