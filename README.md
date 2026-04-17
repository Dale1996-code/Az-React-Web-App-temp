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
- [Node.js with npm (20.x LTS)](https://nodejs.org/)

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

## Local Development

```bash
# Quick start (both API + frontend)
./start-dev.sh

# Or start each service individually:
cd src/api && npm ci && NODE_ENV=development npm start   # http://localhost:3100
cd src/web && npm ci && npm run dev                       # http://localhost:5173
```

Run API integration tests (no database required):

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
