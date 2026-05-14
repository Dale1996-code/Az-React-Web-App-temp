# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Dales Operations is a store-operations web app. It has three top-level pieces under a single repo:

- `src/api` — Express + TypeScript REST API backed by Azure Cosmos DB (SQL API).
- `src/web` — React 18 + Fluent UI frontend built with Vite.
- `tests` — Playwright smoke tests that exercise the deployed/local web frontend.

Both services run on GCP Cloud Run. See `docs/gcp-cloud-run-phase1.md` and `docs/gcp-deployment.md` for deployment details. CI/CD is in `.github/workflows/gcp-deploy.yml`.

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

- **`src/app.ts`** — builds the Express app. Mounts one router per collection plus `/dashboard`, a `/health` probe, and Swagger UI at `/` (from `./openapi.yaml`). CORS is wide-open when `NODE_ENV=development`; otherwise it allows the Azure portal hosts plus anything in `API_ALLOW_ORIGINS` (comma-separated).
- **`src/config/index.ts`** — on startup, if `AZURE_KEY_VAULT_ENDPOINT` is set, iterates every secret in the vault and overlays it onto `process.env` (replacing `-` with `_` in names) *before* `require("config")` reads it. Key Vault secrets win over local env. `.env` is loaded unless `NODE_ENV=production`.
- **`src/models/cosmosClient.ts`** — single shared `CosmosClient` authenticated with `DefaultAzureCredential` (managed identity in Azure; developer credential locally). Caches a `Container` handle per collection in `containerNames`. **When `NODE_ENV=test`, `configureCosmos` is skipped and `getContainer` returns an in-memory `Map`-backed mock** — this is what makes `npm test` require no DB. `clearMockData()` resets it between tests.
- **`src/models/baseRepository.ts`** — `BaseRepository<T extends BaseEntity>` provides generic `findAll / findById / create / update / delete` on top of a `Container`. `create` stamps `id` (uuidv4), `createdDate`, `updatedDate`; `update` merges + forbids changing `id`. 404s from Cosmos become `null`/`false`.
- **`src/routes/createCrudRouter.ts`** — factory that produces the standard `GET / POST /:id GET/:id PUT/:id DELETE /:id` router for a collection. Arguments:
  - `getRepository: () => BaseRepository<T>` — a *factory* (not a value) so the container is resolved lazily after `configureCosmos`.
  - `label` — used in error logs.
  - `validate?: Validator` — called on POST with `isUpdate=false` and PUT with `isUpdate=true`. On failure returns 400 `{ error, details }`. On success, the sanitized body replaces `req.body` before hitting the repo.
  - `queryFilter?` — optional in-memory filter applied on `GET /` before `?top`/`?skip` pagination (default `top=100, skip=0`).
- **`src/validation/index.ts`** — one `validate*` function per collection, written in plain TS (no schema lib). Conventions:
  - Allowlist: unknown fields are silently stripped from the sanitized output.
  - Strings are trimmed; required checks only fire when `isUpdate=false`; numbers must be non-negative; dates are `YYYY-MM-DD`; times are `HH:MM`.
  - Enum sets live at the top of the file (`TASK_STATUSES`, `TASK_PRIORITIES`, `ISSUE_STATUSES`).
- **`src/routes/dashboard.ts`** — the one non-CRUD route. `GET /dashboard?date=YYYY-MM-DD` reads all six collections in parallel and aggregates counts, urgent tasks, open issues, coaching follow-ups due, active employee count, productivity totals, and the latest summary.

To add a new collection: add its name to `containerNames` in `cosmosClient.ts`, add the Cosmos DB container manually or via your provisioning process, add a model + validator, and create a route file that calls `createCrudRouter` — mirror `src/routes/employees.ts`.

Tests all live in `src/routes/routes.spec.ts` and use `supertest` against the real Express app with `NODE_ENV=test` set in `beforeAll`. `clearMockData()` in `beforeEach` resets the in-memory store.

## Web architecture

- **`App.tsx` → `layout/layout.tsx`** — `ThemeProvider` (dark Fluent theme) → `BrowserRouter` → `Telemetry` → `AuthProvider` → `Layout`. The layout defines all routes: `/`, `/employees`, `/tasks`, `/productivity`, `/coaching`, `/issues`, `/summary`, plus `*` → `Navigate to="/"`. Sidebar open/close state lives in `Layout`.
- **`services/apiClient.ts`** — a single axios instance with `baseURL = config.api.baseUrl` (from `VITE_API_BASE_URL`, defaulting to `http://localhost:3100`). A request interceptor calls `acquireToken()` and attaches `Authorization: Bearer <token>` when `config.auth.enabled` is true. Every `*Service.ts` imports this and exposes typed CRUD functions matching the API routes.
- **`components/telemetry.tsx`** — always wraps children in the `TelemetryProvider`. On mount it calls `getApplicationInsights()` in `services/telemetryService.ts`, which short-circuits and returns `undefined` if `VITE_APPLICATIONINSIGHTS_CONNECTION_STRING` is missing or blank — so no SDK is constructed and `trackEvent` becomes a no-op. When the connection string is present the SDK loads once and is cached.
- **`components/AuthProvider.tsx`** — wraps the app with `MsalProvider` + a `MsalBridge` when `config.auth.enabled` is true (both `VITE_AZURE_CLIENT_ID` and `VITE_AZURE_TENANT_ID` are set). When auth is disabled, it renders children directly with an empty auth context — no MSAL overhead.  `MsalBridge` triggers `loginRedirect` when no account is present and shows a "Signing you in…" overlay during the redirect flow. On error, it surfaces a dismissible message bar.
- **`contexts/authContext.ts`** — `AuthInfo` context + `useAuthInfo()` hook. Provides `{ account, authEnabled, login(), logout() }` to any component. Safe to call regardless of whether auth is enabled.
- **`services/authService.ts`** — creates the `PublicClientApplication` singleton (or `null` when auth disabled). Exports `loginRequest` (scopes) and `acquireToken()` for use by the axios interceptor.
- **Pages** — one page per collection under `pages/`, all following the same Fluent UI pattern (list + Panel for create/edit + Dialog for confirm). Each page owns its own data-fetching via the matching `services/*Service.ts`.

Vite env vars **must** be prefixed `VITE_`. The `VITE_API_BASE_URL` value must include a scheme (`http://` or `https://`).

## Frontend authentication

### Current state

Authentication is **implemented but not enforced**. The frontend acquires tokens and attaches them to every API request when auth is configured; the API middleware exists but currently allows all requests through. This lets the two halves be wired up and tested end-to-end before enforcement is turned on.

### Required app registration values

| Env var | Where to find it |
|---|---|
| `VITE_AZURE_CLIENT_ID` | Azure Portal → App registrations → your SPA app → Overview → Application (client) ID |
| `VITE_AZURE_TENANT_ID` | Azure Portal → App registrations → your SPA app → Overview → Directory (tenant) ID |
| `VITE_AZURE_API_SCOPE` | Azure Portal → App registrations → your API app → Expose an API → full scope URI, e.g. `api://<api-client-id>/access_as_user` |

### Required frontend environment variables

Set these in `src/web/.env` for local dev (copy from `.env.example`):

```env
VITE_AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_AZURE_API_SCOPE=api://<api-client-id>/access_as_user
```

For GCP Cloud Run deployments, `VITE_AZURE_TENANT_ID`, `VITE_AZURE_CLIENT_ID`, and `VITE_AZURE_API_SCOPE` are passed as Docker build args in the CI workflow — set them as GitHub repository variables (`VITE_AZURE_CLIENT_ID`, `VITE_AZURE_TENANT_ID`, `VITE_AZURE_API_SCOPE`). See `docs/gcp-deployment.md`.

### Local development notes

- Leave all three `VITE_AZURE_*` vars **blank** (or absent) to run the app without any authentication. API calls will have no `Authorization` header.
- When auth is enabled, the SPA app registration must have `http://localhost:5173` as an allowed redirect URI.
- Token storage uses `sessionStorage` (cleared when the tab closes). Change `cacheLocation` in `authService.ts` to `'localStorage'` if persistent sessions across tabs are needed.
- `acquireTokenSilent` is attempted first on every request; it only hits the network if the cached token is near expiry. If interaction is required (e.g. consent), it logs a warning and the request proceeds without a token — the user must navigate to trigger a fresh login via the header "Sign in" button.

### Production auth enforcement — current state (complete)

All application code is wired for production auth enforcement:

1. **API middleware** ✅ — `createAuthMiddleware` in `src/api/src/middleware/auth.ts` validates RS256 Bearer JWTs; enforced when `NODE_ENV=production` and `AZURE_AD_CLIENT_ID` is set.
2. **Token validation** ✅ — `validateToken()` checks `iss`, `aud`, `exp`, `nbf`, and RS256 signature against live Entra ID JWKS.
3. **Deployment wiring** ✅ — The GCP Cloud Run deploy workflow sets `NODE_ENV=production`, `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_ID` on the API service; the web image is built with `VITE_AZURE_*` build args baked in.

**Remaining manual steps** (cannot be automated — require Azure Portal access):
- Create Entra ID App Registrations for the API and SPA
- Expose `access_as_user` scope on the API app registration
- Grant the SPA app delegated permission to call the API scope
- Ensure admin consent is granted in the tenant
- Set GitHub repository variables `AZURE_AD_CLIENT_ID`, `VITE_AZURE_CLIENT_ID`, `VITE_AZURE_API_SCOPE` before the next CI deploy

## CI/CD

- CI/CD runs in `.github/workflows/gcp-deploy.yml` — builds both Docker images, pushes to Artifact Registry, deploys to Cloud Run, then runs Playwright smoke tests.
- The API authenticates to Cosmos DB using `AZURE_COSMOS_KEY` (stored in GCP Secret Manager and injected via `--set-secrets`). `AZURE_KEY_VAULT_ENDPOINT` is not set in Cloud Run, so the Key Vault code path is skipped at startup.
- The `/health` endpoint is always open (no auth) — Cloud Run and smoke tests both probe it.

## Conventions worth preserving

- API returns `201` + `Location` header on create, `204` on delete, `404` with empty body on missing id, `400 { error, details }` on validation failure, `500 { error: "Internal server error" }` on unexpected errors.
- Validators use an allowlist — if you add a new field to a model, you must also add it to the corresponding `validate*` function or it will be silently dropped on writes.
- The root-level `openapi.yaml` is a copy of `src/api/openapi.yaml` kept in sync for tooling discovery — update both when changing the API surface.
