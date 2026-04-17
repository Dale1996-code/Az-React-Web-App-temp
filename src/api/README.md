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

In Azure all of these are set as App Service environment variables by the Bicep deployment — you do not manage them manually.

## Commands

| Command | Purpose |
|---|---|
| `npm ci` | Install dependencies |
| `npm run build` | Lint + compile TypeScript into `./dist` |
| `npm start` | Build and start the server (port 3100) |
| `npm test` | Run integration tests (in-memory mock, no DB needed) |

## Endpoints

| Path | Description |
|---|---|
| `GET /health` | Health-check (returns `{ status: "ok" }`) |
| `/employees` | Employee CRUD |
| `/tasks` | Task CRUD |
| `/productivity` | Productivity record CRUD |
| `/coaching` | Coaching record CRUD |
| `/issues` | Issue log CRUD |
| `/summaries` | Daily summary CRUD |
| `/dashboard?date=YYYY-MM-DD` | Aggregated dashboard data |
| `/` | Swagger UI (OpenAPI spec) |
