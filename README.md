# Dales Operations

A React web app with a Node.js API and Cloud Firestore database deployed on Google Cloud Run.

## Application Overview

Dales Operations is a store operations management tool covering:

- **Employees** — staff roster and role tracking
- **Tasks** — operational task assignment and status
- **Productivity** — per-shift freight and zone records
- **Coaching** — employee coaching logs and follow-ups
- **Issues** — operational issue tracking (open/resolved)
- **Daily Summary** — end-of-day shift summaries

## Architecture

| Component | Service |
|---|---|
| Web frontend | Google Cloud Run (nginx + React SPA) |
| Node.js API | Google Cloud Run (Docker, Express) |
| Data store | Google Cloud Firestore (native mode) |
| Container registry | Google Artifact Registry |
| CI/CD | GitHub Actions (`.github/workflows/gcp-deploy.yml`) |

The API authenticates to Firestore using the Cloud Run runtime service account via Application Default Credentials — no connection strings or key files.

### Prerequisites

- [Node.js 22 LTS with npm](https://nodejs.org/) — `node --version` must start with `v22`
- [gcloud CLI](https://cloud.google.com/sdk/docs/install) — for local triage commands
- [Docker](https://docs.docker.com/get-docker/) — for local container testing

## Operations

For a concise operations reference (triage checklist, environment variables, rollback steps, log commands), see **[RUNBOOK.md](RUNBOOK.md)**.

## Preflight check

Run this before deploying to verify the repo is in a deployable state. It mirrors
the build and test steps that run in CI, so failures are caught locally instead of mid-deploy.

**Linux / macOS / WSL:**
```bash
./preflight.sh
```

**Windows (PowerShell — no WSL required):**
```powershell
.\preflight.ps1
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

## First Deployment Checklist

Before the first deploy, complete the one-time GCP setup described in [`docs/gcp-deployment.md`](docs/gcp-deployment.md):

**GCP infrastructure (one-time, done by a human with Owner access)**
- [ ] Create Artifact Registry repository
- [ ] Create Firestore database in native mode
- [ ] Create `github-deployer` service account with `run.admin`, `artifactregistry.writer`, `iam.serviceAccountUser` roles
- [ ] Grant the Cloud Run runtime service account `roles/datastore.user`
- [ ] Set up Workload Identity Federation pool and provider for GitHub Actions

**GitHub configuration**
- [ ] Add required GitHub Actions variables: `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_ARTIFACT_REPO`, `GCP_API_SERVICE_NAME`, `GCP_WEB_SERVICE_NAME`
- [ ] Add required GitHub Actions secrets: `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`

**Deploy**
1. Run preflight: `./preflight.sh`
2. Go to **Actions → Deploy to Google Cloud Run → Run workflow** in GitHub
3. After a successful run, confirm both Cloud Run URLs in the deployment summary
4. Open the web URL and check the dashboard loads

See [`docs/gcp-deployment.md`](docs/gcp-deployment.md) for step-by-step GCP setup instructions.

---

## Developer Commands

| Command | Purpose |
|---|---|
| `./preflight.sh` | Local build + test gate before deploying |
| `./start-dev.sh` | Start API (`:3100`) and web (`:5173`) for local dev |
| `gcloud run services describe <name> --region <region>` | Show deployed service URL and config |
| `gcloud logging read "resource.type=cloud_run_revision..."` | Tail Cloud Run logs |

## Build flow

Both services are built as Docker images by the GitHub Actions workflow (`.github/workflows/gcp-deploy.yml`).

**API** (`src/api/`) — built and pushed to Artifact Registry:
1. `docker build ./src/api` — compiles TypeScript and installs production deps
2. Pushed with the commit SHA tag and `latest`
3. Deployed to Cloud Run with `NODE_ENV=production` and `GOOGLE_CLOUD_PROJECT`

**Web** (`src/web/`) — static SPA built into an nginx image:
1. Workflow reads the API Cloud Run URL after the API deploy
2. `docker build --build-arg VITE_API_BASE_URL=<api-url> ./src/web` — Vite bakes the URL into the bundle at build time
3. Pushed and deployed to Cloud Run

`VITE_*` variables are baked into the JavaScript bundle at image build time — nginx serves them as static files.

## CI/CD

The workflow at `.github/workflows/gcp-deploy.yml` runs the full quality gate and deploy:

1. OpenAPI spec sync check (`src/api/openapi.yaml` vs root `openapi.yaml`)
2. API unit/integration tests (`npm test` with in-memory Firestore mock)
3. API build (`tsc`)
4. Web build (`vite build`)
5. Authenticate to GCP via Workload Identity Federation
6. Build and push API Docker image to Artifact Registry
7. Deploy API to Cloud Run
8. Build and push web Docker image (with `VITE_API_BASE_URL` baked in)
9. Deploy web to Cloud Run
10. Update API `API_ALLOW_ORIGINS` env var to allow the web origin
11. Playwright smoke tests against the deployed URLs

The workflow is **manual-only** (`workflow_dispatch`) until the first successful deploy.
Re-enable the `push` trigger afterwards so merges to `main`/`master` deploy automatically.

---

## Local Development

### Environment Setup

The frontend has sensible defaults for local dev, so no env file is required to start the UI.
The API will serve data from an in-memory store when `NODE_ENV` is not `production` and no
Firestore project is configured.

**API** — copy and optionally fill in `src/api/.env.example`:

```bash
cp src/api/.env.example src/api/.env
# Edit if you want to connect to a real Firestore instance locally
# Leave blank to use the in-memory mock (sufficient for most local dev)
```

**Web** — optional; defaults work out of the box:

```bash
cp src/web/.env.example src/web/.env
# Edit if you need a non-default API URL
```

### Run Locally

`start-dev.sh` and `start-dev.ps1` both install dependencies, build the API, and start both services.

**Linux / macOS / WSL:**
```bash
./start-dev.sh
```

**Windows (PowerShell — no WSL required):**
```powershell
.\start-dev.ps1
```

Or start each service individually in two separate terminals:

**Bash:**
```bash
# Terminal 1 — API (http://localhost:3100)
cd src/api && npm ci && npm run build && NODE_ENV=development npm start

# Terminal 2 — Web (http://localhost:5173)
cd src/web && npm ci && npm run dev
```

**PowerShell:**
```powershell
# Terminal 1 — API (http://localhost:3100)
Push-Location src\api; npm ci; npm run build; $env:NODE_ENV="development"; node .

# Terminal 2 — Web (http://localhost:5173)
Push-Location src\web; npm ci; npm run dev
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

**Source of truth**: [`src/api/openapi.yaml`](src/api/openapi.yaml). Edit this file when changing the API surface.

The root [`openapi.yaml`](openapi.yaml) is a checked-in copy kept for tooling discovery (IDE plugins, API explorers). It must always be an exact copy of the API spec:

```bash
# After editing src/api/openapi.yaml:
cp src/api/openapi.yaml openapi.yaml
git add openapi.yaml
```

CI enforces this: the "Verify OpenAPI spec sync" step diffs the two files and fails the build if they diverge.

## Authentication

End-user authentication is **currently disabled**. All API endpoints are open — no Bearer token is required. The frontend contains MSAL code that stays inert when the `VITE_AZURE_*` environment variables are blank (which they are by default).

The `/health` endpoint has always been open and is used by Cloud Run health probes.

Adding an identity provider (e.g. Firebase Auth or Google Identity) is a future task.

---

## Troubleshooting

### Where to look first after a failed deploy or live incident

| Symptom | Where to look | What to check |
|---|---|---|
| **API not responding / 503** | Cloud Run → service → **Logs** tab | Container startup errors; `Fatal startup error` or `Cannot find module` |
| **Firestore connection failure** | Cloud Logging | `Firestore` error messages at startup; confirm runtime SA has `roles/datastore.user` |
| **API errors in production** | Cloud Run → **Logs** | `[collection] METHOD /path 500 –` prefix + error message |
| **Health probe down** | `GET https://<api-url>/health` | Returns `{"status":"ok","timestamp":"..."}` when healthy; non-200 = process issue |
| **Frontend errors** | Browser DevTools console | Failed AJAX calls, CORS errors, requests to `http://undefined` |
| **Deployment failed** | GitHub Actions run | Steps 1–4 for build failures, steps 5–10 for GCP errors |
| **Data missing / blank pages** | Browser console | CORS errors; confirm `VITE_API_BASE_URL` in the deployed web image is correct |

#### Viewing Cloud Run logs

```bash
# Stream API logs live
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=<api-service-name>" \
  --project=<project-id> --limit=50 --format="value(textPayload)"

# Stream web logs
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=<web-service-name>" \
  --project=<project-id> --limit=20 --format="value(textPayload)"
```

Or use the GCP Console: **Cloud Run → select service → Logs tab**.

#### Log landmarks to search for

| Log message prefix | Meaning |
|---|---|
| `API initialised – env=…` | Startup completed |
| `API listening on port …` | Process is bound and ready to accept traffic |
| `Firestore connected successfully!` | DB connection confirmed at startup |
| `Firestore connection error: …` | DB unreachable — check runtime SA IAM binding |
| `Fatal startup error: …` | Process crashed before listening; see full message |
| `[employees] GET /employees 500 – …` | 5xx from a CRUD route |
| `[dashboard] GET /dashboard?date=… 500 – …` | Dashboard aggregation failure |

---

### API returns 503 or `/health` fails after deployment

**Symptom:** `GET /health` returns 503; GitHub Actions smoke tests fail on API checks.

**Cause:** the container failed to start. Common reasons: TypeScript compile error left `dist/` empty, or a missing npm module.

**Fix:** check the Cloud Run logs for `Cannot find module` or a TypeScript error. Re-run the workflow after fixing the root cause.

---

### Web frontend loads but shows API errors or blank data

**Symptom:** routes render but data never loads; browser console shows CORS errors or requests to `http://undefined`.

**Cause:** `VITE_API_BASE_URL` was blank or wrong when the web Docker image was built.

**Fix:** check the image build step in the GitHub Actions workflow log. The API URL is read automatically from `gcloud run services describe` — if that step fails, the web image gets a blank URL.

---

### CORS errors after re-deploy

**Symptom:** the frontend loads and makes requests, but the browser console shows `Access-Control-Allow-Origin` errors.

**Cause:** `API_ALLOW_ORIGINS` on the API service does not include the web service URL. This can happen if the web service URL changed.

**Fix:** the workflow's final step updates `API_ALLOW_ORIGINS` automatically. Re-run the full workflow so the env var is refreshed with the current web URL.

---

## Rollback and Recovery

### Bad code deploy — app broke after deploy

Redeploy from the last known-good commit by re-running the GitHub Actions workflow on that commit. Firestore data is **not** affected by a code-only redeploy.

```bash
# Tag or note the last-good commit SHA, then trigger the workflow on that ref
# GitHub Actions → Deploy to Google Cloud Run → Run workflow → select branch/tag
```

Alternatively, use the immutable SHA-tagged image to roll the Cloud Run service back directly:

```bash
gcloud run services update <api-service-name> \
  --image=<region>-docker.pkg.dev/<project>/<repo>/dales-api:<last-good-sha> \
  --region=<region> --project=<project>
```

### Confirming recovery

After any recovery action, verify end-to-end health:

```bash
# Get the API URL
API_URL=$(gcloud run services describe <api-service-name> \
  --region=<region> --project=<project-id> \
  --format='value(status.url)')

# Check health endpoint
curl -s "$API_URL/health"   # expect: {"status":"ok","timestamp":"..."}
```

Then run the full smoke suite (see [tests/README.md](tests/README.md) for instructions).

---

## Security

The API accesses Firestore as the Cloud Run runtime service account via Application Default Credentials. No connection strings, API keys, or key files are used at runtime.

GitHub Actions authenticates to GCP via Workload Identity Federation — no service account key files are downloaded or stored.

> **No end-user auth.** Both Cloud Run services use `--allow-unauthenticated` and the API
> performs no token validation. Anyone with the URL can read and write data. Adding an identity
> provider is the most important follow-up before this handles real data.
