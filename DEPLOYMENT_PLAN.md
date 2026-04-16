# Deployment Plan — Dales Operations (Az-React-Web-App)

## Context
This is a full-stack Azure app (React + Vite frontend, Express API backend, Cosmos DB) that already has significant deployment infrastructure in place. This plan documents the end-to-end deployment approach and highlights gaps or improvements to consider.

---

## What Already Exists
- **Infrastructure as Code**: Bicep templates in `infra/` provisioning App Service Plan, two App Services (web + API), Cosmos DB (MongoDB API), Key Vault, Application Insights
- **Azure Developer CLI** (`azure.yaml`): One-command `azd up` for provision + deploy
- **CI/CD pipelines**: Both GitHub Actions (`.github/workflows/azure-dev.yml`) and Azure DevOps (`.azdo/pipelines/azure-dev.yml`) — triggered on push to main/master
- **Dockerfiles**: Multi-stage web (Vite build → Nginx) and API (Node 20) — available but `azd` currently deploys to App Service directly, not via containers

---

## Deployment Steps (Using `azd`)

### 1. Prerequisites
- Install Azure Developer CLI (`azd`)
- Authenticate: `azd auth login`
- Have an Azure subscription with permissions to create resources

### 2. Provision Infrastructure
```bash
azd provision
```
Creates: Resource Group, App Service Plan (B3 Linux), Web App Service, API App Service, Cosmos DB, Key Vault, Application Insights, Log Analytics

### 3. Deploy Application
```bash
azd deploy
```
- **Web**: Runs `tsc && vite build`, injects `VITE_API_BASE_URL` and App Insights connection string via pre-package hook, deploys `dist/` to App Service (served via pm2 SPA mode)
- **API**: Runs `tsc -b .`, deploys to App Service with managed identity for Cosmos DB access

### 4. Or Do Both at Once
```bash
azd up
```

---

## CI/CD Flow (Already Configured)
1. Developer pushes to `main` or `master`
2. GitHub Actions (or Azure DevOps) triggers
3. Authenticates to Azure via OIDC federated credentials
4. Runs `azd provision --no-prompt` (idempotent)
5. Runs `azd deploy --no-prompt`

### Required GitHub Secrets/Variables
- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`
- `AZURE_ENV_NAME`, `AZURE_LOCATION`
- `AZURE_CREDENTIALS` (if not using federated auth)

---

## Environment Configuration
| Variable | Service | Purpose |
|----------|---------|---------|
| `VITE_API_BASE_URL` | Web | Points frontend to API (injected by azd hook) |
| `VITE_APPLICATIONINSIGHTS_CONNECTION_STRING` | Web | Telemetry |
| `AZURE_COSMOS_ENDPOINT` | API | Cosmos DB connection |
| `AZURE_COSMOS_DATABASE_NAME` | API | DB name (default: "DalesOperations") |
| `AZURE_KEY_VAULT_ENDPOINT` | API | Secret retrieval |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | API | Telemetry |

---

## Gaps / Recommendations to Consider

1. **No staging environment**: Currently deploys straight to production. Consider adding a staging slot or separate environment (`azd` supports `azd env new staging`).
2. **App Service SKU**: B3 (Basic) has no deployment slots, autoscale, or SLA. Upgrade to S1+ or P1v3 for production use.
3. **No health checks**: Add App Service health check endpoints for both web and API.
4. **No custom domain / SSL**: Currently uses default `*.azurewebsites.net`. Add custom domain + managed certificate for production.
5. **Dockerfiles unused**: Dockerfiles exist but azd deploys as zip packages. Could switch to container-based deployment for consistency.
6. **E2E tests not in CI**: Playwright tests exist in `tests/` but aren't wired into the CI/CD pipeline.
7. **No rollback strategy**: Consider blue/green or slot-swap deployment for zero-downtime releases.

---

## Verification
- After `azd up`, verify both App Service URLs are accessible
- Check Application Insights for telemetry flowing
- Run Playwright smoke tests: `cd tests && npx playwright test`
- Confirm API can reach Cosmos DB (check managed identity RBAC)
