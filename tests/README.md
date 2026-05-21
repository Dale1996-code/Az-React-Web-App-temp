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
| `GET /dashboard` returns 200 | Dashboard endpoint is reachable and returns valid data |
| `GET /dashboard` body shape | All required fields present with correct types |

`/health` and `/dashboard` are unauthenticated in all deployment modes.

### Frontend ↔ API integration (browser-side)

Proves the frontend is not just rendering chrome while the API silently fails:

- Navigates to `/` and intercepts the browser's `GET /dashboard` call
- Expects HTTP 200 and validates the `date` field
- Waits for "Shift Overview" heading to appear (confirms the UI resolved successfully)

All checks are **read-only** and **safe for an empty database** — no data is created or mutated.

---

## Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `REACT_APP_WEB_BASE_URL` | Base URL for browser tests (web frontend) | `http://localhost:5173` |
| `REACT_APP_API_BASE_URL` | Base URL for direct API requests | `http://localhost:3100` |

In CI both are set automatically from the Cloud Run deploy step outputs.

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

---

## Debug Tests

```bash
npx playwright test --debug
npx playwright test --headed
```

More: <https://playwright.dev/docs/debug> and <https://playwright.dev/docs/trace-viewer>
