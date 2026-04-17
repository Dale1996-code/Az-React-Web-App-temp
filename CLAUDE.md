# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Dales Operations is a store-operations web app built as an Azure Developer CLI (`azd`) template. It has three top-level pieces under a single repo:

- `src/api` — Express + TypeScript REST API backed by Azure Cosmos DB (SQL API).
- `src/web` — React 18 + Fluent UI frontend built with Vite.
- `tests` — Playwright smoke tests that exercise the deployed/local web frontend.
- `infra` — Bicep IaC (AVM modules) provisioning App Service (x2), Cosmos DB, Key Vault, Application Insights, and a managed identity.

`azure.yaml` wires the two services (`web`, `api`) to `azd`. The `web` prepackage hook writes a `.env.local` at build time with `VITE_API_BASE_URL` + AppInsights connection string sourced from Bicep outputs, then deletes it post-deploy.

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
npx playwright test                  # uses REACT_APP_WEB_BASE_URL, then .azure/<env>/.env, then http://localhost:5173
npx playwright test --headed --debug
```

Deployment: `azd up` (provision + deploy), `azd deploy` (code only), `azd down` (teardown).

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

To add a new collection: add its name to `containerNames` in `cosmosClient.ts`, add a container in `infra/app/db-avm.bicep` with the same name, add a model + validator, and create a route file that calls `createCrudRouter` — mirror `src/routes/employees.ts`.

Tests all live in `src/routes/routes.spec.ts` and use `supertest` against the real Express app with `NODE_ENV=test` set in `beforeAll`. `clearMockData()` in `beforeEach` resets the in-memory store.

## Web architecture

- **`App.tsx` → `layout/layout.tsx`** — `ThemeProvider` (dark Fluent theme) → `BrowserRouter` → `Telemetry` wrapper → `Layout`. The layout defines all routes: `/`, `/employees`, `/tasks`, `/productivity`, `/coaching`, `/issues`, `/summary`, plus `*` → `Navigate to="/"`. Sidebar open/close state lives in `Layout`.
- **`services/apiClient.ts`** — a single axios instance with `baseURL = config.api.baseUrl` (from `VITE_API_BASE_URL`, defaulting to `http://localhost:3100`). Every `*Service.ts` imports this and exposes typed CRUD functions matching the API routes.
- **`components/telemetry.tsx`** — App Insights is enabled only if `VITE_APPLICATIONINSIGHTS_CONNECTION_STRING` is set; otherwise `telemetry.tsx` renders children unchanged.
- **Pages** — one page per collection under `pages/`, all following the same Fluent UI pattern (list + Panel for create/edit + Dialog for confirm). Each page owns its own data-fetching via the matching `services/*Service.ts`.

Vite env vars **must** be prefixed `VITE_`. The `VITE_API_BASE_URL` value must include a scheme (`http://` or `https://`).

## Infra + CI

- `infra/main.bicep` is the entry point; `infra/app/*.bicep` holds per-resource AVM modules. Container names in `infra/app/db-avm.bicep` must match `containerNames` in `src/api/src/models/cosmosClient.ts`.
- API authenticates to Cosmos DB + Key Vault via a user-assigned managed identity (RBAC data-plane role assignment in `cosmos-role-assignment.bicep`). **There are no connection strings at runtime** — avoid introducing any.
- CI/CD pipelines exist for both GitHub Actions (`.github/workflows/azure-dev.yml`) and Azure DevOps (`.azdo/pipelines/`); configure with `azd pipeline config`.

## Conventions worth preserving

- API returns `201` + `Location` header on create, `204` on delete, `404` with empty body on missing id, `400 { error, details }` on validation failure, `500 { error: "Internal server error" }` on unexpected errors.
- Validators use an allowlist — if you add a new field to a model, you must also add it to the corresponding `validate*` function or it will be silently dropped on writes.
- The root-level `openapi.yaml` is a copy of `src/api/openapi.yaml` kept in sync for tooling discovery — update both when changing the API surface.
- Work on branch `claude/add-claude-documentation-4U2OI` per the task instructions for this repo.
