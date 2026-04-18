# Dales Operations — API

Express + TypeScript REST API backed by Azure Cosmos DB (SQL API with managed identity).

## Prerequisites

- Node 22 LTS
- npm

## Local Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

The API authenticates with Cosmos DB using `DefaultAzureCredential`. Run `az login` before starting the server locally so it can pick up your developer credential.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `AZURE_COSMOS_ENDPOINT` | Yes | — | Cosmos DB account URI from Azure Portal |
| `AZURE_COSMOS_DATABASE_NAME` | No | `DalesOperations` | Database name |
| `AZURE_KEY_VAULT_ENDPOINT` | No | — | When set, vault secrets overlay env vars at startup |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | No | — | API telemetry; skipped when blank |
| `APPLICATIONINSIGHTS_ROLE_NAME` | No | `API` | Role label in Application Insights |
| `API_ALLOW_ORIGINS` | No | — | Comma-separated CORS origins; not needed when `NODE_ENV=development` |
| `PORT` | No | `3100` | HTTP listen port |
| `AZURE_AD_TENANT_ID` | Prod only | — | Entra ID tenant; required when `NODE_ENV=production` |
| `AZURE_AD_CLIENT_ID` | Prod only | — | App Registration client ID; required when `NODE_ENV=production` |

In Azure all of these are set as App Service environment variables by the Bicep deployment — you do not manage them manually.

## Commands

| Command | Purpose |
|---|---|
| `npm ci` | Install dependencies |
| `npm run build` | Lint + compile TypeScript into `./dist` |
| `npm start` | Build and start the server (port 3100) |
| `npm test` | Run integration tests (in-memory mock, no DB needed) |

## Authentication

**Development and test** (`NODE_ENV` ≠ `production`): auth is bypassed automatically.
A warning is logged at startup — no credentials required locally.

**Production** (`NODE_ENV=production`): every business endpoint requires an Azure
Entra ID Bearer JWT in the `Authorization: Bearer <token>` header. The API validates
the signature against the tenant JWKS endpoint and checks issuer, audience, and expiry.

To enable in production, add both values to the App Service configuration:

```
AZURE_AD_TENANT_ID=<your-tenant-id>
AZURE_AD_CLIENT_ID=<api-app-registration-client-id>
```

The `/health` endpoint is always unauthenticated (used by Azure deployment probes).

> **Frontend integration note**: The React SPA will need to acquire an Entra ID token
> (e.g., via MSAL) and attach it to API requests. This is a Phase 2 frontend task.
> Until MSAL is wired into the frontend, the API should only be called from trusted
> server-side contexts in production.

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
