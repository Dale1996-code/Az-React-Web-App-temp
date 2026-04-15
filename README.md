# Dales Operations

A React web app with a Node.js API and Azure Cosmos DB (MongoDB API) deployed on Azure App Service. Built with the Azure Developer CLI (`azd`) for provisioning and deployment.

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
| Data store | Azure Cosmos DB (MongoDB API) |
| Secrets | Azure Key Vault |
| Observability | Azure Monitor / Application Insights |

All resources are provisioned inside a single [resource group](https://docs.microsoft.com/azure/azure-resource-manager/management/manage-resource-groups-portal) via Bicep infrastructure-as-code under `infra/`.

### Prerequisites

- [Azure Developer CLI](https://aka.ms/azd-install)
- [Node.js with npm (18.17.1+)](https://nodejs.org/)

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

See service-level READMEs:

- [`src/api/README.md`](src/api/README.md) — Node.js API setup
- [`src/web/README.md`](src/web/README.md) — React frontend setup
- [`tests/README.md`](tests/README.md) — Playwright smoke tests

## API Spec

The OpenAPI spec lives at [`src/api/openapi.yaml`](src/api/openapi.yaml). The root [`openapi.yaml`](openapi.yaml) mirrors that spec for tooling discovery.

## Security

A [managed identity](https://docs.microsoft.com/azure/active-directory/managed-identities-azure-resources/overview) is created for the app and used to authenticate with Azure services. The Cosmos DB connection string is stored in [Azure Key Vault](https://docs.microsoft.com/azure/key-vault/general/overview) and injected at runtime.
