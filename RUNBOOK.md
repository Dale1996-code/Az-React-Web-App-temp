# Dales Operations — Production Runbook

Quick reference for deployments, triage, and recovery.
For architecture details and CI/CD docs, see [README.md](README.md).

---

## 1. Pre-Deploy Preflight

Always run before deploying.

```bash
./preflight.sh          # Linux / macOS / WSL
.\preflight.ps1         # Windows PowerShell
```

Checks Node version, API tests, API build (lint + tsc), web lint, and web build.
Exit code 0 = safe to deploy.

---

## 2. Deploy

### First deploy

Complete the one-time GCP setup in [`docs/gcp-deployment.md`](docs/gcp-deployment.md) first, then:

1. Configure GitHub Actions variables and secrets (see the doc above)
2. Go to **Actions → Deploy to Google Cloud Run → Run workflow** in GitHub
3. Watch the validation step for missing configuration before any image is built
4. After a successful run, confirm both Cloud Run URLs in the deployment summary

### Code redeploy

Push a commit to the branch and trigger the workflow manually, or re-enable the `push` trigger in `.github/workflows/gcp-deploy.yml` so merges to `main`/`master` deploy automatically.

Firestore data is **not** affected by a redeploy.

---

## 3. Environment Variables Reference

### API (set on the Cloud Run service by the workflow)

| Variable | Value / Source | Purpose |
|---|---|---|
| `NODE_ENV` | `production` | Activates production behaviour |
| `GOOGLE_CLOUD_PROJECT` | `GCP_PROJECT_ID` GitHub variable | Firestore project |
| `FIRESTORE_DATABASE_ID` | `FIRESTORE_DATABASE_ID` GitHub variable (default: `(default)`) | Firestore database ID |
| `API_ALLOW_ORIGINS` | Web Cloud Run URL (auto-updated on each deploy) | CORS allowed origin |

### API (local dev only — `src/api/.env`)

```env
GOOGLE_CLOUD_PROJECT=your-gcp-project-id   # optional; leave blank to use in-memory mock
FIRESTORE_DATABASE_ID=(default)            # optional
FIRESTORE_EMULATOR_HOST=localhost:8080     # set this to use the Firestore emulator locally
```

### Web (local dev only — `src/web/.env`)

```env
VITE_API_BASE_URL=http://localhost:3100    # must include scheme
```

Copy from the `.env.example` files in each service directory.

---

## 4. Smoke Test

```bash
# Get URLs from Cloud Run
API_URL=$(gcloud run services describe <api-service-name> \
  --region=<region> --project=<project-id> --format='value(status.url)')
WEB_URL=$(gcloud run services describe <web-service-name> \
  --region=<region> --project=<project-id> --format='value(status.url)')

# Quick health check
curl -sf "$API_URL/health" && echo "API OK" || echo "API DOWN"

# Full Playwright suite
cd tests
REACT_APP_WEB_BASE_URL="$WEB_URL" REACT_APP_API_BASE_URL="$API_URL" npx playwright test
```

Playwright tests check all 7 routes render, `/health` returns 200 with the correct shape, and the API is reachable from the browser.

---

## 5. Where to Look First

| Symptom | First check | What to look for |
|---|---|---|
| App completely down (503) | Cloud Run → service → **Logs** tab | `Fatal startup error` or `Cannot find module` |
| `/health` returns non-200 | Cloud Run logs | Firestore connection error or process crash |
| Data missing / blank pages | Browser console | CORS errors, requests to `http://undefined` |
| 5xx errors | Cloud Run logs | `[collection] METHOD /path 500 –` error detail |
| Deploy failed | GitHub Actions run | Steps 1–4 for build failures; steps 5–10 for GCP errors |

**Tail Cloud Run logs:**

```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=<api-service-name>" \
  --project=<project-id> --limit=50 --format="value(textPayload)"
```

Or open **GCP Console → Cloud Run → select service → Logs**.

---

## 6. Cloud Logging Queries

Open **GCP Console → Logging → Log Explorer** and paste these filter expressions.

### API startup errors (last 24 h)

```
resource.type="cloud_run_revision"
resource.labels.service_name="<api-service-name>"
textPayload=~"(Fatal startup error|Firestore connection error|Cannot find module)"
timestamp>="2024-01-01T00:00:00Z"
```

### Health check failures

```
resource.type="cloud_run_revision"
resource.labels.service_name="<api-service-name>"
httpRequest.requestUrl=~"/health"
httpRequest.status!=200
```

### 5xx errors

```
resource.type="cloud_run_revision"
resource.labels.service_name="<api-service-name>"
httpRequest.status>=500
```

### All errors in the last hour

```
resource.type="cloud_run_revision"
(httpRequest.status>=400 OR severity>=ERROR)
```

---

## 7. Alert Response Playbook

Alerts are not yet configured. Until they are, monitor via Cloud Run's **Logs** tab and run the smoke test after each deploy.

### API health check failing

1. `curl -s https://<api-url>/health` — check if the process is responding
2. Check Cloud Run logs for crash messages
3. Look for Firestore connection errors — confirm the runtime SA has `roles/datastore.user`
4. If the process crashed: the Cloud Run service will auto-restart; check logs for the root cause
5. If crash recurs: rollback to the last known-good image (see Rollback below)

### High 5xx error rate

1. Check Cloud Run logs — identify which route is erroring
2. Check if a recent deploy preceded the errors: `git log --oneline -5`
3. If caused by a bad deploy: rollback (see below)

---

## 8. Rollback

### Code-only rollback

Redeploy from the last known-good commit by triggering the GitHub Actions workflow on that commit/tag.

Alternatively, roll the Cloud Run service back directly using the immutable SHA-tagged image:

```bash
gcloud run services update <api-service-name> \
  --image=<region>-docker.pkg.dev/<project>/<repo>/dales-api:<last-good-sha> \
  --region=<region> --project=<project-id>

gcloud run services update <web-service-name> \
  --image=<region>-docker.pkg.dev/<project>/<repo>/dales-web:<last-good-sha> \
  --region=<region> --project=<project-id>
```

Firestore data is not affected by a rollback. After rollback, run the [smoke test](#4-smoke-test).

---

## 9. Manual GCP Console Setup — Uptime Check

Set this up once after the first successful deploy to catch DNS or region-level failures
that Cloud Run health probes miss:

1. **GCP Console → Cloud Monitoring → Uptime checks → Create uptime check**
2. Fill in:
   - **Title:** `API /health`
   - **Protocol:** HTTPS
   - **Host:** `<your-api-cloud-run-url>` (without `https://`)
   - **Path:** `/health`
   - **Check frequency:** 5 minutes
3. Under **Alert & notification**, create an alert policy with your notification channel
4. Save — the check begins immediately

Results appear under the Uptime checks blade. Failed checks include response timing for diagnosis.
