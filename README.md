# Dales Operations

A React web app with a Node.js API and Azure Cosmos DB (SQL API), deployed on GCP Cloud Run.

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
| Web frontend | GCP Cloud Run (nginx container) |
| Node.js API | GCP Cloud Run |
| Data store | Azure Cosmos DB (SQL API) |

For deployment setup and CI/CD, see:
- [`docs/gcp-cloud-run-phase1.md`](docs/gcp-cloud-run-phase1.md) — runtime setup (Artifact Registry, Cosmos key, redirect URIs)
- [`docs/gcp-deployment.md`](docs/gcp-deployment.md) — Phase 2 GCP CI/CD workflow setup
- [`.github/workflows/gcp-deploy.yml`](.github/workflows/gcp-deploy.yml) — the CI/CD workflow itself

For a concise operations reference, see **[RUNBOOK.md](RUNBOOK.md)**.

---

## Local Development

### Environment Setup

**API** — copy and fill in `src/api/.env.example`:

```bash
cp src/api/.env.example src/api/.env
# Edit src/api/.env — set AZURE_COSMOS_ENDPOINT and AZURE_COSMOS_KEY
```

**Web** — optional; defaults work out of the box:

```bash
cp src/web/.env.example src/web/.env
# Edit if you need a non-default API URL or want telemetry locally
```

### Run Locally

`start-dev.sh` installs dependencies, builds the API, and starts both services.

**Linux / macOS / WSL:**
```bash
./start-dev.sh
```

**Windows (PowerShell):**
```powershell
.\start-dev.ps1
```

Or start each service in two separate terminals:

**Bash:**
```bash
# Terminal 1 — API (http://localhost:3100)
cd src/api && npm ci && npm run build && NODE_ENV=development npm start

# Terminal 2 — Web (http://localhost:5173)
cd src/web && npm ci && npm run dev
```

Run API integration tests (no database required — uses in-memory mock):

```bash
cd src/api && npm test
```

Run web frontend unit tests:

```bash
cd src/web && npm test          # single run
cd src/web && npm run test:watch # watch mode
```

See service-level READMEs for more detail:

- [`src/api/README.md`](src/api/README.md) — API setup and endpoints
- [`src/web/README.md`](src/web/README.md) — React frontend setup
- [`tests/README.md`](tests/README.md) — Playwright smoke tests

---

## API Spec

**Source of truth**: [`src/api/openapi.yaml`](src/api/openapi.yaml). Edit this file when changing the API surface.

The root [`openapi.yaml`](openapi.yaml) is a checked-in copy kept for tooling discovery. It must always be an exact copy of the API spec:

```bash
# After editing src/api/openapi.yaml:
cp src/api/openapi.yaml openapi.yaml
git add openapi.yaml
```

CI enforces this: the "Verify OpenAPI spec sync" step diffs the two files and fails the build if they diverge.

---

## Authentication

All business API endpoints (`/employees`, `/tasks`, `/dashboard`, etc.) require an Entra ID Bearer JWT in the `Authorization: Bearer <token>` header **when auth is configured**. The `/health` endpoint is always open.

**Auth enforcement state depends on `AZURE_AD_CLIENT_ID`:**

| `AZURE_AD_CLIENT_ID` set? | Auth behaviour |
|---|---|
| Yes | `NODE_ENV=production` + Entra ID values set → all business endpoints enforce Bearer JWT |
| No (blank / default) | API runs without auth enforcement — all endpoints open |

In local development (`NODE_ENV=development` or `test`): auth is always bypassed regardless of env vars.

### Entra ID App Registration values

| Setting | Where to find it | Used by |
|---|---|---|
| `AZURE_AD_CLIENT_ID` | Azure Portal → App registrations → **API app** → Application (client) ID | API Bearer JWT validation |
| `AZURE_AD_TENANT_ID` | Azure Portal → Entra ID → Overview → Tenant ID | API JWT issuer check |
| `VITE_AZURE_CLIENT_ID` | Azure Portal → App registrations → **SPA app** → Application (client) ID | Frontend MSAL token acquisition |
| `VITE_AZURE_API_SCOPE` | Azure Portal → App registrations → **API app** → Expose an API → full scope URI | Frontend token scope request |

### Enabling production auth

1. **Create two Entra ID App Registrations** (or reuse existing ones):
   - **API app**: under "Expose an API" add scope `access_as_user`
   - **SPA app**: add the Cloud Run web URL as a redirect URI (and `http://localhost:5173` for local dev); grant delegated access to the API scope; ensure admin consent

2. **Set GitHub repository variables** before the next CI deploy:
   ```
   AZURE_AD_CLIENT_ID       (API app registration client ID)
   VITE_AZURE_CLIENT_ID     (SPA app registration client ID)
   VITE_AZURE_API_SCOPE     api://<api-client-id>/access_as_user
   AZURE_AD_TENANT_ID       (Entra ID tenant ID)
   VITE_AZURE_TENANT_ID     (same Entra ID tenant ID)
   ```

### Diagnosing 401 errors

| Symptom | Likely cause | Fix |
|---|---|---|
| Every API call returns 401 | Auth enabled on API but MSAL not sending token | Check browser console for MSAL errors; confirm `VITE_AZURE_CLIENT_ID` and `VITE_AZURE_API_SCOPE` are non-empty in the deployed bundle |
| 401 with `Token audience does not match` in API logs | `VITE_AZURE_API_SCOPE` points to wrong client ID | Ensure the scope URI uses the **API** app registration client ID, not the SPA one |
| 401 with `Unexpected issuer` in API logs | Token from wrong tenant | Confirm `AZURE_AD_TENANT_ID` matches the tenant where the SPA user signed in |
| 401 with `Token expired` in API logs | Stale token in client cache | Reload the browser tab to trigger a silent token refresh |
| `Auth: enforcement disabled — all requests allowed` in logs | `AZURE_AD_CLIENT_ID` not set or blank | Expected when auth is not yet configured |

### Verifying auth state

```bash
# Health endpoint is always open and reports the NODE_ENV
curl -s https://<api-url>/health | jq .
# → {"status":"ok","env":"production"} when auth is active
# → {"status":"ok","env":"development"} when auth is bypassed
```

---

## Troubleshooting

### API not responding

Check Cloud Run logs:

```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=<API_SERVICE_NAME>" \
  --project=<PROJECT_ID> \
  --limit=50 \
  --format=json | jq '.[].textPayload'
```

Look for `Fatal startup error`, `Cannot find module`, or `Cosmos DB connection error`.

### Web frontend loads but shows blank data

Confirm `VITE_API_BASE_URL` is correctly baked into the bundle — check the Cloud Run web service's deploy logs for the build arg value. A blank URL produces requests to `http://undefined`.

### Log landmarks

| Log message prefix | Meaning |
|---|---|
| `API initialised – env=…` | Startup completed |
| `API listening on port …` | Ready to accept traffic |
| `Cosmos DB connected successfully!` | DB connection confirmed at startup |
| `Cosmos DB connection error: …` | DB unreachable — check `AZURE_COSMOS_KEY` and endpoint |
| `Fatal startup error: …` | Process crashed before listening |
| `Auth: Azure Entra ID JWT enforcement enabled (tenant=…)` | Auth active |
| `Auth: enforcement disabled — all requests allowed…` | Auth bypassed |
| `Auth: token rejected – …` | 401 issued with reason |

---

## Security

The API validates Entra ID Bearer JWTs using Node.js built-in crypto (RS256, live JWKS from Entra ID). Cosmos DB is accessed via a primary key stored in GCP Secret Manager and injected at deploy time — no key is stored in source or environment files. Key Vault is not used in the GCP deployment.
