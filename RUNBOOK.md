# Dales Operations — Production Runbook

Quick reference for deployments, triage, and recovery.
For architecture details and CI/CD docs, see [README.md](README.md).
For GCP deployment setup, see [docs/gcp-deployment.md](docs/gcp-deployment.md).

---

## 1. Pre-Deploy Checks

Before any production deploy, verify the repo is in a deployable state:

```bash
# Install and test API (no DB required — uses in-memory mock)
cd src/api && npm ci && npm test && npm run build

# Lint and build web
cd src/web && npm ci && npm run lint && npm run build
```

These same steps run automatically in CI before any deploy.

---

## 2. Deploy

Deployments are driven by the GitHub Actions workflow at `.github/workflows/gcp-deploy.yml`.
Push to `main`/`master` to trigger the full pipeline: build → test → deploy → smoke tests.

For manual deployment or initial setup, see [docs/gcp-cloud-run-phase1.md](docs/gcp-cloud-run-phase1.md).

---

## 3. Environment Variables Reference

### API Cloud Run service (set as service env vars or Secret Manager secrets)

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `production` enables JWT auth enforcement |
| `AZURE_COSMOS_ENDPOINT` | Cosmos DB URI |
| `AZURE_COSMOS_DATABASE_NAME` | Database name (`DalesOperations`) |
| `AZURE_COSMOS_KEY` | Cosmos DB primary key — store in Secret Manager |
| `API_ALLOW_ORIGINS` | CORS allowed origin(s) for the web service URL |
| `AZURE_AD_TENANT_ID` | Required when auth is enabled |
| `AZURE_AD_CLIENT_ID` | Required when auth is enabled — activates JWT enforcement |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Optional; telemetry disabled if absent |
| `AZURE_KEY_VAULT_ENDPOINT` | Do not set in Cloud Run — Key Vault is not used |

### Web Cloud Run service (baked into the bundle as Docker build args)

| Build arg | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Full URL of the API Cloud Run service |
| `VITE_AZURE_CLIENT_ID` | SPA app registration client ID (leave blank to disable MSAL) |
| `VITE_AZURE_TENANT_ID` | Entra ID tenant ID |
| `VITE_AZURE_API_SCOPE` | e.g. `api://<api-client-id>/access_as_user` |
| `VITE_APPLICATIONINSIGHTS_CONNECTION_STRING` | Optional; telemetry disabled if absent |

### Local development only (`src/api/.env`)

```env
AZURE_COSMOS_ENDPOINT=https://<account>.documents.azure.com:443/
AZURE_COSMOS_DATABASE_NAME=DalesOperations          # optional; this is the default
AZURE_COSMOS_KEY=<your-cosmos-primary-key>
APPLICATIONINSIGHTS_CONNECTION_STRING=              # optional; telemetry disabled if blank
```

Copy from `src/api/.env.example`. See [README.md — Local Development](README.md#local-development).

---

## 4. Smoke Test

```bash
# Quick health check
curl -sf "https://<API_SERVICE_URL>/health" && echo "API OK" || echo "API DOWN"

# Full Playwright suite (set REACT_APP_WEB_BASE_URL to point at the deployed app)
cd tests
REACT_APP_WEB_BASE_URL="https://<WEB_SERVICE_URL>" npx playwright test
```

Playwright tests check all 7 routes render, `/health` returns 200, and the API is reachable.

---

## 5. Where to Look First

| Symptom | First check | What to look for |
|---------|------------|-----------------|
| App completely down (502/503) | Cloud Run → **Logs Explorer** | `Fatal startup error` or `Cannot find module` |
| `/health` returns non-200 | Cloud Run logs | `Cosmos DB connection error` or crash message |
| Data missing / blank pages | Browser console | CORS errors, requests to `http://undefined` |
| Auth 401 errors | Cloud Run logs → search `Auth:` | `Auth: token rejected –` with reason |
| Deploy failed | GitHub Actions run | Build, push, or deploy step logs |

**View API logs:**
```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=<API_SERVICE_NAME>" \
  --project=<PROJECT_ID> \
  --limit=50 \
  --format=json | jq '.[].textPayload'
```

Or use Cloud Console: **Logging → Logs Explorer** → filter by Cloud Run service.

For the full log landmarks reference (startup messages, expected vs unexpected patterns), see [README.md — Log landmarks](README.md#log-landmarks).

---

## 6. Rollback

```bash
# Redeploy from last known-good commit
git checkout <last-good-commit-sha>
git push origin HEAD:main  # triggers CI deploy
```

Alternatively, use the Cloud Run console to roll back to a previous revision directly
(**Cloud Run → service → Revisions → select revision → Send traffic here**).

Cosmos DB data is not affected by a code-only redeploy.

---

## 7. Cosmos Key Rotation

The Cosmos primary key is stored in GCP Secret Manager as `cosmos-db-key`. To rotate:

1. Add a new secret version in Secret Manager with the new key value
2. The Cloud Run service picks it up on the next deploy (the workflow uses `:latest`)
3. Or restart the running revision: `gcloud run services update <API_SERVICE_NAME> --region=<REGION>`
