# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Dales Operations is a store-operations web app that runs on Google Cloud. It has three top-level pieces under a single repo:

- `src/api` — Express + TypeScript REST API backed by Google Cloud Firestore (native mode).
- `src/web` — React 18 + Fluent UI frontend built with Vite.
- `tests` — Playwright smoke tests that exercise the deployed/local web frontend.

Both services are containerised and deployed to **Cloud Run**. The CI/CD workflow lives at `.github/workflows/gcp-deploy.yml`; see `docs/gcp-deployment.md` for the full deployment guide.

> **End-user authentication is currently disabled** — the API endpoints are open. The frontend MSAL code is still present but inert (it activates only when the `VITE_AZURE_*` env vars are set, which they no longer are).

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
npx playwright test                  # uses REACT_APP_WEB_BASE_URL, defaults to http://localhost:5173
npx playwright test --headed --debug
```

Deployment: push to `main`/`master` (or manually dispatch the `Deploy to Google Cloud Run` workflow). See `docs/gcp-deployment.md`.

## API architecture

The API is deliberately small and uniform across the six domain collections: **employees, tasks, productivity, coaching, issues, summaries**. Understanding the three shared modules below means you understand all six routers.

- **`src/app.ts`** — builds the Express app. Mounts one router per collection plus `/dashboard`, a `/health` probe, and Swagger UI at `/` (from `./openapi.yaml`). CORS is wide-open when `NODE_ENV=development`; otherwise it allows the origins listed in `API_ALLOW_ORIGINS` (comma-separated).
- **`src/config/index.ts`** — loads `.env` (unless `NODE_ENV=production`), then reads settings via the `config` npm package. The Firestore project id is optional (resolved from Application Default Credentials at runtime).
- **`src/models/firestoreClient.ts`** — initialises the shared `Firestore` client, which authenticates via Application Default Credentials (the Cloud Run runtime service account in production; `gcloud auth application-default login` locally). `getStore(name)` returns a `DocStore` for a collection. **When `NODE_ENV=test`, `configureFirestore` is skipped and `getStore` returns an in-memory `Map`-backed store** — this is what makes `npm test` require no DB. `clearMockData()` resets it between tests.
- **`src/models/baseRepository.ts`** — `BaseRepository<T extends BaseEntity>` provides generic `findAll / findWhere / countWhere / findById / create / update / delete` on top of a `DocStore`. `create` stamps `id` (uuidv4), `createdDate`, `updatedDate` (ISO strings); `update` merges + forbids changing `id`. Filtering (`findWhere`/`countWhere`) fetches the whole collection and evaluates `FilterCondition`s in memory — Firestore has no case-insensitive or substring query support.
- **`src/routes/createCrudRouter.ts`** — factory that produces the standard `GET / POST /:id GET/:id PUT/:id DELETE /:id` router for a collection. Arguments:
  - `getRepository: () => BaseRepository<T>` — a *factory* (not a value) so the Firestore collection is resolved lazily after `configureFirestore`.
  - `label` — used in error logs.
  - `validate?: Validator` — called on POST with `isUpdate=false` and PUT with `isUpdate=true`. On failure returns 400 `{ error, details }`. On success, the sanitized body replaces `req.body` before hitting the repo.
  - `queryFilter?` — optional in-memory filter applied on `GET /` before `?top`/`?skip` pagination (default `top=100, skip=0`).
- **`src/validation/index.ts`** — one `validate*` function per collection, written in plain TS (no schema lib). Conventions:
  - Allowlist: unknown fields are silently stripped from the sanitized output.
  - Strings are trimmed; required checks only fire when `isUpdate=false`; numbers must be non-negative; dates are `YYYY-MM-DD`; times are `HH:MM`.
  - Enum sets live at the top of the file (`TASK_STATUSES`, `TASK_PRIORITIES`, `ISSUE_STATUSES`).
- **`src/routes/dashboard.ts`** — the one non-CRUD route. `GET /dashboard?date=YYYY-MM-DD` reads all six collections in parallel and aggregates counts, urgent tasks, open issues, coaching follow-ups due, active employee count, productivity totals, and the latest summary.

To add a new collection: add its name to `collectionNames` in `firestoreClient.ts`, add a model + validator, and create a route file that calls `createCrudRouter` — mirror `src/routes/employees.ts`. Firestore creates the collection on first write, so no schema setup is needed.

Tests all live in `src/routes/routes.spec.ts` and use `supertest` against the real Express app with `NODE_ENV=test` set in `beforeAll`. `clearMockData()` in `beforeEach` resets the in-memory store.

## Web architecture

- **`App.tsx` → `layout/layout.tsx`** — `ThemeProvider` (dark Fluent theme) → `BrowserRouter` → `Telemetry` → `AuthProvider` → `Layout`. The layout defines all routes: `/`, `/employees`, `/tasks`, `/productivity`, `/coaching`, `/issues`, `/summary`, plus `*` → `Navigate to="/"`. Sidebar open/close state lives in `Layout`.
- **`services/apiClient.ts`** — a single axios instance with `baseURL = config.api.baseUrl` (from `VITE_API_BASE_URL`, defaulting to `http://localhost:3100`). A request interceptor attaches an `Authorization` header only when auth is enabled; auth is currently disabled, so requests are sent unauthenticated. Every `*Service.ts` imports this and exposes typed CRUD functions matching the API routes.
- **`components/telemetry.tsx`** — always wraps children in the `TelemetryProvider`. On mount it calls `getApplicationInsights()` in `services/telemetryService.ts`, which short-circuits and returns `undefined` if `VITE_APPLICATIONINSIGHTS_CONNECTION_STRING` is missing or blank — so no SDK is constructed and `trackEvent` becomes a no-op. When the connection string is present the SDK loads once and is cached.
- **`components/AuthProvider.tsx`** — wraps the app with `MsalProvider` + a `MsalBridge` when `config.auth.enabled` is true (both `VITE_AZURE_CLIENT_ID` and `VITE_AZURE_TENANT_ID` are set). When auth is disabled, it renders children directly with an empty auth context — no MSAL overhead.  `MsalBridge` triggers `loginRedirect` when no account is present and shows a "Signing you in…" overlay during the redirect flow. On error, it surfaces a dismissible message bar.
- **`contexts/authContext.ts`** — `AuthInfo` context + `useAuthInfo()` hook. Provides `{ account, authEnabled, login(), logout() }` to any component. Safe to call regardless of whether auth is enabled.
- **`services/authService.ts`** — creates the `PublicClientApplication` singleton (or `null` when auth disabled). Exports `loginRequest` (scopes) and `acquireToken()` for use by the axios interceptor.
- **Pages** — one page per collection under `pages/`, all following the same Fluent UI pattern (list + Panel for create/edit + Dialog for confirm). Each page owns its own data-fetching via the matching `services/*Service.ts`.

Vite env vars **must** be prefixed `VITE_`. The `VITE_API_BASE_URL` value must include a scheme (`http://` or `https://`).

## Authentication

End-user authentication is **disabled**. The API has no token-validation middleware and every endpoint is open. The frontend still contains MSAL-based auth code (`AuthProvider.tsx`, `authService.ts`, `authContext.ts`) but it is inert — it activates only when the `VITE_AZURE_*` env vars are set, and they are intentionally left unset.

Re-introducing authentication (e.g. Firebase Auth / Google Identity) is a future task. It would require a new API-side middleware and replacing or rewiring the frontend MSAL code.

## Infra + CI

- There is no infrastructure-as-code yet. Cloud Run service configuration lives in the `gcloud run deploy` flags inside `.github/workflows/gcp-deploy.yml`.
- The API authenticates to Firestore using the Cloud Run runtime service account via Application Default Credentials — **there are no connection strings or key files at runtime**; avoid introducing any.
- The GitHub Actions workflow `.github/workflows/gcp-deploy.yml` builds both images, pushes them to Artifact Registry, and deploys to Cloud Run. It authenticates to GCP via Workload Identity Federation.
- `/health` is the Cloud Run startup/liveness probe path.
- See `docs/gcp-deployment.md` for the one-time GCP setup and required GitHub variables/secrets.

## Conventions worth preserving

- API returns `201` + `Location` header on create, `204` on delete, `404` with empty body on missing id, `400 { error, details }` on validation failure, `500 { error: "Internal server error" }` on unexpected errors. 404s from the data layer surface as `null`/`false` from the repository.
- Validators use an allowlist — if you add a new field to a model, you must also add it to the corresponding `validate*` function or it will be silently dropped on writes.
- The root-level `openapi.yaml` is a copy of `src/api/openapi.yaml` kept in sync for tooling discovery — update both when changing the API surface.
