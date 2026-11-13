# Roshan Study — Compile & Verify

Run these commands after making changes in the corresponding subproject.

## 1. Web CMS & Express Server (`/`)

```bash
# TypeScript check (excludes /backend)
npm run lint

# Production Vite frontend bundle -> dist/
npm run build

# Syntax check & production start check (Node 22+)
node --check server.ts
NODE_ENV=production npm start
```

### API Smoke Checks

With the server running on port `3000`:

```bash
# Health check -> 200 {"ok":true,"model":"gemini-4-hydrogen","aiReady":...}
curl -s http://127.0.0.1:3000/api/health

# Malformed JSON guard -> 400 {"code":"INVALID_JSON",...}
curl -s -X POST http://127.0.0.1:3000/api/admin/generate-questions \
  -H "Content-Type: application/json" \
  -d '{bad-json'
```

---

## 2. Cloudflare Workers Backend (`/backend/`)

```bash
cd backend

# TypeScript check against @cloudflare/workers-types
npm run typecheck

# Run Zod schema & contract tests (Vitest)
npm test

# Deploy Worker to Cloudflare (after wrangler.toml IDs & secrets are set)
npm run deploy
```

---

## 3. Flutter Mobile App (`/mobile/`)

```bash
cd mobile

# Static analyzer (enforces analysis_options.yaml rules)
flutter analyze

# Full widget + SQLite unit/integration tests
flutter test

# Release Android APK build (requires generated android/ runner)
flutter build apk --release
```

### Pre-Flight Checklist for Agents Without Flutter SDK Installed

If `flutter` is unavailable in the container, verify all `.dart` files before finishing:
- Balanced `()`, `[]`, `{}` across `/mobile/lib/` and `/mobile/test/`
- All `package:roshan_study/...` and relative imports resolve to existing files
- `directives_ordering`: imports sorted alphabetically within `dart:`, `package:`, and relative groups
- All `context.go(...)` / `context.push(...)` routes exist in `/mobile/lib/app/router/app_router.dart`
