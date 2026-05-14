# GCP Cloud Run — Phase 1 Migration Guide

This document covers the **Phase 1** deployment of Dales Operations on Google
Cloud Platform. The goal is to get both services running on Cloud Run with
the **lowest possible blast radius**, keeping all existing behaviour intact.

---

## What Phase 1 does and does not change

| Area | Phase 1 decision | Why |
|---|---|---|
| **Frontend host** | Cloud Run (existing nginx Dockerfile) | Already containerised |
| **API host** | Cloud Run (existing Node Dockerfile) | Already containerised |
| **Database** | Stays on Azure Cosmos DB (SQL API) | No code rewrite needed |
| **Cosmos auth** | Account key via `AZURE_COSMOS_KEY` | `DefaultAzureCredential` only works on Azure |
| **Auth / identity** | Entra ID / MSAL unchanged | Works from any host over public HTTPS |
| **Secrets** | Cloud Run environment variables (Secret Manager optional) | Simple for Phase 1 |
| **Logging** | stdout/stderr → Cloud Logging automatically | No code change needed |
| **Monitoring** | App Insights disabled (env var left blank) | Opt-in; Cloud Logging is sufficient for now |
| **Key Vault** | Disabled (env var left blank) | Already gated — safe to omit |
| **Bicep / azd files** | Removed | Azure infrastructure has been decommissioned |

---

## One-time manual steps

### 1. Update Entra ID SPA redirect URIs

If MSAL authentication is enabled (all three `VITE_AZURE_*` vars are set):

Azure Portal → Entra ID → App registrations → `<your SPA app>` → Authentication
→ add a new Redirect URI:
```
https://<WEB_SERVICE_NAME>-<HASH>-<REGION>.a.run.app
```
Also add your custom domain here if you configure one later.

### 2. Store the Cosmos key in Secret Manager (recommended)

```bash
# Create the secret
gcloud secrets create cosmos-db-key \
  --project=PROJECT_ID \
  --replication-policy=automatic

# Add the key value
echo -n "YOUR_COSMOS_PRIMARY_KEY" | gcloud secrets versions add cosmos-db-key \
  --project=PROJECT_ID \
  --data-file=-
```

Grant the Cloud Run service account access:
```bash
gcloud secrets add-iam-policy-binding cosmos-db-key \
  --project=PROJECT_ID \
  --member="serviceAccount:<SERVICE_ACCOUNT_EMAIL>" \
  --role="roles/secretmanager.secretAccessor"
```

Then reference it in your `gcloud run deploy` command with
`--set-secrets=AZURE_COSMOS_KEY=cosmos-db-key:latest`.

> **Note:** Cosmos DB account-key auth must be enabled on the Cosmos account
> (Azure Portal → Cosmos DB account → Settings → Keys → "Disable local authentication" must be **off**).
> Copy the Primary Key from the Keys blade and store it in Secret Manager as shown above.

---

## GCP resources to create

| Resource | Name (placeholder) | Notes |
|---|---|---|
| GCP project | `PROJECT_ID` | Already exists, or create one |
| Artifact Registry repo | `ARTIFACT_REPO` | Format: `REGION-docker.pkg.dev/PROJECT_ID/ARTIFACT_REPO` |
| Cloud Run service — API | `API_SERVICE_NAME` | e.g. `dales-api` |
| Cloud Run service — Web | `WEB_SERVICE_NAME` | e.g. `dales-web` |
| Secret Manager secret | `cosmos-db-key` | Stores the Cosmos DB primary key |

Create the Artifact Registry repo:
```bash
gcloud artifacts repositories create ARTIFACT_REPO \
  --project=PROJECT_ID \
  --repository-format=docker \
  --location=REGION \
  --description="Dales Operations container images"
```

---

## Environment variables

### API Cloud Run service

| Variable | Value | Notes |
|---|---|---|
| `PORT` | `8080` | Injected automatically by Cloud Run — do not set manually |
| `NODE_ENV` | `production` | Enables JWT auth enforcement |
| `AZURE_COSMOS_ENDPOINT` | `https://<account>.documents.azure.com:443/` | From Azure Portal > Cosmos DB > Overview > URI |
| `AZURE_COSMOS_DATABASE_NAME` | `DalesOperations` | Default — change if you chose a different name |
| `AZURE_COSMOS_KEY` | *(from Secret Manager)* | Cosmos DB primary key. Use `--set-secrets` (see below) |
| `API_ALLOW_ORIGINS` | `https://WEB_SERVICE_URL` | Full URL of the web Cloud Run service; comma-separate multiple origins |
| `AZURE_AD_TENANT_ID` | `<entra-tenant-id>` | Required when `NODE_ENV=production` and auth is enabled |
| `AZURE_AD_CLIENT_ID` | `<api-app-registration-client-id>` | Required when `NODE_ENV=production` and auth is enabled |
| `AZURE_KEY_VAULT_ENDPOINT` | *(leave unset)* | Omit entirely — Key Vault is not used in Phase 1 |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | *(leave unset)* | Omit — App Insights disabled in Phase 1; logs go to Cloud Logging |

> **Auth note:** If you want to run Phase 1 without auth enforcement (e.g. for
> initial smoke testing), set `NODE_ENV=development` temporarily. The JWT
> middleware is bypassed automatically when `NODE_ENV !== "production"`.
> Switch to `production` once the Entra ID redirect URIs are updated.

### Web Cloud Run service

The web container is a static nginx image. There are **no runtime env vars** —
all `VITE_*` values are baked into the JavaScript bundle at `docker build` time
via `--build-arg` flags.

| Build arg | Value | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | `https://API_SERVICE_URL` | Full URL of the API Cloud Run service |
| `VITE_AZURE_CLIENT_ID` | `<spa-app-registration-client-id>` | Leave blank to disable MSAL |
| `VITE_AZURE_TENANT_ID` | `<entra-tenant-id>` | Leave blank to disable MSAL |
| `VITE_AZURE_API_SCOPE` | `api://<api-client-id>/access_as_user` | Leave blank to disable MSAL |
| `VITE_APPLICATIONINSIGHTS_CONNECTION_STRING` | *(leave blank)* | Omit — App Insights disabled in Phase 1 |

---

## Local Docker test commands

Test the API container locally before pushing to Artifact Registry:

```bash
# Build
docker build -t dales-api:local ./src/api

# Run (replace placeholder values)
docker run --rm -p 3100:8080 \
  -e PORT=8080 \
  -e NODE_ENV=development \
  -e AZURE_COSMOS_ENDPOINT=https://YOUR_ACCOUNT.documents.azure.com:443/ \
  -e AZURE_COSMOS_DATABASE_NAME=DalesOperations \
  -e AZURE_COSMOS_KEY=YOUR_COSMOS_KEY \
  dales-api:local

# Smoke test
curl http://localhost:3100/health
```

Test the web container locally:

```bash
# Build (with placeholder API URL for local testing)
docker build \
  --build-arg VITE_API_BASE_URL=http://localhost:3100 \
  -t dales-web:local ./src/web

# Run (nginx listens on port 80)
docker run --rm -p 8080:80 dales-web:local

# Open in browser
open http://localhost:8080
```

---

## Build and deploy to Cloud Run

Set these shell variables once before running the commands below:

```bash
export PROJECT_ID=your-gcp-project-id
export REGION=us-central1
export ARTIFACT_REPO=dales-ops
export API_SERVICE_NAME=dales-api
export WEB_SERVICE_NAME=dales-web
export API_IMAGE=REGION-docker.pkg.dev/PROJECT_ID/ARTIFACT_REPO/api:latest
export WEB_IMAGE=REGION-docker.pkg.dev/PROJECT_ID/ARTIFACT_REPO/web:latest

# Get Cosmos endpoint + Entra IDs from Azure Portal / your environment config
export COSMOS_ENDPOINT=https://YOUR_ACCOUNT.documents.azure.com:443/
export ENTRA_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
export ENTRA_API_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
export ENTRA_SPA_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
export API_SCOPE=api://ENTRA_API_CLIENT_ID/access_as_user
```

### Step 1 — Authenticate and configure Docker

```bash
gcloud auth login
gcloud config set project $PROJECT_ID
gcloud auth configure-docker ${REGION}-docker.pkg.dev
```

### Step 2 — Build and push the API image

```bash
docker build -t $API_IMAGE ./src/api
docker push $API_IMAGE
```

### Step 3 — Deploy the API service

```bash
gcloud run deploy $API_SERVICE_NAME \
  --project=$PROJECT_ID \
  --region=$REGION \
  --image=$API_IMAGE \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="AZURE_COSMOS_ENDPOINT=${COSMOS_ENDPOINT}" \
  --set-env-vars="AZURE_COSMOS_DATABASE_NAME=DalesOperations" \
  --set-env-vars="AZURE_AD_TENANT_ID=${ENTRA_TENANT_ID}" \
  --set-env-vars="AZURE_AD_CLIENT_ID=${ENTRA_API_CLIENT_ID}" \
  --set-secrets="AZURE_COSMOS_KEY=cosmos-db-key:latest"
  # API_ALLOW_ORIGINS is set in Step 5 after the web URL is known
```

Note the API service URL printed after deploy (e.g. `https://dales-api-xxxxx-uc.a.run.app`).

### Step 4 — Build and push the web image

```bash
export API_SERVICE_URL=https://dales-api-xxxxx-uc.a.run.app  # from Step 3

docker build \
  --build-arg VITE_API_BASE_URL=${API_SERVICE_URL} \
  --build-arg VITE_AZURE_CLIENT_ID=${ENTRA_SPA_CLIENT_ID} \
  --build-arg VITE_AZURE_TENANT_ID=${ENTRA_TENANT_ID} \
  --build-arg VITE_AZURE_API_SCOPE=${API_SCOPE} \
  -t $WEB_IMAGE ./src/web

docker push $WEB_IMAGE
```

### Step 5 — Deploy the web service

```bash
gcloud run deploy $WEB_SERVICE_NAME \
  --project=$PROJECT_ID \
  --region=$REGION \
  --image=$WEB_IMAGE \
  --platform=managed \
  --allow-unauthenticated \
  --port=80
```

Note the web service URL. Then update the API's CORS allowlist:

```bash
export WEB_SERVICE_URL=https://dales-web-xxxxx-uc.a.run.app  # from this step

gcloud run services update $API_SERVICE_NAME \
  --project=$PROJECT_ID \
  --region=$REGION \
  --update-env-vars="API_ALLOW_ORIGINS=${WEB_SERVICE_URL}"
```

---

## Smoke tests after deployment

```bash
# 1. API health check (always unauthenticated)
curl -s https://API_SERVICE_URL/health | jq .

# 2. Web app loads
open https://WEB_SERVICE_URL

# 3. Verify CORS — the web page must be able to reach the API.
#    In the browser DevTools Console (opened on the web URL), run:
#    fetch('https://API_SERVICE_URL/health').then(r=>r.json()).then(console.log)
#    → should print { status: 'ok', ... } with no CORS error.

# 4. Auth redirect — if MSAL is enabled, navigating to any page other than
#    the login flow should redirect to login.microsoftonline.com.
#    After sign-in, the app should return to the Cloud Run web URL.

# 5. API dashboard (authenticated)
#    curl -H "Authorization: Bearer <token>" https://API_SERVICE_URL/dashboard
```

---

## Key Vault — why it is disabled in Phase 1

The API's `populateEnvironmentFromKeyVault()` function already has a safe guard:

```typescript
if (!keyVaultEndpoint) {
    logger.warn("AZURE_KEY_VAULT_ENDPOINT has not been set...");
    return;  // exits cleanly
}
```

As long as `AZURE_KEY_VAULT_ENDPOINT` is **not set** in the Cloud Run service
configuration, the Key Vault code path never executes and startup proceeds
normally. Do not set this variable in Cloud Run.

---

## Logging in Cloud Run

stdout and stderr from both containers are automatically captured by Cloud
Logging — no code changes needed. Application Insights is disabled by leaving
`APPLICATIONINSIGHTS_CONNECTION_STRING` and
`VITE_APPLICATIONINSIGHTS_CONNECTION_STRING` unset.

To view API logs:
```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=${API_SERVICE_NAME}" \
  --project=$PROJECT_ID \
  --limit=50 \
  --format=json | jq '.[].textPayload'
```

Or use the Cloud Console: Logging → Logs Explorer → filter by Cloud Run service.

---

## What to do next (Phase 2)

Phase 2 replaces the CI/CD pipeline with a GCP-native build:
- Add `.github/workflows/gcp-cloud-run.yml` using `google-github-actions/auth@v2`
  (Workload Identity Federation — no service account key files).
- Build images in CI, push to Artifact Registry, deploy via `gcloud run deploy`.
- Re-point Playwright smoke tests at the Cloud Run URLs.

Phase 3 (optional): replace App Insights with Cloud Monitoring; remove the
`applicationinsights` npm package.

Phase 4 (separate project): migrate Cosmos DB to Firestore or MongoDB Atlas.
The `FilterCondition` / `BaseRepository` abstraction in `src/api/src/models/`
already has the right shape for this — only `buildSelectSql` and
`cosmosClient.ts` need to change.
