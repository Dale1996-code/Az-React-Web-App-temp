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

## Preflight check

Run this before `azd deploy` (or any `azd up`) to verify the repo is in a
deployable state. It mirrors the build and test steps that run in CI before
provisioning, so failures are caught locally instead of mid-deploy.

```bash
./preflight.sh
```

What it checks (in order):

| Step | Command |
|---|---|
| Node version | must be >= 22 LTS |
| API install | `npm ci` |
| API tests | `npm test` (in-memory mock, no DB required) |
| API build | `npm run build` (ESLint + `tsc`) |
| Web install | `npm ci` |
| Web lint | `npm run lint` (zero-warning policy) |
| Web build | `npm run build` (`tsc` + Vite) |

Each step prints `[PASS]` or `[FAIL]`, and a summary table is shown at the end.
Exit code is `0` when everything passes, `1` when anything fails.

## Quickstart

```bash
# Authenticate once per install
azd auth login

# Verify the repo is ready first
./preflight.sh

# Provision infrastructure and deploy
azd up
```

## First Deployment Checklist

Before running `azd up` for the first time, confirm the following:

**Prerequisites**
- [ ] Azure subscription with Contributor or Owner access
- [ ] [Azure Developer CLI](https://aka.ms/azd-install) (`azd --version` prints a version)
- [ ] Node.js 22 LTS (`node --version` starts with `v22`)
- [ ] Azure CLI (`az --version`) — required by `DefaultAzureCredential` for local dev

**Provision and deploy**
1. `azd auth login` — authenticates `azd` with your Azure account
2. `azd up` — prompts for environment name, subscription, and region, then provisions infrastructure and deploys both services
   - Pick a region where B1 Linux App Service and Cosmos DB serverless are available (East US, West Europe, and North Europe are reliable choices)
   - First provision takes 5–10 minutes; subsequent `azd deploy` runs are ~2 minutes
3. After `azd up` finishes, run `azd env get-values` and confirm `SERVICE_WEB_URI` and `SERVICE_API_URI` are both present
4. Open `SERVICE_WEB_URI` in a browser — the app loads with 7 navigation links and the Shift Overview section is visible (confirms end-to-end API connectivity)

**Set up CI/CD (recommended)**
5. `azd pipeline config` — creates OIDC federated credentials and sets the required GitHub Actions variables (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_ENV_NAME`, `AZURE_LOCATION`) on your fork; subsequent pushes to `main`/`master` trigger the full pipeline automatically

---

## Developer Commands

| Command | Purpose |
|---|---|
| `azd up` | Provision infrastructure + deploy all services |
| `azd deploy` | Re-deploy code without re-provisioning |
| `azd monitor` | Open Application Insights dashboards |
| `azd pipeline config` | Configure GitHub Actions or Azure DevOps CI/CD |
| `azd down` | Delete all provisioned Azure resources |

## Build flow for `azd`

Both services are built inside `azure.yaml` `prepackage` hooks, so `azd up` and
`azd deploy` are fully self-contained from a clean checkout — no pre-built
artifacts or CI run required.

**API** (`src/api/`) — runs before azd packages the service directory:
1. `npm ci` — install all dependencies (including devDependencies needed for the build)
2. `npm run build` — ESLint + `tsc`, outputs compiled JS to `dist/`
3. `npm prune --omit=dev` — strip devDependencies before packaging

App Service starts the API with `node .`, which resolves `main = dist/index.js`.

**Web** (`src/web/`) — runs before azd packages the `dist/` directory:
1. Write `.env.local` — injects `VITE_API_BASE_URL` and `VITE_APPLICATIONINSIGHTS_CONNECTION_STRING` from the Bicep outputs exported by `azd provision`
2. `npm ci` — install dependencies
3. `npm run build` — `tsc && vite build`, which bakes the `VITE_*` env vars into the static bundle and outputs to `dist/`

The `.env.local` file is git-ignored and deleted by the `postdeploy` hook after
the deploy completes.

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

## App Service Plan SKU and Cost

Both App Services (web and API) share a single Linux App Service Plan. The default SKU is **B1** (Basic, 1 vCPU, 1.75 GB RAM), which is the cheapest tier that supports the features this app requires:

| Feature | Required by | Supported from |
|---|---|---|
| `alwaysOn` | API + Web site config | Basic (B1) |
| Linux (`reserved: true`) | Node.js runtime | Basic (B1) |
| Two sites on one plan | Shared plan | Basic (B1) |

**Free (F1) and Shared (D1) tiers are not supported.** Both apps have `alwaysOn: true` in their site config, which is unavailable below Basic tier; a deployment to F1/D1 will either fail or silently disable always-on, causing cold-start timeouts.

### Approximate monthly cost (B1, East US, 2026)

| Resource | Est. cost |
|---|---|
| App Service Plan B1 (Linux) | ~$13/mo |
| Cosmos DB (serverless, ~0 traffic) | ~$0–2/mo |
| Key Vault (standard) | ~$0–1/mo |
| Application Insights + Log Analytics | ~$0–3/mo |
| **Total dev estimate** | **~$15–20/mo** |

### Overriding the SKU for production

Set the `APP_SERVICE_PLAN_SKU_NAME` environment variable before provisioning. Valid values are: `B1`, `B2`, `B3`, `S1`, `S2`, `S3`, `P1v3`, `P2v3`, `P3v3`.

```bash
# One-time: write to your azd environment
azd env set APP_SERVICE_PLAN_SKU_NAME B3   # or S1, P1v3, etc.

# Then provision as normal
azd provision
```

You only need to set the SKU name — the tier (`Basic`, `Standard`, `PremiumV3`) is derived automatically.

To revert to dev defaults:

```bash
azd env set APP_SERVICE_PLAN_SKU_NAME B1
```

## Troubleshooting

### Where to look first after a failed deploy or live incident

Use this checklist when something breaks in production. Work top to bottom — the first few checks catch the majority of issues.

| Signal | Where to look | What to check |
|---|---|---|
| **API not responding / 503** | Azure Portal → App Service → **Log stream** | Container startup logs; look for `Fatal startup error` or `Cannot find module` |
| **Cosmos DB connection failure** | Log stream or App Insights **Traces** | `Cosmos DB connection error` message at startup; confirm managed identity RBAC |
| **API errors in production** | App Insights → **Failures** blade | 5xx traces include `[collection] METHOD /path 500 –` prefix + error message |
| **Key Vault / config missing** | App Insights **Traces** → search `AZURE_KEY_VAULT_ENDPOINT` | Warning logged at startup if KV endpoint not set; secrets missing = config gaps |
| **Health probe down** | `GET https://<api-url>/health` | Returns `{"status":"ok","timestamp":"..."}` when healthy; 503 = process crashed |
| **Frontend errors** | App Insights → **Failures** (filter `cloud/roleName = webui`) | Browser exceptions, failed AJAX calls, page-load telemetry |
| **Deployment failed** | GitHub Actions run → **Provision Infrastructure** or **Deploy** step | Quota errors, missing env vars, build failures |
| **Telemetry missing entirely** | App Insights → **Live Metrics** | If no data flows, check `APPLICATIONINSIGHTS_CONNECTION_STRING` on the App Service |

#### Useful CLI commands for quick triage

```bash
# Tail the API log stream live
az webapp log tail --name <api-app-name> --resource-group <resource-group>

# Confirm azd environment outputs are populated
azd env get-values | grep -E 'SERVICE_|API_BASE_URL|APPLICATIONINSIGHTS'

# Check what the health endpoint returns
curl -s https://<api-url>/health | jq .
```

#### Log landmarks to search for in App Insights Traces

| Log message prefix | Meaning |
|---|---|
| `API initialised – env=…` | Startup completed; confirms telemetry on/off and environment |
| `Cosmos DB connected successfully!` | DB connection confirmed at startup |
| `Cosmos DB connection error: …` | DB unreachable — check managed identity and endpoint |
| `Fatal startup error: …` | Process crashed before listening; see full message for cause |
| `[employees] GET /employees 500 – …` | 5xx from a CRUD route — error message included |
| `[dashboard] GET /dashboard?date=… 500 – …` | Dashboard aggregation failure |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` warn | Telemetry disabled — check App Service app settings |

---

### `azd provision` fails — quota or SKU not available

**Symptom:** provision exits with `QuotaExceeded`, `SkuNotAvailable`, or `Conflict` on the App Service Plan.

**Fix:** try a different Azure region. Some regions have limited B1 Linux capacity. Check your subscription's current App Service Plan count with:

```bash
az appservice plan list --output table
```

If you must use a specific region, request a quota increase or override the SKU:

```bash
azd env set APP_SERVICE_PLAN_SKU_NAME S1   # Standard tier, wider availability
azd provision
```

---

### API returns 503 or `/health` fails after deployment

**Symptom:** `GET /health` returns 503; GitHub Actions smoke tests fail on API checks.

**Cause:** the App Service started before the compiled `dist/` directory was in the ZIP, usually because the `prepackage` build step failed silently or `azd deploy` was run without first building.

**Fix:** check the Kudu log stream or run:

```bash
az webapp log tail --name <api-app-name> --resource-group <resource-group>
```

Look for `Cannot find module './dist/index'`. If present, re-run `azd deploy` — the prepackage hook (`npm ci && npm run build && npm prune --omit=dev`) will rebuild and re-package correctly.

---

### Web frontend loads but shows API errors or blank data

**Symptom:** routes render but data never loads; browser console shows CORS errors or requests to `http://undefined`.

**Cause:** `VITE_API_BASE_URL` was blank when the web bundle was built. This happens if `azd deploy` ran before `azd provision` (no Bicep outputs available for the prepackage hook to read).

**Fix:** check the injected URL:

```bash
azd env get-values | grep API_BASE_URL
```

If `API_BASE_URL` is missing or empty, run `azd provision` first, then `azd deploy`.

---

### GitHub Actions smoke tests fail — `SERVICE_WEB_URI not found`

**Symptom:** the workflow exits with `SERVICE_WEB_URI not found in azd environment`.

**Cause:** the "Provision Infrastructure" step failed, so `azd env get-values` returned nothing.

**Fix:** scroll up to the "Provision Infrastructure" step logs for the underlying error (usually quota, missing variable, or authentication). Fix the root cause, then re-run the workflow.

---

### Health probe or cold-start timeouts (`alwaysOn` not respected)

**Symptom:** the `/health` endpoint occasionally times out; App Service logs show "Instance recycled" frequently.

**Cause:** the App Service Plan was provisioned at F1 or D1 tier, which does not support `alwaysOn`. The deployment may have silently succeeded but disabled always-on.

**Fix:** verify the plan tier:

```bash
az appservice plan show --name <plan-name> --resource-group <resource-group> --query sku
```

If the SKU is not B1 or higher, re-provision with the correct tier (see [App Service Plan SKU and Cost](#app-service-plan-sku-and-cost) above).

---

## Security

A [managed identity](https://docs.microsoft.com/azure/active-directory/managed-identities-azure-resources/overview) is created for the API and used to authenticate with Cosmos DB (RBAC) and Key Vault. No connection strings are used at runtime — the API authenticates via `DefaultAzureCredential`.
