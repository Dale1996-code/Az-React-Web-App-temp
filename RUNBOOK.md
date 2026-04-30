# Dales Operations — Production Runbook

Quick reference for deployments, triage, and recovery.
For architecture details, troubleshooting context, and CI/CD docs, see [README.md](README.md).

---

## 1. Pre-Deploy Preflight

Always run before any `azd` operation.

```bash
./preflight.sh          # Linux / macOS / WSL
.\preflight.ps1         # Windows PowerShell
```

Checks Node version, API tests, API build (lint + tsc), web lint, and web build.
Exit code 0 = safe to deploy.

---

## 2. Deploy

### First deploy

```bash
azd auth login
azd up
```

Prompts for environment name, subscription, and region. Provisions all Azure resources and deploys both services. Takes 5–10 minutes.

**After `azd up` completes:**
1. `azd env get-values | grep -E 'SERVICE_(WEB|API)_URI'` — confirm both URLs are present
2. Run the [smoke test](#4-smoke-test) below
3. Wait 2–3 minutes if API calls return 403 — Cosmos DB role assignment can take that long to propagate

**Optional: enable email alerts** (B1+ only, before provisioning):
```bash
azd env set ALERT_EMAIL you@example.com
azd provision
```

### Code-only redeploy

```bash
./preflight.sh && azd deploy --no-prompt
```

Takes ~2 minutes. No infrastructure changes, no Cosmos data affected.

### Set up CI/CD (do once)

```bash
azd pipeline config               # GitHub Actions
azd pipeline config --provider azdo  # Azure DevOps
```

Subsequent pushes to `main`/`master` run the full pipeline: build → test → provision → deploy → smoke tests.

---

## 3. App Settings Reference

### Set automatically by Bicep on every `azd provision`

| Setting | Value / Source | Purpose |
|---------|----------------|---------|
| `AZURE_COSMOS_ENDPOINT` | Bicep output | Cosmos DB URI |
| `AZURE_COSMOS_DATABASE_NAME` | Bicep output (`DalesOperations`) | Database name |
| `AZURE_KEY_VAULT_ENDPOINT` | Bicep output | Key Vault URI — secrets loaded at API startup |
| `API_ALLOW_ORIGINS` | Web app URL (auto-updated on re-provision) | CORS allowed origin for the API |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Bicep output | Telemetry; silently disabled if absent |
| `ApplicationInsightsAgent_EXTENSION_VERSION` | `~3` (Linux) | App Insights auto-instrumentation agent |
| `ENABLE_ORYX_BUILD` | `true` | Required for Oryx deployment builds |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `false` | Disabled — `prepackage` hook builds before packaging |

### Set manually (environment-specific, not in Bicep)

| Setting | When required | Where to find it |
|---------|--------------|-----------------|
| `AZURE_AD_TENANT_ID` | Phase 2 auth hardening only | Azure Portal → Entra ID → Overview → Tenant ID |
| `AZURE_AD_CLIENT_ID` | Phase 2 auth hardening only | App registrations → your API app → Application (client) ID |
| `NODE_ENV=production` | Phase 2 auth hardening only | Activates JWT enforcement — set only after MSAL is wired into the frontend |

> **Warning:** Do not set `NODE_ENV=production` until MSAL is integrated in the frontend. Setting it prematurely causes 401 on every API call. See [README.md — Authentication](README.md#authentication).

---

## 4. Smoke Test

```bash
# Get URLs
API_URL=$(azd env get-values | grep '^SERVICE_API_URI=' | cut -d'=' -f2- | tr -d '"')
WEB_URL=$(azd env get-values | grep '^SERVICE_WEB_URI=' | cut -d'=' -f2- | tr -d '"')

# Quick health check
curl -sf "$API_URL/health" && echo "API OK" || echo "API DOWN"

# Full Playwright suite
cd tests
REACT_APP_WEB_BASE_URL="$WEB_URL" npx playwright test
```

**Windows PowerShell:**
```powershell
$API_URL = (azd env get-values | Select-String '^SERVICE_API_URI=').Line -replace '^SERVICE_API_URI=|"', ''
$WEB_URL = (azd env get-values | Select-String '^SERVICE_WEB_URI=').Line -replace '^SERVICE_WEB_URI=|"', ''

try { Invoke-RestMethod "$API_URL/health"; Write-Host "API OK" } catch { Write-Host "API DOWN" }
```

Playwright tests check all 7 routes render, `/health` returns 200, and the API is reachable.

---

## 5. Where to Look First

| Symptom | First check | What to look for |
|---------|------------|-----------------|
| App completely down (503/502) | Azure Portal → API App Service → **Log stream** | `Fatal startup error` or `Cannot find module` |
| `/health` returns non-200 | API Log stream | `Cosmos DB connection error` or crash message |
| Data missing / blank pages | Browser console | CORS errors, requests to `http://undefined` |
| 5xx errors | App Insights → **Failures** blade | `[collection] METHOD /path 500 –` error detail |
| Auth 401 errors | App Insights Traces → search `Auth:` | `Auth: token rejected –` with reason |
| No telemetry in App Insights | App Service → **Configuration** | Confirm `APPLICATIONINSIGHTS_CONNECTION_STRING` is set |
| Deploy failed | GitHub Actions run | "Provision Infrastructure" or "Deploy" step logs |

**Enable API log streaming** (needed for `az webapp log tail`; run once per environment):

```bash
API_APP=$(azd env get-values | grep '^SERVICE_API_NAME=' | cut -d'=' -f2- | tr -d '"')
RG=$(azd env get-values | grep '^AZURE_RESOURCE_GROUP=' | cut -d'=' -f2- | tr -d '"')

az webapp log config \
  --name "$API_APP" --resource-group "$RG" \
  --application-logging filesystem --level information

az webapp log tail --name "$API_APP" --resource-group "$RG"
```

For the full log landmarks reference (startup messages, expected vs unexpected patterns), see [README.md — Log landmarks](README.md#log-landmarks-to-search-for-in-app-insights-traces).

---

## 6. Application Insights KQL Queries

Open your App Insights resource in Azure Portal → **Logs**, then paste these queries.

### API startup errors (last 24 h)

```kql
traces
| where timestamp > ago(24h)
| where message has_any ("Fatal startup error", "Cosmos DB connection error", "Auth startup error", "Access denied")
| project timestamp, message, severityLevel
| order by timestamp desc
```

### Health check failures

```kql
requests
| where timestamp > ago(24h)
| where url endswith "/health" and resultCode != "200"
| project timestamp, url, resultCode, duration
| order by timestamp desc
```

### 5xx errors with detail

```kql
requests
| where timestamp > ago(24h)
| where toint(resultCode) >= 500
| project timestamp, url, resultCode, duration, operation_Id
| order by timestamp desc
```

### Auth / 401 troubleshooting

```kql
traces
| where timestamp > ago(24h)
| where message has_any ("Auth:", "token rejected", "enforcement disabled", "401")
| project timestamp, message, severityLevel
| order by timestamp desc
```

### All errors in the last hour (quick overview)

```kql
union requests, traces, exceptions
| where timestamp > ago(1h)
| where severityLevel >= 2 or toint(resultCode) >= 400
| project timestamp, itemType, message, resultCode, operation_Id
| order by timestamp desc
```

---

## 7. Alert Response Playbook

Alerts appear in Azure Portal → Monitor → Alerts. If `ALERT_EMAIL` was set before provisioning, you also receive email.

Two metric alerts are provisioned automatically when `appServicePlanSkuName` is B1 or above:

| Alert name | Severity | Condition |
|------------|----------|-----------|
| `alert-api-health` | 1 — Critical | `HealthCheckStatus < 100` for 5 minutes |
| `alert-api-5xx` | 2 — Error | `Http5xx > 5` in any 5-minute window |

### `alert-api-health` fires — health check failing

1. `curl -s https://<api-url>/health` — check if the process is responding
2. `az webapp log tail --name <api-app-name> --resource-group <rg>` — look for crash messages
3. Check the "API startup errors" KQL query above for the root cause
4. If the process crashed: `az webapp restart --name <api-app-name> --resource-group <rg>`
5. If Cosmos 403 errors appear: wait 2–3 minutes for RBAC propagation, then restart
6. If crash recurs after restart: redeploy from last known-good commit (see Rollback below)

### `alert-api-5xx` fires — high error rate

1. Open App Insights → **Failures** — identify which route is erroring
2. Run the "5xx errors with detail" KQL query above
3. Check if a recent deploy preceded the alert: `git log --oneline -5`
4. If caused by a bad deploy: rollback (see below)
5. If Cosmos-related: run "API startup errors" KQL query to check connectivity

---

## 8. Rollback

```bash
# Redeploy from last known-good commit
git checkout <last-good-commit-sha>
azd deploy --no-prompt
```

Cosmos data is not affected by a code-only redeploy. After rollback, run the [smoke test](#4-smoke-test) above.

For infrastructure rollback, partial provision recovery, and full teardown (`azd down`), see [README.md — Rollback and Recovery](README.md#rollback-and-recovery).

---

## 9. Manual Azure Portal Setup — Availability Test

The Bicep alerting baseline covers App Service metric signals (5xx rate, health check status). An HTTP availability test complements this by probing the API from outside Azure — useful for detecting DNS failures, certificate expiry, and region-level outages that metric alerts miss.

Set this up once after the first successful `azd up`:

1. Azure Portal → **Application Insights** → your App Insights instance
2. Left sidebar → **Availability** → **Add Standard test**
3. Fill in:
   - **Test name:** `API /health availability`
   - **URL:** `https://<your-api-url>/health`
     (get it with: `azd env get-values | grep SERVICE_API_URI`)
   - **Test frequency:** 5 minutes
   - **Test locations:** select 3–5 regions
   - **HTTP status:** must equal 200
   - **SSL check:** enabled; certificate lifetime threshold: 14 days
4. Under **Alerts**, enable the alert, set threshold to **2 out of N locations failing** (reduces false positives from single-region blips)
5. Save — the test begins immediately

Results appear under the Availability blade. Failed tests include response content and timing for diagnosis.

---

## Required Environment Variables (local dev only)

In Azure, all variables are injected automatically by Bicep and the `azd` prepackage hook. These are only needed for local development.

**API** (`src/api/.env`):
```env
AZURE_COSMOS_ENDPOINT=https://<account>.documents.azure.com:443/
AZURE_COSMOS_DATABASE_NAME=DalesOperations          # optional; this is the default
APPLICATIONINSIGHTS_CONNECTION_STRING=              # optional; telemetry disabled if blank
```

**Web** (`src/web/.env`):
```env
VITE_API_BASE_URL=http://localhost:3100             # must include scheme
VITE_APPLICATIONINSIGHTS_CONNECTION_STRING=         # optional
```

Copy from the `.env.example` files in each service directory. See [README.md — Local Development](README.md#local-development) for the full setup.
