# Dales Operations

A React web app with a Node.js API and Azure Cosmos DB (SQL API) deployed on Azure App Service. Built with the Azure Developer CLI (`azd`) for provisioning and deployment.

## Application Overview

Dales Operations is a store operations management tool covering:

- **Employees** — staff roster and role tracking
- **Tasks** — operational task assignment and status
- **Productivity** — per-shift freight and zone records
- **Coaching** — employee coaching logs and follow-ups
- **Issues** — operational issue tracking (open/resolved)
- **Daily Summary** — end-of-day shift summaries

## Architecture

| Component | Azure Service |
|---|---|
| Web frontend | Azure App Service |
| Node.js API | Azure App Service |
| Data store | Azure Cosmos DB (SQL API) |
| Secrets | Azure Key Vault |
| Observability | Azure Monitor / Application Insights |

All resources are provisioned inside a single [resource group](https://docs.microsoft.com/azure/azure-resource-manager/management/manage-resource-groups-portal) via Bicep infrastructure-as-code under `infra/`.

### Prerequisites

- [Azure Developer CLI](https://aka.ms/azd-install)
- [Node.js 22 LTS with npm](https://nodejs.org/) — Node 20 reached end of life March 2026; Azure App Service targets `node|22-lts`

## Quickstart

```bash
# Authenticate once per install
azd auth login

# Provision infrastructure and deploy
azd up
```

## Developer Commands

| Command | Purpose |
|---|---|
| `azd up` | Provision infrastructure + deploy all services |
| `azd deploy` | Re-deploy code without re-provisioning |
| `azd monitor` | Open Application Insights dashboards |
| `azd pipeline config` | Configure GitHub Actions or Azure DevOps CI/CD |
| `azd down` | Delete all provisioned Azure resources |

## CI/CD

### Which pipeline to use

**GitHub Actions is the primary CI/CD path** (`.github/workflows/azure-dev.yml`).

It runs the full quality gate on every push to `main`/`master`:

1. API unit/integration tests (`npm test`)
2. API build (`tsc`)
3. Web build (`vite build`)
4. `azd provision` + `azd deploy`
5. Playwright smoke tests against the deployed app
6. Playwright report uploaded as a workflow artifact

Configure it once with:

```bash
azd pipeline config          # GitHub Actions (default)
```

### Azure DevOps alternative

A minimal Azure DevOps pipeline exists at `.azdo/pipelines/azure-dev.yml` for
teams that cannot use GitHub Actions. It provisions and deploys via `azd` but
**intentionally skips** API tests, the web build step, and Playwright smoke
tests. Do not treat it as equivalent to the GitHub Actions workflow without
first adding those steps.

Configure it with:

```bash
azd pipeline config --provider azdo
```

## Local Development

### Environment Setup

The frontend has sensible defaults for local dev, so no env file is required to start the UI. The API needs a Cosmos DB endpoint to serve data.

**API** — copy and fill in `src/api/.env.example`:

```bash
cp src/api/.env.example src/api/.env
# Edit src/api/.env — set AZURE_COSMOS_ENDPOINT to your Cosmos DB URI
```

The API authenticates to Cosmos DB with `DefaultAzureCredential`. Run `az login` once so the local developer credential is available.

**Web** — optional; defaults work out of the box:

```bash
cp src/web/.env.example src/web/.env
# Edit if you need a non-default API URL or want telemetry locally
```

> In Azure, all environment variables are injected automatically by the Bicep deployment and the `azd` prepackage hook — you never set them manually in production.

### Run Locally

```bash
# Quick start (both API + frontend)
./start-dev.sh

# Or start each service individually:
cd src/api && npm ci && NODE_ENV=development npm start   # http://localhost:3100
cd src/web && npm ci && npm run dev                       # http://localhost:5173
```

Run API integration tests (no database required — uses in-memory mock):

```bash
cd src/api && npm test
```

See service-level READMEs for more detail:

- [`src/api/README.md`](src/api/README.md) — API setup and endpoints
- [`src/web/README.md`](src/web/README.md) — React frontend setup
- [`tests/README.md`](tests/README.md) — Playwright smoke tests

## API Spec

The OpenAPI spec lives at [`src/api/openapi.yaml`](src/api/openapi.yaml). The root [`openapi.yaml`](openapi.yaml) mirrors that spec for tooling discovery.

## Security

A [managed identity](https://docs.microsoft.com/azure/active-directory/managed-identities-azure-resources/overview) is created for the API and used to authenticate with Cosmos DB (RBAC) and Key Vault. No connection strings are used at runtime — the API authenticates via `DefaultAzureCredential`.
