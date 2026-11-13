# Roshan Study — Agent Guide

Roshan Study is a zero-account, offline-first educational platform for **Grades 9–12 (English medium)** across all **8 KPK BISE boards** (`Peshawar`, `Mardan`, `Swat`, `Malakand`, `Abbottabad`, `Kohat`, `Bannu`, `D.I. Khan`), paired with an admin Web CMS and Cloudflare backend.

## Repository Layout

| Directory / File | Stack | Purpose |
| :--- | :--- | :--- |
| `/` (`src/`, `server.ts`, `package.json`) | React 19, Vite 8, Tailwind v4, Express 4, `@google/genai` | Admin CMS, Book Uploader, Student Preview, and server-side Gemini Smart Question Generator |
| `/backend/` (`src/`, `migrations/`, `tests/`) | Cloudflare Workers, Hono, Zod, D1, R2, KV, Vitest | Public catalog/pack CDN API, idempotent attempt sync, and authenticated admin publish pipeline |
| `/mobile/` (`lib/`, `test/`, `pubspec.yaml`) | Flutter, Riverpod, GoRouter, `sqlite3` | Offline-first Android/iOS student app (`Home`, `Learn`, `Practice`, `Exams`, `Progress`, `Admissions`) |

## Non-Negotiable Architecture Rules

1. **SSC/HSSC vs. Admission Track Isolation:** Never mix `mdcat` / `etea_eng` / `uni_entrance` items into `ssc_hssc` board mastery, `topicsStudied` counts, daily board challenges, or exam analytics.
2. **Zero Mandatory Accounts & Zero PII:** Student profiles and learning progress stay local-first (`deviceUuid` only). Never add login gates or student PII fields.
3. **Server-Side AI Only:** `GEMINI_API_KEY` must remain in `server.ts` (`/api/admin/generate-questions`). Generated items are saved into ready-made chapter packs so students study offline at `$0` AI runtime cost.
4. **Honest Provenance & Publish Gates:** Only tag `official_past_paper` / `official_model_paper` when board, year, and human `reviewedBy` are present. Chapter publish requires `permissionVerified`, `>= 1` concept with textbook source/page, valid MCQ options/answers, and all 6 numerical steps (`given`, `required`, `formula`, `substitution`, `calculation`, `answerWithUnit`).
5. **Strict Numerical Answer Matching:** Use `AnswerMatcher.isMatch` (`/mobile/lib/core/utils/answer_matcher.dart`) and `isAnswerMatch` (`/src/utils/answerMatch.ts`). Never use `.contains()` / `.includes()` substring matching.
6. **Workspace TypeScript Split:** Root `tsconfig.json` excludes `backend/` because `backend/` compiles against `@cloudflare/workers-types` via `backend/tsconfig.json`. Always typecheck them separately.
7. **Flutter Lint Discipline:** `/mobile/analysis_options.yaml` enforces `directives_ordering`, `prefer_const_constructors`, `prefer_const_declarations`, `prefer_final_locals`, `avoid_print`, and `use_key_in_widget_constructors`. Keep Dart imports strictly grouped and alphabetized (`dart:`, then `package:`, then relative).

## Quick Navigation

- Environment & resource provisioning: see `SETUP.md`
- Build, lint, test, and smoke verification: see `COMPILE_AND_VERIFY.md`
