# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Dales Operations is a store-operations web app. It has three top-level pieces under a single repo:

- `src/api` — Express + TypeScript REST API backed by Google Cloud Firestore (native mode).
- `src/web` — React 18 + Fluent UI frontend built with Vite.
- `tests` — Playwright smoke tests that exercise the deployed/local web frontend.

Both services run on GCP Cloud Run. See `docs/gcp-deployment.md` for deployment details. CI/CD is in `.github/workflows/gcp-deploy.yml`.

## Common commands

Local dev (runs both services):

```bash
./start-dev.sh    # API on :3100, Web on :5173
```

API (`src/api/`):

| Command | Notes |
|---|---|
| `npm ci` | Install |
| `npm run lint` / `lint:fix` | ESLint on `src/**/*.ts` (also runs as `prebuild`) |
| `npm run build` | Lint + `tsc -b` to `dist/` |
| `npm start` | Runs `node .` — requires `dist/` to exist; `./start-dev.sh` builds first automatically |
| `npm test` | Jest integration tests, coverage, `--forceExit`. Tests match `**/*.spec.ts`. |
| `npx jest path/to/file.spec.ts -t "name"` | Single test |

Web (`src/web/`):

| Command | Notes |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc && vite build` |
| `npm run lint` | ESLint `.ts,.tsx`, `--max-warnings 0` |
| `npm run preview` | Serve production build |

E2E (`tests/`):

```bash
npm ci && npx playwright install --with-deps chromium
npx playwright test                  # uses REACT_APP_WEB_BASE_URL, then http://localhost:5173
npx playwright test --headed --debug
```

## API architecture

The API is deliberately small and uniform across the six domain collections: **employees, tasks, productivity, coaching, issues, summaries**. Understanding the three shared modules below means you understand all six routers.

- **`src/app.ts`** — builds the Express app. Mounts one router per collection plus `/dashboard`, a `/health` probe, and Swagger UI at `/` (from `./openapi.yaml`). CORS is wide-open when `NODE_ENV=development`; otherwise it allows anything in `API_ALLOW_ORIGINS` (comma-separated). All endpoints are open (no auth enforcement).
- **`src/config/index.ts`** — loads `.env` unless `NODE_ENV=production`, then reads `config/` JSON files. Maps `GOOGLE_CLOUD_PROJECT` → `database.projectId` and `FIRESTORE_DATABASE_ID` → `database.databaseId`. Warns (does not fail) if `GOOGLE_CLOUD_PROJECT` is unset.
- **`src/models/firestoreClient.ts`** — central data access module. Exports `DocStore` interface (`getAll/get/set/delete`), `configureFirestore()`, `getStore(collectionName)`, and `clearMockData()`. **When `NODE_ENV=test`, `configureFirestore` is skipped and `getStore` returns an in-memory `Map`-backed `InMemoryDocStore`** — this is what makes `npm test` require no DB. `clearMockData()` resets all maps between tests. In production, `getStore` returns a `FirestoreDocStore` wrapping a Firestore `CollectionReference`; auth uses Application Default Credentials (ADC).
- **`src/models/baseRepository.ts`** — `BaseRepository<T extends BaseEntity>` provides generic `findAll / findWhere / countWhere / findById / create / update / delete` on top of a `DocStore`. `create` stamps `id` (uuidv4), `createdDate`, `updatedDate` as ISO strings; `update` merges + forbids changing `id`. Since Firestore has no case-insensitive/substring queries, all filtering (including production queries) uses in-memory `evalCond` / `applySpec`.
- **`src/routes/createCrudRouter.ts`** — factory that produces the standard `GET / POST /:id GET/:id PUT/:id DELETE /:id` router for a collection. Arguments:
  - `getRepository: () => BaseRepository<T>` — a *factory* (not a value) so the store is resolved lazily after `configureFirestore`.
  - `label` — used in error logs.
  - `validate?: Validator` — called on POST with `isUpdate=false` and PUT with `isUpdate=true`. On failure returns 400 `{ error, details }`. On success, the sanitized body replaces `req.body` before hitting the repo.
  - `queryFilter?` — optional in-memory filter applied on `GET /` before `?top`/`?skip` pagination (default `top=100, skip=0`).
- **`src/validation/index.ts`** — one `validate*` function per collection, written in plain TS (no schema lib). Conventions:
  - Allowlist: unknown fields are silently stripped from the sanitized output.
  - Strings are trimmed; required checks only fire when `isUpdate=false`; numbers must be non-negative; dates are `YYYY-MM-DD`; times are `HH:MM`.
  - Enum sets live at the top of the file (`TASK_STATUSES`, `TASK_PRIORITIES`, `ISSUE_STATUSES`).
- **`src/routes/dashboard.ts`** — the one non-CRUD route. `GET /dashboard?date=YYYY-MM-DD` reads all six collections in parallel and aggregates counts, urgent tasks, open issues, coaching follow-ups due, active employee count, productivity totals, and the latest summary.

To add a new collection: add its name to `collectionNames` in `firestoreClient.ts`, create the Firestore collection in GCP, add a model + validator, and create a route file that calls `createCrudRouter` — mirror `src/routes/employees.ts`.

Tests all live in `src/routes/routes.spec.ts` and use `supertest` against the real Express app with `NODE_ENV=test` set in `beforeAll`. `clearMockData()` in `beforeEach` resets the in-memory store.

## Web architecture

- **`App.tsx` → `layout/layout.tsx`** — `ThemeProvider` (dark Fluent theme) → `BrowserRouter` → `Telemetry` → `AuthProvider` → `Layout`. The layout defines all routes: `/`, `/employees`, `/tasks`, `/productivity`, `/coaching`, `/issues`, `/summary`, plus `*` → `Navigate to="/"`. Sidebar open/close state lives in `Layout`.
- **`services/apiClient.ts`** — a single axios instance with `baseURL = config.api.baseUrl` (from `VITE_API_BASE_URL`, defaulting to `http://localhost:3100`). A request interceptor calls `acquireToken()` and attaches `Authorization: Bearer <token>` when `config.auth.enabled` is true. Every `*Service.ts` imports this and exposes typed CRUD functions matching the API routes.
- **`components/telemetry.tsx`** — always wraps children in the `TelemetryProvider`. On mount it calls `getApplicationInsights()` in `services/telemetryService.ts`, which short-circuits and returns `undefined` if `VITE_APPLICATIONINSIGHTS_CONNECTION_STRING` is missing or blank — so no SDK is constructed and `trackEvent` becomes a no-op. When the connection string is present the SDK loads once and is cached.
- **`components/AuthProvider.tsx`** — wraps the app with `MsalProvider` + a `MsalBridge` when `config.auth.enabled` is true (both `VITE_AZURE_CLIENT_ID` and `VITE_AZURE_TENANT_ID` are set). When auth is disabled, it renders children directly with an empty auth context — no MSAL overhead. `MsalBridge` triggers `loginRedirect` when no account is present and shows a "Signing you in…" overlay during the redirect flow. On error, it surfaces a dismissible message bar.
- **`contexts/authContext.ts`** — `AuthInfo` context + `useAuthInfo()` hook. Provides `{ account, authEnabled, login(), logout() }` to any component. Safe to call regardless of whether auth is enabled.
- **`services/authService.ts`** — creates the `PublicClientApplication` singleton (or `null` when auth disabled). Exports `loginRequest` (scopes) and `acquireToken()` for use by the axios interceptor.
- **Pages** — one page per collection under `pages/`, all following the same Fluent UI pattern (list + Panel for create/edit + Dialog for confirm). Each page owns its own data-fetching via the matching `services/*Service.ts`.

Vite env vars **must** be prefixed `VITE_`. The `VITE_API_BASE_URL` value must include a scheme (`http://` or `https://`).

## Frontend authentication

### Current state

Authentication is **implemented but not enforced**. The frontend MSAL code is present but inert — it only activates when all three `VITE_AZURE_*` vars are set. The API does not enforce tokens. Leave all three vars blank (or absent) to run the app without authentication.

### MSAL configuration (optional)

Set these in `src/web/.env` for local dev (copy from `.env.example`) to enable MSAL:

```env
VITE_AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_AZURE_API_SCOPE=api://<api-client-id>/access_as_user
```

When auth is enabled, the SPA app registration must have `http://localhost:5173` as an allowed redirect URI. Token storage uses `sessionStorage`.

## CI/CD

- CI/CD runs in `.github/workflows/gcp-deploy.yml` — builds both Docker images, pushes to Artifact Registry, deploys to Cloud Run, then runs Playwright smoke tests.
- The API uses Firestore with ADC (the Cloud Run service account) — no key secrets required.
- Required GitHub repository variables: `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_ARTIFACT_REPO`, `GCP_API_SERVICE_NAME`, `GCP_WEB_SERVICE_NAME`, `FIRESTORE_DATABASE_ID` (optional, defaults to `(default)`).
- Required GitHub secrets: `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`.
- The `/health` and `/dashboard` endpoints are always open — Cloud Run and smoke tests both probe them.

## Conventions worth preserving

- API returns `201` + `Location` header on create, `204` on delete, `404` with empty body on missing id, `400 { error, details }` on validation failure, `500 { error: "Internal server error" }` on unexpected errors.
- Validators use an allowlist — if you add a new field to a model, you must also add it to the corresponding `validate*` function or it will be silently dropped on writes.
- The root-level `openapi.yaml` is a copy of `src/api/openapi.yaml` kept in sync for tooling discovery — update both when changing the API surface.
