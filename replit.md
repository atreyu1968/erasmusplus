# Erasmus+ MMG

Portal de movilidades Erasmus+ del IES Manuel Martín González.

## Run & Operate

- Start the managed workflows `artifacts/api-server: API Server` and `artifacts/erasmusplus-mmg: web`.
- `pnpm run check` checks migration entry-point syntax; `pnpm test` runs the existing tests with temporary databases and fictional accounts.
- Node.js 24 is required for `node:sqlite`.
- Do not run a root development/build command to verify the app. Use its workflows.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- The original application is Node HTTP + server-rendered HTML + SQLite, not a React SPA.
- Keep its native forms, redirects, server rendering, session cookies and CSRF checks intact.
- PostgreSQL/Drizzle and generated-client packages are unused scaffold, not the app's datastore. Do not push their schema or convert SQLite without explicit approval.

## Where things live

- `artifacts/erasmusplus-mmg/`: public web artifact at `/`, original CSS/JS/images/PWA assets and streaming web gateway.
- `artifacts/api-server/src/legacy/`: original application handlers, server-generated views, SQLite schema and business logic.
- `/api/legacy/*`: internal transport for the original native HTTP protocol; `/api/healthz`: health check.
- `src` and `public` at the root are compatibility symlinks for existing tests and administration tools.
- `artifacts/mockup-sandbox/`: existing design previews, not the live website.

## Architecture decisions

- This is a parity port, not a redesign. Retain the original SSR protocol rather than rewrite its many pages into React/generated hooks.
- The web artifact forwards dynamic requests through the shared proxy, preserving URLs, bodies, cookies, statuses, redirects and downloads.
- SQLite and private uploads remain together under `MMG_DATA_DIR` (default root `data/`), excluded from Git.
- Post-merge setup restores the original local database (including WAL records) and documents only when root `data/` is absent. It never replaces existing data or seeds accounts.

## Product

Spanish-language portal for students, teachers and coordination: applications, editions, destinations, selection, agenda/tasks, documents/PDFs, consent, messaging, notifications, passkeys and configurable public pages.

## User preferences

Preserve the existing colors and supplied MMG logo in the header, PDFs and favicon. Keep the header fixed, with the content area's scrollbar starting below it. Hide side navigation on visitor, login, registration and personal-data-protection pages. Internal navigation stays narrow when collapsed, opens on hover, and has a floating pin to keep it open; keep that pin accessible by keyboard and touch. The migration does not include the queued mobile application.

## Gotchas

- Keep `MMG_SECRET` stable: it signs tokens and encrypts email settings. The API runtime retains the previous fallback to `SESSION_SECRET`; never print either secret.
- Development keeps `MMG_ENABLE_REGISTRATION=0`, `MMG_ENV=development`, and `MMG_SECURE_COOKIE=1` for the HTTPS preview. No coordinator account is created automatically.
- Do not publish this app on Replit with its current local SQLite/upload storage: a durable-storage redesign needs separate approval. Keep database and documents together on an approved persistent volume for production, with independent encrypted backups.
- Registration and real participant data require the institution's security/privacy approvals and working email delivery. Keep registration closed and use fictional data meanwhile.
- Existing Ubuntu deployment helpers are retained for reference; their legacy npm/single-package installation commands are not the new workspace's setup procedure.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
