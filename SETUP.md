# Roshan Study — Setup Guide

## Prerequisites

- **Node.js `>= 22.18`** (uses native TypeScript stripping for `npm start` -> `node server.ts`) and `npm`
- **Flutter SDK `>= 3.24` / Dart SDK `>= 3.4.0 <4.0.0`** (required only for building/testing `/mobile/`)
- **Cloudflare Wrangler CLI** (installed locally inside `/backend/` devDependencies)

---

## 1. Web CMS & Express Server (`/`)

1. Install dependencies from the repository root:
   ```bash
   npm install
   ```
2. Configure environment variables (copy `.env.example` to `.env` if running outside AI Studio):
   - `GEMINI_API_KEY` — Server-side key for `POST /api/admin/generate-questions` (`gemini-4-hydrogen`). Not required for `/api/health` or offline CMS authoring.
   - `PORT` — Optional, defaults to `3000` (binds `0.0.0.0`).
   - `APP_URL` — Optional runtime host URL.
3. Start development server (Express + Vite middleware):
   ```bash
   npm run dev
   ```

---

## 2. Cloudflare Workers Backend (`/backend/`)

1. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```
2. Provision Cloudflare resources (or run locally with Wrangler):
   ```bash
   npx wrangler d1 create roshan-study-db
   npx wrangler r2 bucket create roshan-study-packs
   npx wrangler kv namespace create CATALOG_KV
   ```
3. Update placeholder IDs in `backend/wrangler.toml`:
   - `database_id` under `[[d1_databases]]`
   - `id` under `[[kv_namespaces]]`
4. Apply the initial D1 schema (`backend/migrations/0001_initial.sql`):
   ```bash
   # Local development database
   npm run db:migrate:local

   # Remote production database
   npx wrangler d1 migrations apply roshan-study-db --remote
   ```
5. Configure Worker secrets for admin publishing and optional Telegram pack archiving:
   ```bash
   npx wrangler secret put ADMIN_API_TOKEN
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   npx wrangler secret put TELEGRAM_ARCHIVE_CHANNEL_ID
   ```
   Optional rate-limit vars in `backend/wrangler.toml`: `RATE_LIMIT_MAX_REQUESTS` (default `120`) and `RATE_LIMIT_WINDOW_SEC` (default `60`).
6. Run local Workers dev server:
   ```bash
   npm run dev
   ```

---

## 3. Flutter Mobile App (`/mobile/`)

1. Fetch Dart/Flutter dependencies:
   ```bash
   cd mobile
   flutter pub get
   ```
2. If native runner folders (`android/`, `ios/`) are not yet generated on your machine, scaffold them once without overwriting `lib/` or `test/`:
   ```bash
   flutter create --platforms=android,ios .
   ```
3. Run the app on an emulator or device:
   ```bash
   flutter run
   ```
   *(Works 100% offline out of the box via `StarterPacksSeed` + on-device `sqlite3`.)*
