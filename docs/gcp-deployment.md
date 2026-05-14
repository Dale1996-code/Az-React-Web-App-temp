# GCP Cloud Run — Phase 2 CI/CD setup

Phase 2 of the Azure → GCP migration replaces the Azure GitHub Actions workflow
with a GitHub Actions workflow that builds, pushes, and deploys to Google
Cloud Run on every push to `main`/`master`.

The workflow lives at [`.github/workflows/gcp-deploy.yml`](../.github/workflows/gcp-deploy.yml).

This document covers everything that workflow assumes: the GCP resources you
need to create once, the GitHub variables and secrets to configure, and the
manual validation steps you should run before merging the workflow.

> **Out of scope for Phase 2.** Cosmos DB stays on Azure. Entra ID / MSAL
> auth stays the same. The Azure Bicep infrastructure (`infra/`, `azure.yaml`)
> has been removed — the GCP Cloud Run deployment is now the sole deployment path.
> See [`gcp-cloud-run-phase1.md`](./gcp-cloud-run-phase1.md) for the runtime
> setup (Artifact Registry, Cosmos key in Secret Manager, redirect URIs).

---

## What the new workflow does

1. Validates that all required configuration is present before doing any work.
2. Verifies `openapi.yaml` (root) is in sync with `src/api/openapi.yaml`.
3. Installs API deps, runs Jest tests with `NODE_ENV=test` (in-memory mock).
4. Builds the API (`tsc`) and web bundle (`tsc && vite build`) as fail-fast.
5. Authenticates to GCP via Workload Identity Federation (no key files).
6. Builds the API Docker image and pushes it to Artifact Registry tagged with
   the commit SHA (and `latest`).
7. Deploys the API to Cloud Run, with `NODE_ENV=production` and Cosmos DB key
   pulled from Secret Manager via `--set-secrets`.
8. Reads the API service URL from `gcloud run services describe`.
9. Builds the web Docker image with `--build-arg VITE_API_BASE_URL=<api url>`
   and the public `VITE_AZURE_*` values, then pushes it.
10. Deploys the web service to Cloud Run.
11. Reads the web URL and updates the API's `API_ALLOW_ORIGINS` env var so CORS
    allows the new web origin.
12. Runs Playwright smoke tests against the deployed Cloud Run URLs and uploads
    the report as a build artifact.

The Azure workflow (`azure-dev.yml`) has been removed — GCP Cloud Run is the only deployment path.

---

## One-time GCP setup

Before the workflow can run, the following must exist in your GCP project.
None of this is automated by Phase 2 — it requires a human with `Owner` on the
project.

### 1. Project, region, and Artifact Registry repo

Pick a project ID and region. Create a Docker-format Artifact Registry repo:

```bash
gcloud artifacts repositories create ARTIFACT_REPO \
  --project=PROJECT_ID \
  --repository-format=docker \
  --location=REGION \
  --description="Dales Operations container images"
```

### 2. Service account for deployments

The workflow runs as a dedicated service account, not as a user. Create it:

```bash
gcloud iam service-accounts create github-deployer \
  --project=PROJECT_ID \
  --display-name="GitHub Actions deployer for Cloud Run"
```

Grant it the minimum roles it needs:

| Role | Why |
|---|---|
| `roles/run.admin` | Deploy and update Cloud Run services |
| `roles/artifactregistry.writer` | Push images to Artifact Registry |
| `roles/iam.serviceAccountUser` | Act as the Cloud Run runtime SA |
| `roles/secretmanager.secretAccessor` | Bind `cosmos-db-key` to API service |

```bash
SA="github-deployer@PROJECT_ID.iam.gserviceaccount.com"
for role in \
  roles/run.admin \
  roles/artifactregistry.writer \
  roles/iam.serviceAccountUser \
  roles/secretmanager.secretAccessor
do
  gcloud projects add-iam-policy-binding PROJECT_ID \
    --member="serviceAccount:${SA}" \
    --role="$role"
done
```

### 3. Workload Identity Federation pool and provider

This lets GitHub Actions authenticate to GCP without a downloaded key file.

```bash
gcloud iam workload-identity-pools create github-pool \
  --project=PROJECT_ID \
  --location=global \
  --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc github-provider \
  --project=PROJECT_ID \
  --location=global \
  --workload-identity-pool=github-pool \
  --display-name="GitHub OIDC" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.actor=assertion.actor,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository == 'OWNER/REPO'"
```

> Replace `OWNER/REPO` with the GitHub `owner/repository` you are deploying
> from. The attribute condition limits the pool to that repository — without
> it, *any* GitHub repo could mint tokens for your project.

Bind the GitHub repo to the deployer service account:

```bash
PROJECT_NUMBER=$(gcloud projects describe PROJECT_ID --format='value(projectNumber)')

gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --project=PROJECT_ID \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/OWNER/REPO"
```

The full provider resource name (which goes into a GitHub secret) is:

```
projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider
```

### 4. Cosmos DB key in Secret Manager

See [phase 1 doc — store the Cosmos key in Secret Manager](./gcp-cloud-run-phase1.md#2-store-the-cosmos-key-in-secret-manager-recommended).
The default secret name expected by the workflow is `cosmos-db-key`. Override
it by setting the `GCP_COSMOS_KEY_SECRET` GitHub variable.

---

## GitHub configuration

All values below are configured under
**Settings → Secrets and variables → Actions** on the repository.
Use **Variables** for non-sensitive identifiers and **Secrets** for anything
that grants access (the WIF provider name and SA email are treated as secrets
in this workflow because they identify the deployment principal).

### Required Variables

| Variable | Example placeholder | Notes |
|---|---|---|
| `GCP_PROJECT_ID` | `your-gcp-project-id` | The project that owns Artifact Registry and Cloud Run |
| `GCP_REGION` | `us-central1` | Same region for Artifact Registry and both Cloud Run services |
| `GCP_ARTIFACT_REPO` | `dales-ops` | Artifact Registry repo created above |
| `GCP_API_SERVICE_NAME` | `dales-api` | Cloud Run service name for the API |
| `GCP_WEB_SERVICE_NAME` | `dales-web` | Cloud Run service name for the web app |
| `AZURE_COSMOS_ENDPOINT` | `https://YOUR_ACCOUNT.documents.azure.com:443/` | From Azure Portal → Cosmos DB → Overview |
| `AZURE_COSMOS_DATABASE_NAME` | `DalesOperations` | The Cosmos SQL database name |
| `AZURE_AD_TENANT_ID` | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | Entra ID tenant; required when `NODE_ENV=production` |
| `AZURE_AD_CLIENT_ID` | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | API app registration client ID |
| `VITE_AZURE_CLIENT_ID` | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | SPA app registration client ID (baked into the bundle) |
| `VITE_AZURE_TENANT_ID` | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | Entra ID tenant ID (baked into the bundle) |
| `VITE_AZURE_API_SCOPE` | `api://<api-client-id>/access_as_user` | Scope MSAL requests on the SPA's behalf |

### Optional Variables

| Variable | Default | Notes |
|---|---|---|
| `GCP_COSMOS_KEY_SECRET` | `cosmos-db-key` | Secret Manager secret name for the Cosmos primary key |
| `API_ALLOW_ORIGINS_EXTRA` | *(none)* | Comma-separated list of additional CORS origins (e.g. a custom domain) |

### Required Secrets

| Secret | What goes in it |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Full provider resource name from step 3, e.g. `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider` |
| `GCP_SERVICE_ACCOUNT` | Deployer SA email, e.g. `github-deployer@PROJECT_ID.iam.gserviceaccount.com` |

### Optional Secrets (authenticated smoke checks)

These are inherited from the Azure workflow — set them to make the
authenticated dashboard test in Playwright a blocking gate. Without them, that
test is skipped and a reason appears in the report.

| Secret | What goes in it |
|---|---|
| `SMOKE_AZURE_TENANT_ID` | Entra ID tenant ID for the smoke-test SP |
| `SMOKE_AZURE_CLIENT_ID` | Service-principal client ID with API permission consented |
| `SMOKE_AZURE_CLIENT_SECRET` | Service-principal client secret |
| `SMOKE_AZURE_API_SCOPE` | e.g. `api://<api-client-id>/.default` |

---

## How `VITE_API_BASE_URL` reaches the frontend

Vite environment variables (`VITE_*`) are *baked into the JavaScript bundle*
at build time — they are not read from the environment when the static files
are served by nginx.

In Phase 1 / Phase 2 this works as follows:

1. The workflow first deploys the API service.
2. It reads the API URL with `gcloud run services describe ... --format='value(status.url)'`.
3. It builds the web Docker image with
   `--build-arg VITE_API_BASE_URL=<api url>`.
4. The web `Dockerfile` declares `ARG VITE_API_BASE_URL` and `ENV VITE_API_BASE_URL=$VITE_API_BASE_URL` *before* the `npm run build` stage, so Vite picks it up and inlines the value into the bundle.
5. nginx then serves the built `dist/` as a static SPA.

Local dev is not affected: the Vite dev server reads `.env` / `.env.local`
directly, and the `Dockerfile` `ARG` defaults to `http://localhost:3100` if no
build arg is passed.

---

## Manual validation before the first push

GCP credentials are not available in normal local checkouts, so the workflow
itself can only be fully validated by running it. Before merging, do the
following manually:

1. **Build both Docker images locally** to confirm the Dockerfiles still work
   and produce runnable images:

   ```bash
   docker build -t dales-api:local ./src/api
   docker build --build-arg VITE_API_BASE_URL=http://localhost:3100 \
     -t dales-web:local ./src/web
   ```

2. **Run the API container against your Cosmos DB** (see Phase 1 doc) and
   `curl http://localhost:3100/health`.

3. **Run the web container** (`docker run --rm -p 8080:80 dales-web:local`)
   and confirm the SPA loads and SPA-routing fallback works (refresh on a
   nested route should not 404).

4. **Manually invoke the workflow** from the Actions tab once secrets are
   configured (Run workflow → branch → Dispatch). Watch the validation step
   for any missing configuration before any image is built.

5. After the first successful run, confirm in the Cloud Run console that
   `API_ALLOW_ORIGINS` was updated, that `AZURE_COSMOS_KEY` is shown as
   "secret" (not a literal value), and that no secret values appear in the
   workflow logs.

---

## Manual GCP console tasks not covered by the workflow

These cannot be automated and have to be done once by an operator with the
right Azure / GCP rights:

1. Ensure account-key auth is enabled on Cosmos DB and copy the primary key into
   Secret Manager (Phase 1 doc — Secret Manager section).
2. Add the Cloud Run web URL as a redirect URI on the SPA app registration
   in Entra ID (Phase 1 doc — Update Entra ID SPA redirect URIs).
3. Create the Artifact Registry repo, deployer SA, and Workload Identity Pool
   (steps above).
4. Bind the GitHub repository to the deployer SA via
   `roles/iam.workloadIdentityUser` (step 3 above).
5. (Optional) Map a custom domain to the web Cloud Run service and add it to
   `API_ALLOW_ORIGINS_EXTRA` plus the SPA app registration redirect URIs.

---

## Risks and follow-ups

- **No Terraform / IaC for GCP yet.** The Cloud Run service config currently
  lives entirely in the workflow's `gcloud run deploy` flags. Consider moving
  to Terraform or a `service.yaml` once the shape stabilises.
- **`--allow-unauthenticated` on the API.** Phase 1 + 2 expose the API
  publicly and rely on Entra ID JWT validation in middleware. If the JWT
  middleware ever regresses, the API would be open. A future hardening step
  is putting an authenticating proxy (IAP, API Gateway, or `--no-allow-unauthenticated`
  with a service-to-service identity) in front.
- **`latest` tag is mutable.** Image promotion uses immutable SHA tags as the
  source of truth; `latest` is a convenience pointer. Don't use `latest` for
  rollback — use the SHA tag of the desired commit.
- **Cosmos key rotation** is manual. Add a new version to the
  `cosmos-db-key` Secret Manager secret and Cloud Run will pick it up on the
  next deploy (or restart) because we reference `:latest`.
- **Smoke tests share infrastructure with the Azure workflow.** They use the
  same `SMOKE_AZURE_*` secrets and read URLs from env vars — no Playwright
  changes were needed.
