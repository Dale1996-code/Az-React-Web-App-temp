# Dales Operations — API

Express + TypeScript REST API backed by Azure Cosmos DB (SQL API).

## Prerequisites

- Node 22 LTS
- npm

## Local Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

On Windows PowerShell: `Copy-Item .env.example .env`

The API authenticates with Cosmos DB using an account key (`AZURE_COSMOS_KEY`) in the GCP Cloud Run deployment. Set this in `src/api/.env` for local development (copy from `.env.example`).

| Variable | Required | Default | Notes |
|---|---|---|---|
| `AZURE_COSMOS_ENDPOINT` | Yes | — | Cosmos DB account URI |
| `AZURE_COSMOS_KEY` | Yes (local/prod) | — | Cosmos DB primary key; in CI injected from GCP Secret Manager |
| `AZURE_COSMOS_DATABASE_NAME` | No | `DalesOperations` | Database name |
| `AZURE_KEY_VAULT_ENDPOINT` | No | — | Do not set in Cloud Run — Key Vault is not used |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | No | — | API telemetry; skipped when blank |
| `APPLICATIONINSIGHTS_ROLE_NAME` | No | `API` | Role label in Application Insights |
| `API_ALLOW_ORIGINS` | No | — | Comma-separated CORS origins; not needed when `NODE_ENV=development` |
| `PORT` | No | `3100` | HTTP listen port |
| `AZURE_AD_TENANT_ID` | Prod only | — | Entra ID tenant; required when `NODE_ENV=production` |
| `AZURE_AD_CLIENT_ID` | Prod only | — | App Registration client ID; activates JWT enforcement |

In GCP Cloud Run all of these are set as service environment variables or Secret Manager secrets by the CI workflow — you do not manage them manually in production.

## Commands

| Command | Purpose |
|---|---|
| `npm ci` | Install dependencies |
| `npm run build` | Lint + compile TypeScript into `./dist` |
| `npm start` | Start the server (port 3100) — requires `dist/` from `npm run build` |
| `npm test` | Run integration tests (in-memory mock, no DB needed) |

## Authentication

**Development and test** (`NODE_ENV` ≠ `production`): auth is bypassed automatically.
A warning is logged at startup — no credentials required locally.

**Production** (`NODE_ENV=production`): every business endpoint requires an Azure
Entra ID Bearer JWT in the `Authorization: Bearer <token>` header. The API validates
the signature against the tenant JWKS endpoint and checks issuer, audience, and expiry.

`NODE_ENV=production` and the `AZURE_AD_*` variables are set on the Cloud Run API service
by the CI workflow. Set them as GitHub repository variables before the next deploy.
See [README.md#authentication](../../README.md#authentication) for the full setup.

The `/health` endpoint is always unauthenticated (used by Cloud Run health probes).

The React SPA acquires Entra ID tokens via MSAL and attaches them as Bearer tokens.
See the top-level `README.md#authentication` for the full setup walkthrough.

## Endpoints

| Path | Auth | Description |
|---|---|---|
| `GET /health` | Open | Health-check (returns `{ status: "ok" }`) |
| `GET /` | Open | Swagger UI (OpenAPI spec) |
| `/employees` | Required | Employee CRUD |
| `/tasks` | Required | Task CRUD |
| `/productivity` | Required | Productivity record CRUD |
| `/coaching` | Required | Coaching record CRUD |
| `/issues` | Required | Issue log CRUD |
| `/summaries` | Required | Daily summary CRUD |
| `/dashboard?date=YYYY-MM-DD` | Required | Aggregated dashboard data |

## Query parameters (list endpoints)

All `GET /` list endpoints support `?top=N&skip=N` pagination (default: top=100, skip=0).

Each collection also accepts collection-specific filters that are pushed server-side as Cosmos parameterized queries rather than fetched and filtered in memory:

| Collection | Supported filters |
|---|---|
| `employees` | `?active=true\|false`, `?department=<name>`, `?search=<term>` |
| `tasks` | `?status=notStarted\|inProgress\|completed`, `?date=YYYY-MM-DD`, `?department=<name>` |
| `issues` | `?date=YYYY-MM-DD`, `?status=open\|resolved`, `?department=<name>`, `?category=<name>` |
| `coaching` | `?date=YYYY-MM-DD`, `?employeeId=<id>` |
| `productivity` | `?date=YYYY-MM-DD`, `?employeeId=<id>` |
| `summaries` | `?date=YYYY-MM-DD`, `?shiftLabel=<label>` |

## Scalability notes (Phase 2)

**Before (Phase 1 and earlier):** All list endpoints called `readAll().fetchAll()` to load the entire container, then filtered and paginated in memory. The `/dashboard` endpoint loaded all six collections in full every request.

**After (Phase 2):** 
- List endpoints use `findWhere()` which emits a parameterized Cosmos SQL query with `WHERE`, `ORDER BY`, and `OFFSET N LIMIT M` clauses — only matching rows are returned over the wire.
- `/dashboard` fans out targeted queries: count queries (`SELECT VALUE COUNT(1) FROM c WHERE ...`) for totals, bounded `LIMIT 5` queries for lists, and point reads for employee name lookups. No full-collection scans.
- In test mode (`NODE_ENV=test`) the same `FindSpec` structs are evaluated against the in-memory mock store, so no real database is needed for tests.

**Tradeoffs:**
- Cosmos SQL `OFFSET N LIMIT M` pagination is not keyset-based; deep offsets (large skip values) still scan the skipped rows on the server. For the current data volumes this is acceptable; switch to continuation tokens if pages grow very large.
- `ORDER BY` on a field not covered by a composite index will trigger a full-partition scan in Cosmos. Add composite indexes on the Cosmos account (Azure Portal → Cosmos DB → Data Explorer → container Settings → Indexing Policy) as query patterns are confirmed.
- The dashboard `followUpDate <= date` condition requires `followUpDate` to be indexed. Cosmos indexes all paths by default, so this works out of the box.
