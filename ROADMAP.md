# Dales Operations — Roadmap

Last updated: 2026-05-16

This file describes the feature build-out history and the production-readiness hardening work done after the initial MVP. It is the single source of truth for what is complete, what is deferred, and why.

---

## Part 1 — Feature build-out (completed)

These phases built the core application from scratch. All are merged to `main`.

| Phase | Description | Status |
|-------|-------------|--------|
| F1 | Project scaffold: Express API, React + Fluent UI shell, local dev scripts | ✅ Complete |
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

> **Note:** Auth was implemented in full, then subsequently disabled when the app migrated from Azure to GCP. The MSAL code remains in the codebase but stays inert — all `VITE_AZURE_*` env vars are blank by default, so no MSAL overhead is added in any deployment. See CLAUDE.md for current auth state.

- `authService.ts`: `PublicClientApplication` built from `VITE_AZURE_CLIENT_ID`, `VITE_AZURE_TENANT_ID`, `VITE_AZURE_API_SCOPE`. Returns `null` when auth env vars are absent.
- `AuthProvider.tsx`: wraps the app in `MsalProvider` + `MsalBridge` when auth is enabled.
- `apiClient.ts`: request interceptor acquires a token silently and attaches `Authorization: Bearer <token>` when auth is enabled.
- Local dev: leave all three `VITE_AZURE_*` vars blank → no MSAL overhead, no auth header.

### H3 — Production API auth enforcement
**PR #58 / commit `ae2968d`**

> **Note:** The API auth middleware was written and wired up, then removed during the GCP migration. Auth is currently disabled — all endpoints are open. Adding an identity provider (e.g. Firebase Auth or Google Identity) is a deferred task.

### H4 — CI/CD pipeline and smoke test hardening
**PR #57 / commit `4f929e7`**

- GitHub Actions workflow: OpenAPI sync check, API tests, API build, web build, deploy, Playwright smoke tests, HTML report artifact upload.
- Playwright smoke suite (`tests/smoke.spec.ts`):
  - Route-shell checks for all 7 pages.
  - `GET /health` returns 200 with correct shape.
  - `GET /dashboard` via browser confirms API reachability.
- Preflight scripts (`preflight.sh` / `preflight.ps1`) for local pre-deploy validation.

### H5 — Observability baseline
**PR #56 / commit `31d919e`**

- `RUNBOOK.md`: preflight checklist, deploy steps, environment variable reference, rollback steps, log commands, triage playbook.
- `/health` endpoint (`GET /health`) returns `{ status: "ok", timestamp, env }` without auth. Used by Cloud Run health probes.
- README updated with accurate troubleshooting, deployment, and local dev docs.

### H6 — GCP / Cloud Run / Firestore migration
**PR #64**

Complete migration from Azure (App Service + Cosmos DB + Key Vault + Bicep/azd) to GCP:

- **Firestore** replaces Cosmos DB as the data store (`src/api/src/models/firestoreClient.ts`). All queries run as full-collection reads filtered in memory — Firestore has no case-insensitive or substring query support.
- **Cloud Run** replaces App Service for both API and web services. Both services are built as Docker images pushed to Artifact Registry.
- **Workload Identity Federation** replaces service account key files for GitHub Actions → GCP authentication.
- **Application Default Credentials** on the Cloud Run runtime service account replaces connection strings for Firestore access.
- **GitHub Actions** (`gcp-deploy.yml`) replaces the `azd` pipeline.
- All Azure infrastructure code (`infra/`, `azure.yaml`, `.azdo/`) removed.
- All Azure SDK dependencies (`@azure/cosmos`, `@azure/identity`, `@azure/keyvault-secrets`) removed.
- Auth middleware removed — API endpoints are fully open until an identity provider is added.
- Timestamps stored as ISO strings to avoid Firestore `Timestamp` ↔ JS `Date` serialization issues.

---

## Part 3 — Deferred / post-launch ideas

These are not planned for the current release. Revisit if usage or team needs change.

| Item | Rationale for deferral |
|------|------------------------|
| End-user authentication | Auth disabled for now; add Firebase Auth or Google Identity when needed |
| Continuation-token pagination | Full-collection reads are fine at current data volumes; revisit if collections grow large |
| Firestore composite indexes | In-memory filtering covers all current queries; revisit with native Firestore queries if performance becomes an issue |
| Cloud Monitoring alert policies | Manual uptime check is sufficient now; add metric alerts when usage warrants |
| Terraform / IaC for GCP resources | Cloud Run config lives in the workflow's `gcloud run deploy` flags; formalize with Terraform once the shape stabilises |
| Role-based authorization (RBAC) | All users currently have equal access; add when store-manager vs. associate distinction is needed |
| Redis cache for dashboard | Dashboard queries are bounded and fast at current data volumes |
| Database backup exports | Firestore has automated backups; scheduled exports are optional |
