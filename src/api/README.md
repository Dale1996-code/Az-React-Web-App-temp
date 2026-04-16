# Dales Operations — API

Express + TypeScript REST API backed by Azure Cosmos DB (SQL API with managed identity).

## Prerequisites

- Node 18+
- npm

## Local Environment

Create a `.env` in `src/api/` with the following:

- `AZURE_COSMOS_ENDPOINT` — Cosmos DB account endpoint (e.g. `https://your-account.documents.azure.com:443/`)
- `AZURE_COSMOS_DATABASE_NAME` — Database name (default: `DalesOperations`)
- `AZURE_KEY_VAULT_ENDPOINT` — Key Vault URI (optional; secrets are overlaid on env vars at startup)
- `APPLICATIONINSIGHTS_CONNECTION_STRING` — Application Insights connection string (optional for local dev)
- `API_ALLOW_ORIGINS` — Comma-separated allowed CORS origins (not needed when `NODE_ENV=development`)

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
