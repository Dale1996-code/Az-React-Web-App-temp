# Dales Operations — Smoke Tests

[Playwright](https://playwright.dev/) smoke tests that verify both the web frontend routes and the deployed API.

## What's Tested

### Route-shell checks (always run)

These pass whether or not the backend is reachable — they prove the SPA shell and routing are intact:

- App shell loads with all 7 navigation links
- Each MVP route renders its heading and reaches a stable state (loading / empty / list):
  Dashboard, Employees, Tasks, Productivity, Coaching, Issues, Daily Summary
- Unknown routes redirect to the dashboard
- Navigation between all routes via sidebar links

### API connectivity checks

These fail the build if the API is broken, even when the frontend looks fine:

| Test | What it verifies |
|---|---|
| `GET /health` returns 200 | API process is running and healthy |
| `GET /health` body shape | Response contains `{ status: "ok", timestamp: "<ISO>" }` |

`/health` is intentionally unauthenticated in all deployment modes.

### Frontend ↔ API integration (browser-side)

Proves the frontend is not just rendering chrome while the API silently fails:

- Navigates to `/` and intercepts the browser's `GET /dashboard` call
- Accepts HTTP 200 **or** 401 — both confirm the API is reachable and routing is correct
  - 200: auth middleware is not enforcing tokens (non-production mode)
  - 401: auth enforcement is active; the authenticated direct check (below) proves tokens are still accepted

### Authenticated API smoke check *(skipped when SMOKE_AZURE_\* secrets are absent)*

Acquires a service-principal Bearer token via the OAuth2 client-credentials flow and calls
`GET /dashboard` directly, without going through the browser.

**This test fails hard if:**

- Token cannot be acquired (bad credentials or misconfigured app registration)
- `GET /dashboard` returns 401 or 403 (auth enforcement is broken — valid tokens rejected)
- Response body is missing required fields or has wrong types (schema regression)

**This test is skipped (non-blocking) when any of the four required env vars are absent.**
A skip reason is shown in the Playwright HTML report so the gap is visible without blocking CI
for environments that have not yet configured a smoke service principal.

All checks are **read-only** and **safe for an empty database** — no data is created or mutated.

---

## Environment Variables

### Always required

| Variable | Purpose | Default |
|---|---|---|
| `REACT_APP_WEB_BASE_URL` | Base URL for browser tests (web frontend) | `http://localhost:5173` |
| `REACT_APP_API_BASE_URL` | Base URL for direct API requests | `http://localhost:3100` |

In CI both are set automatically from the Cloud Run deploy step outputs (`SERVICE_WEB_URI` and `SERVICE_API_URI`).

### Required for authenticated smoke check

These four variables unlock the authenticated `GET /dashboard` gate.  In GitHub Actions,
add them as **repository secrets** under **Settings → Secrets and variables → Actions**.

| Secret / Variable | Description |
|---|---|
| `SMOKE_AZURE_TENANT_ID` | Entra ID (Azure AD) tenant ID — not sensitive, can be a plain variable |
| `SMOKE_AZURE_CLIENT_ID` | Application (client) ID of the smoke service principal |
| `SMOKE_AZURE_CLIENT_SECRET` | Client secret for the smoke service principal — **must be a secret** |
| `SMOKE_AZURE_API_SCOPE` | API scope to request, e.g. `api://<api-client-id>/.default` |

#### Setting up the smoke service principal

1. **Create an app registration** in Entra ID (Azure Portal → App registrations → New registration).
   Name it something like `dales-operations-smoke-sp`.  No redirect URI needed.
2. **Create a client secret** under *Certificates & secrets → New client secret*.
   Copy the value immediately — it is only shown once.
3. **Grant API permission**: in the new app registration go to *API permissions → Add a permission →
   My APIs → your API app → Application permissions → access_as_user* (or the equivalent scope
   exposed by your API app registration).  Click **Grant admin consent**.
4. **Add the four values** as repository secrets in GitHub (or pipeline variables in ADO).

The smoke service principal only needs read access — it never writes data.

---

## Run Tests Locally

```bash
cd tests
npm ci
npx playwright install --with-deps chromium
npx playwright test
```

By default this targets `http://localhost:5173` (web) and `http://localhost:3100` (API).
Start both services first with `./start-dev.sh` from the repo root.

### Target a specific deployed environment

**Bash (Linux/macOS/WSL):**
```bash
REACT_APP_WEB_BASE_URL="https://web.example.com" \
REACT_APP_API_BASE_URL="https://api.example.com" \
npx playwright test
```

**Windows (PowerShell):**
```powershell
$env:REACT_APP_WEB_BASE_URL = "https://web.example.com"
$env:REACT_APP_API_BASE_URL = "https://api.example.com"
npx playwright test
```

### Run the authenticated smoke check locally

Set all four `SMOKE_AZURE_*` variables before running:

**Bash:**
```bash
REACT_APP_API_BASE_URL="https://api.example.com" \
SMOKE_AZURE_TENANT_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" \
SMOKE_AZURE_CLIENT_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" \
SMOKE_AZURE_CLIENT_SECRET="your-client-secret" \
SMOKE_AZURE_API_SCOPE="api://<api-client-id>/.default" \
npx playwright test --grep "Authenticated"
```

**PowerShell:**
```powershell
$env:REACT_APP_API_BASE_URL   = "https://api.example.com"
$env:SMOKE_AZURE_TENANT_ID    = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
$env:SMOKE_AZURE_CLIENT_ID    = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
$env:SMOKE_AZURE_CLIENT_SECRET = "your-client-secret"
$env:SMOKE_AZURE_API_SCOPE    = "api://<api-client-id>/.default"
npx playwright test --grep "Authenticated"
```

The client secret is only ever passed to the Microsoft identity token endpoint over HTTPS.
It is never logged — only non-sensitive error codes appear in test output.

---

## Authenticated vs Unauthenticated Behavior

| Scenario | `/health` | Browser `/dashboard` | Direct authenticated `/dashboard` |
|---|---|---|---|
| Local dev (no auth configured) | 200 ✓ | 200 ✓ | Skipped (no SMOKE_ vars) |
| Deployed, auth not enforced | 200 ✓ | 200 ✓ | 200 ✓ (if SMOKE_ vars set) |
| Deployed, auth enforced, token valid | 200 ✓ | 401 (expected, not a failure) | 200 ✓ |
| **Auth broken: valid tokens rejected** | 200 ✓ | 401 | **FAIL** (expected 200) |
| **Auth broken: token acquisition fails** | 200 ✓ | 401 | **FAIL** (token error) |
| **Schema regression on /dashboard** | 200 ✓ | varies | **FAIL** (shape assertion) |

The authenticated direct check is the only gate that catches a broken auth configuration
when the API is otherwise reachable.

---

## Debug Tests

```bash
npx playwright test --debug
npx playwright test --headed
```

More: <https://playwright.dev/docs/debug> and <https://playwright.dev/docs/trace-viewer>
