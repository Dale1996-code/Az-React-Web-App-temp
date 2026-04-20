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

A secondary Azure DevOps pipeline exists at `.azdo/pipelines/azure-dev.yml` for
teams that cannot use GitHub Actions. It runs the following quality gates before
provisioning and deploying:

- OpenAPI spec sync check
- API unit/integration tests (`npm test`)
- API build (`npm run build`)

The following steps from the GitHub Actions workflow are **intentionally absent**
because they depend on infrastructure outputs that are unavailable before
`azd provision` runs, or require tooling that is impractical in a minimal ADO
pipeline:

| Step | Reason absent |
|---|---|
| Frontend build step | Requires `VITE_API_BASE_URL` from `azd provision` output |
| Playwright smoke tests | Requires deployed URLs and a Playwright-capable agent pool |
| Playwright report upload | Depends on the smoke test step |

If this pipeline becomes your primary production path, add those steps. See the
comments at the top of `.azdo/pipelines/azure-dev.yml` for details.

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

Run web frontend unit tests (vitest + jsdom, no browser required):

```bash
cd src/web && npm test          # single run
cd src/web && npm run test:watch # watch mode during development
```

See service-level READMEs for more detail:

- [`src/api/README.md`](src/api/README.md) — API setup and endpoints
- [`src/web/README.md`](src/web/README.md) — React frontend setup
- [`tests/README.md`](tests/README.md) — Playwright smoke tests

## API Spec

**Source of truth**: [`src/api/openapi.yaml`](src/api/openapi.yaml). Edit this file when changing the API surface.

The root [`openapi.yaml`](openapi.yaml) is a checked-in copy kept for tooling discovery (IDE plugins, API explorers). It must always be an exact copy of the API spec:

```bash
# After editing src/api/openapi.yaml:
cp src/api/openapi.yaml openapi.yaml
git add openapi.yaml
```

CI enforces this: the "Verify OpenAPI spec sync" step diffs the two files and fails the build if they diverge.

## Authentication

All business API endpoints (`/employees`, `/tasks`, `/dashboard`, etc.) require an Azure Entra ID Bearer JWT in the `Authorization: Bearer <token>` header.

**In production** (`NODE_ENV=production`): two App Service settings must be configured:

| Setting | Where to find it |
|---|---|
| `AZURE_AD_TENANT_ID` | Azure Portal → Entra ID → Overview → Tenant ID |
| `AZURE_AD_CLIENT_ID` | Azure Portal → Entra ID → App registrations → your API app → Application (client) ID |

The API will refuse to start in production if either value is missing.

**In local development** (`NODE_ENV=development` or `test`): auth is bypassed automatically with a startup warning. No Azure AD credentials are needed locally.

The `/health` endpoint is always open (no auth) — it is used by Azure App Service deployment probes.

> The React frontend will need MSAL wired in to acquire tokens before it can call the API in a production deployment. Until that is done, the API is accessible only from contexts that can obtain an Entra ID token directly (e.g., server-side scripts, Postman with a bearer token). See [`src/api/README.md`](src/api/README.md) for configuration details.

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

#### Prerequisite: enable App Service filesystem logging

`az webapp log tail` streams stdout/stderr from the App Service. This requires filesystem logging to be turned on — it is **off by default** on a freshly provisioned App Service.

Enable it once per environment:

```bash
az webapp log config \
  --name <api-app-name> \
  --resource-group <resource-group> \
  --application-logging filesystem \
  --level information
```

The API writes every log line to stdout (always, regardless of App Insights status), so once filesystem logging is enabled the log stream will show all startup messages, request errors, and health probes.

#### Useful CLI commands for quick triage

```bash
# Tail the API log stream live (requires filesystem logging enabled — see above)
az webapp log tail --name <api-app-name> --resource-group <resource-group>

# Confirm azd environment outputs are populated
azd env get-values | grep -E 'SERVICE_|API_BASE_URL|APPLICATIONINSIGHTS'

# Check what the health endpoint returns (also reports env= for environment confirmation)
curl -s https://<api-url>/health | jq .
```

#### Log landmarks to search for in App Insights Traces

| Log message prefix | Meaning |
|---|---|
| `API initialised – env=…` | Startup completed; confirms telemetry on/off and environment |
| `API listening on port …` | Process is bound and ready to accept traffic |
| `Application Insights telemetry enabled` | App Insights transport added; traces will flow to Azure Monitor |
| `Application Insights disabled — …` | Connection string missing; logs go to stdout only |
| `Application Insights setup failed: …` | Bad connection string or SDK error; check the value in App Settings |
| `Cosmos DB connected successfully!` | DB connection confirmed at startup |
| `Cosmos DB connection error: …` | DB unreachable — check managed identity and endpoint |
| `Fatal startup error: …` | Process crashed before listening; see full message for cause |
| `[employees] GET /employees 500 – …` | 5xx from a CRUD route — error message included |
| `[dashboard] GET /dashboard?date=… 500 – …` | Dashboard aggregation failure |
| `APPLICATIONINSIGHTS_CONNECTION_STRING is not set` warn | Telemetry disabled — check App Service app settings |
| `Auth: Azure Entra ID JWT enforcement enabled (tenant=…)` | Auth middleware active in production |
| `Auth: enforcement disabled — all requests allowed…` | Auth bypassed — expected in dev/test, unexpected in production |
| `Auth: token rejected – …` | 401 issued; message explains why (expired, bad aud, etc.) |

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

### Smoke tests pass route checks but fail on `GET /health` or "Shift Overview" not visible

**Symptom:** Playwright route-shell tests pass (the SPA shell loads), but the API connectivity checks fail — `GET /health` returns non-200, or the "Shift Overview" section never appears on the dashboard.

**What it means:** The "Shift Overview" section only renders after a successful `GET /dashboard` response; its absence means the API is reachable by the browser but returning an error. This is distinct from a CORS or URL misconfiguration — the request is reaching the API, but the API itself is unhealthy.

**Common causes and fixes:**

1. **Cosmos DB role assignment not yet propagated** — The managed identity RBAC assignment in `cosmos-role-assignment.bicep` can take 1–3 minutes after `azd provision` finishes. The API starts before the role is active and every Cosmos call returns 403. Check API logs:
   ```bash
   az webapp log tail --name <api-app-name> --resource-group <resource-group>
   ```
   Look for `403 Forbidden` from Cosmos. Wait a few minutes, then re-run the smoke tests or hit `/health` manually.

2. **`dist/` missing from the deployed package** — If the API `prepackage` hook failed silently (e.g., TypeScript compile error), App Service starts but `node .` immediately crashes. Logs will show `Cannot find module './dist/index'`. Re-run `azd deploy` after confirming `./preflight.sh` passes locally.

3. **Key Vault unreachable at startup** — The API loads Key Vault secrets before accepting requests (`src/config/index.ts`). If the managed identity access policy was not applied yet, startup will log `Access denied` from Key Vault and the process will crash or hang. Same fix as #1 — wait for IAM propagation and restart the App Service.

---

### CORS errors after re-provision with a new environment name or region

**Symptom:** the frontend loads, `VITE_API_BASE_URL` is correctly set (no `http://undefined`), but the browser console shows `Access-Control-Allow-Origin` errors on API calls.

**Cause:** the API's allowed origins are baked in at provision time. In `infra/main.bicep`, `API_ALLOW_ORIGINS` and `allowedOrigins` are both set to `web.outputs.SERVICE_WEB_URI`. If you provisioned a second environment with a different name or region, the web app gets a new hostname but the API's app settings still list the old hostname.

**Fix:** re-run `azd provision` for the environment where the mismatch occurred. Bicep is idempotent — it will update `API_ALLOW_ORIGINS` and the App Service CORS headers to match the current web app URL without touching data:

```bash
azd provision --no-prompt
```

Confirm the setting was updated:

```bash
az webapp config appsettings list \
  --name <api-app-name> \
  --resource-group <resource-group> \
  --query "[?name=='API_ALLOW_ORIGINS'].value" --output tsv
```

---

### `azd provision` fails mid-way — partially-provisioned resources

**Symptom:** `azd provision` exits with an error after some resources were created (e.g., Cosmos DB succeeded but App Service Plan failed). Re-running immediately fails again on the same resource.

**What not to do:** do not run `azd down` to recover — that deletes all provisioned resources including Cosmos DB data.

**Fix:** Bicep deployments are idempotent. Re-running `azd provision` after fixing the root cause (usually a quota limit, see above) is safe and will pick up where it left off:

```bash
azd provision --no-prompt
```

If provision keeps failing on a specific module, inspect the ARM deployment errors directly:

```bash
az deployment group list \
  --resource-group <resource-group> \
  --query "[].{name:name, state:properties.provisioningState}" \
  --output table
```

---

## Rollback and Recovery

This repo has no database migrations, no deployment slots (B1 tier), and no connection strings — which keeps rollback straightforward. The recovery path depends on what broke.

### Bad code deploy — app broke after `azd deploy`

The fastest recovery is to redeploy from the last known-good commit. The `prepackage` hooks rebuild both services from source, so checking out an older commit and re-deploying is sufficient:

```bash
git checkout <last-good-commit-sha>
azd deploy --no-prompt
```

Cosmos DB data is **not** affected by a code-only redeploy — there are no migration steps in this codebase. After the deploy, run the smoke tests to confirm:

```bash
cd tests
AZD_ENV=$(azd env get-values)
WEB_URL=$(echo "$AZD_ENV" | grep '^SERVICE_WEB_URI=' | cut -d'=' -f2- | tr -d '"')
API_URL=$(echo "$AZD_ENV" | grep '^SERVICE_API_URI=' | cut -d'=' -f2- | tr -d '"')
REACT_APP_WEB_BASE_URL="$WEB_URL" REACT_APP_API_BASE_URL="$API_URL" npx playwright test
```

### Broken infrastructure change — `azd provision` left things in a bad state

Fix the Bicep under `infra/` and re-run `azd provision`. Bicep is idempotent — only the delta is applied. Cosmos DB data and Key Vault secrets survive a re-provision unchanged:

```bash
azd provision --no-prompt
# then redeploy code so app settings propagate correctly
azd deploy --no-prompt
```

### Full teardown and fresh start (last resort)

Only use `azd down` if you cannot recover through re-provision. **This deletes the resource group and all Cosmos DB data:**

```bash
azd down --force --purge   # --purge also removes the soft-deleted Key Vault
azd up                     # re-provision + re-deploy from scratch
```

### No deployment slots on B1

B1 (Basic) tier does not support deployment slots, so there is no slot-swap rollback path. If zero-downtime rollback via slots is required, upgrade to Standard tier first:

```bash
azd env set APP_SERVICE_PLAN_SKU_NAME S1
azd provision
```

Then configure a staging slot in the App Service portal. Without slots, a rollback is a re-deploy — which takes ~2 minutes for `azd deploy`.

### Confirming recovery

After any recovery action, verify end-to-end health:

```bash
# Check both service URLs are present
azd env get-values | grep -E 'SERVICE_(WEB|API)_URI'

# Hit the health endpoint directly
API_URL=$(azd env get-values | grep '^SERVICE_API_URI=' | cut -d'=' -f2- | tr -d '"')
curl -s "$API_URL/health"   # expect: {"status":"ok","timestamp":"..."}

# Run the full smoke suite
cd tests && npx playwright test \
  --env REACT_APP_WEB_BASE_URL="..." \
  --env REACT_APP_API_BASE_URL="..."
```

---

## Security

A [managed identity](https://docs.microsoft.com/azure/active-directory/managed-identities-azure-resources/overview) is created for the API and used to authenticate with Cosmos DB (RBAC) and Key Vault. No connection strings are used at runtime — the API authenticates via `DefaultAzureCredential`.
