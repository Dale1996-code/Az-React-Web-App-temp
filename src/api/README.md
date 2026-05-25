# Dales Operations — API

Express + TypeScript REST API backed by Google Cloud Firestore (native mode).

## Prerequisites

- Node 22 LTS
- npm

## Local Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

On Windows PowerShell: `Copy-Item .env.example .env`

The API authenticates with Firestore using Application Default Credentials — on Cloud Run the runtime service account is used automatically. Locally, run `gcloud auth application-default login` once, or point the API at the Firestore emulator via `FIRESTORE_EMULATOR_HOST`.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `GOOGLE_CLOUD_PROJECT` | No | — | GCP project that owns the Firestore database. Cloud Run resolves this from the metadata server; set explicitly for local dev. |
| `FIRESTORE_DATABASE_ID` | No | `(default)` | Set only if you created a named (non-default) Firestore database. |
| `FIRESTORE_EMULATOR_HOST` | No | — | Local-only override, e.g. `localhost:8080`. |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | No | — | API telemetry; skipped when blank |
| `APPLICATIONINSIGHTS_ROLE_NAME` | No | `API` | Role label in Application Insights |
| `API_ALLOW_ORIGINS` | No | — | Comma-separated CORS origins; not needed when `NODE_ENV=development` |
| `PORT` | No | `3100` | HTTP listen port |
| `REDIS_URL` | No | — | Enables the optional dashboard cache (Memorystore for Redis in production) |
| `AZURE_AD_TENANT_ID` | Prod only | — | Entra ID tenant; required when `NODE_ENV=production` |
| `AZURE_AD_CLIENT_ID` | Prod only | — | App Registration client ID; activates JWT enforcement |

In GCP Cloud Run all of these are set as service environment variables by the CI workflow — you do not manage them manually in production.

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

Each collection also accepts collection-specific filters that are applied in-memory after fetch (Firestore does not support case-insensitive or substring queries):

| Collection | Supported filters |
|---|---|
| `employees` | `?active=true\|false`, `?department=<name>`, `?search=<term>` |
| `tasks` | `?status=notStarted\|inProgress\|completed`, `?date=YYYY-MM-DD`, `?department=<name>` |
| `issues` | `?date=YYYY-MM-DD`, `?status=open\|resolved`, `?department=<name>`, `?category=<name>` |
| `coaching` | `?date=YYYY-MM-DD`, `?employeeId=<id>` |
| `productivity` | `?date=YYYY-MM-DD`, `?employeeId=<id>` |
| `summaries` | `?date=YYYY-MM-DD`, `?shiftLabel=<label>` |

## Scalability notes

Filtering and pagination happen in memory after the Firestore fetch. Firestore does not support case-insensitive comparisons or substring (`CONTAINS`) queries, so `BaseRepository.findWhere` / `findAll` evaluate the `FindSpec` via `evalCond` / `applySpec` on the documents returned from `getAll`. In test mode (`NODE_ENV=test`) the same evaluators run against an in-memory `Map`-backed store, so no real database is needed for tests.

**Tradeoff:** every list endpoint currently reads the full collection before filtering. For the current data volumes this is acceptable; once any collection grows large enough to matter, push the simple equality filters (e.g. `status`, `department`, `employeeId`) down into Firestore via `CollectionReference.where()` and only fall back to in-memory evaluation for the case-insensitive / substring conditions.
