# Dales Operations — Roadmap

Last updated: 2026-04-30

This file describes the feature build-out history and the production-readiness hardening work done after the initial MVP. It is the single source of truth for what is complete, what is deferred, and why.

---

## Part 1 — Feature build-out (completed)

These phases built the core application from scratch. All are merged to `main`.

| Phase | Description | Status |
|-------|-------------|--------|
| F1 | Project scaffold: Express API, React + Fluent UI shell | ✅ Complete |
| F2 | Employees CRUD (list, create, edit, delete) | ✅ Complete |
| F3 | Tasks CRUD with status, priority, department, assignee | ✅ Complete |
| F4 | Productivity records CRUD (freight units, zones, breaks) | ✅ Complete |
| F5 | Coaching records CRUD with follow-up date tracking | ✅ Complete |
| F6 | Issues log CRUD with quick-resolve action | ✅ Complete |
| F7 | Daily Summary CRUD | ✅ Complete |
| F8 | Dashboard — aggregated shift-day view across all six collections | ✅ Complete |

All seven frontend pages are implemented. No stale placeholder pages remain.

---

## Part 2 — Production-readiness hardening (completed)

These phases hardened the application for real deployment. All are merged to `main`.

### H1 — Shift-use UX and mobile readiness
**PR #52 / commit `4e8122a`**

- All create/edit panels wrapped in `<form onSubmit>` handlers.
- Primary save buttons submit the form; Enter key triggers save.
- First useful input autofocused when a panel opens.
- All date fields use `type="date"` (browser date picker); time fields use `type="time"`.
- Auto-stamped `completedAt` when task status becomes `completed`.
- Auto-stamped `resolvedAt` when issue status becomes `resolved`.
- Shared `ToastBar` confirmation after save/update/delete.
- Error messages surface real API response text via `extractApiError`.
- Axios timeout set to 15 000 ms.
- Filter rows stack vertically on narrow screens.
- Row action buttons minimum 44 px tall for reliable tap targets.
- Dashboard refresh button and "Last updated" timestamp added.
- Labels: "Employee code" → "Employee ID".

### H2 — Frontend MSAL authentication
**PR #55 / commit `de33d90`**

- `@azure/msal-browser` and `@azure/msal-react` added to web dependencies.
- `authService.ts`: `PublicClientApplication` built from `VITE_AZURE_CLIENT_ID`, `VITE_AZURE_TENANT_ID`, `VITE_AZURE_API_SCOPE`. Returns `null` when auth env vars are absent (no overhead in local dev).
- `AuthProvider.tsx`: wraps the app in `MsalProvider` + `MsalBridge`. `MsalBridge` triggers `loginRedirect` when no account is cached; shows "Signing you in…" overlay during redirect; surfaces a dismissible error bar on auth failure.
- `apiClient.ts`: request interceptor acquires a token silently and attaches `Authorization: Bearer <token>` when auth is enabled.
- Local dev: leave all three `VITE_AZURE_*` vars blank → no MSAL overhead, no auth header.
- Web unit tests updated to cover `AuthProvider` in both enabled and disabled states.

### H3 — Production API auth enforcement
**PR #58 / commit `ae2968d`**

> **Note on phase numbering:** There is no separate "H3 — enable API auth" PR because the API middleware (`src/api/src/middleware/auth.ts`) was written in full during H2 as part of the end-to-end auth spike. H3 is defined here as the deployment-level wiring that activates enforcement in production.

- `src/api/src/middleware/auth.ts`: `createAuthMiddleware` validates RS256 Bearer JWTs using Node.js built-in crypto. Enforces when `NODE_ENV=production` AND `AZURE_AD_CLIENT_ID` is set. Bypasses with a startup warning in development/test.
- `/health` is always unauthenticated — used by health probes.

### H4 — Authenticated CI and smoke test hardening
**PR #57 / commit `4f929e7`**

- GitHub Actions: OpenAPI sync check, API tests, API build, web build, deploy, Playwright smoke tests, HTML report artifact upload.
- Playwright smoke suite (`tests/smoke.spec.ts`):
  - Route-shell checks for all 7 pages (auth-agnostic).
  - `GET /health` returns 200 with correct shape.
  - `GET /dashboard` via browser: accepts 200 or 401 (both confirm API reachability).
  - Authenticated `GET /dashboard`: acquires a service-principal token via OAuth2 client credentials, calls the API directly, validates response schema. Skipped (non-blocking) when `SMOKE_AZURE_*` secrets are absent; blocking when present.

### H5 — Production baseline and observability
**PR #56 / commit `31d919e`**

- `RUNBOOK.md`: preflight checklist, required env vars, rollback steps, log-streaming commands, 401/500/health failure diagnosis.
- `/health` endpoint (`GET /health`) always returns `{ status: "ok", timestamp, env }` without auth.
- README updated with accurate auth flow and troubleshooting guide.

### H6 — Cosmos query and index tuning
**Commit on `claude/production-readiness-roadmap-dPSrQ`**

All containers use `/id` as the partition key, making every WHERE-plus-ORDER-BY query cross-partition. Without composite indexes, the Cosmos SQL API returns an error for ORDER BY combined with a filter on a different field.

Composite indexes required (must be configured on the Cosmos DB account):
- **issues**: `[status ASC, storeDate DESC]` — dashboard query: `WHERE status='open' ORDER BY storeDate DESC`
- **coaching**: `[followUpDate ASC]` — dashboard query: `WHERE followUpDate <= date ORDER BY followUpDate ASC`
- **tasks**: `[storeDate ASC, status ASC]` and `[storeDate ASC, department ASC]` — route list queries combining date + status or date + department filters

**OFFSET/LIMIT note:** The current pagination uses `OFFSET n LIMIT m` (embedded in Cosmos SQL). This is correct and functional at small-to-medium scale. At large scale (thousands of records, deep pages), continuation tokens (`FeedOptions.continuationToken`) are more efficient because they avoid re-scanning skipped rows on every page request. This is a deferred improvement — see `src/api/src/models/baseRepository.ts` `buildSelectSql()` for the implementation point.

---

## Part 3 — Deferred / post-launch ideas

These are not planned for the current release. Revisit if usage or team needs change.

| Item | Rationale for deferral |
|------|------------------------|
| Push equality filters into Firestore `where()` | List endpoints currently fetch the whole collection and evaluate filters in memory. Push simple equality filters down once any collection grows large enough to matter. |
| Deployment slots (blue/green) | Cloud Run supports traffic splitting; rollback via revision promotion is adequate for now |
| Redis cache for dashboard | Optional and already wired up — set `GCP_VPC_CONNECTOR` and `REDIS_URL` to enable. Off by default while data volumes are small. |
| Role-based authorization (RBAC) | All authenticated users currently have equal access; add when store-manager vs. associate distinction is needed |
| Database backup exports | Firestore supports scheduled managed exports to GCS; configure when retention requirements demand it |
| IaC for GCP | Cloud Run config currently lives in workflow flags; migrate to Terraform or `service.yaml` once the shape stabilises |

