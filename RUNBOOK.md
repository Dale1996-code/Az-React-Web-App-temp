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

For first-time GCP setup (Artifact Registry, Workload Identity Federation, IAM, GitHub secrets), see [docs/gcp-deployment.md](docs/gcp-deployment.md).

---

## 3. Environment Variables Reference

### API Cloud Run service (set as service env vars)

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `production` enables JWT auth enforcement |
| `GOOGLE_CLOUD_PROJECT` | GCP project that owns the Firestore database |
| `FIRESTORE_DATABASE_ID` | Firestore database id; defaults to `(default)` |
| `API_ALLOW_ORIGINS` | CORS allowed origin(s) for the web service URL |
| `AZURE_AD_TENANT_ID` | Required when auth is enabled |
| `AZURE_AD_CLIENT_ID` | Required when auth is enabled — activates JWT enforcement |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Optional; telemetry disabled if absent |
| `REDIS_URL` | Optional; enables the dashboard Redis cache |

Firestore authenticates via Application Default Credentials — no database key, secret, or env var is needed. The Cloud Run runtime SA must have `roles/datastore.user`.

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
# All values are optional — the API falls back to your active `gcloud` config.
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
FIRESTORE_DATABASE_ID=(default)                     # only if using a named Firestore DB
FIRESTORE_EMULATOR_HOST=localhost:8080              # use the local emulator instead
APPLICATIONINSIGHTS_CONNECTION_STRING=              # optional; telemetry disabled if blank
```

Copy from `src/api/.env.example`. Run `gcloud auth application-default login` once to talk to a real Firestore database. See [README.md — Local Development](README.md#local-development).

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
| `/health` returns non-200 | Cloud Run logs | Firestore initialisation error or crash message |
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

Firestore data is not affected by a code-only redeploy.
