# GCP Cloud Run — CI/CD setup

This document covers everything the deployment workflow at
[`.github/workflows/gcp-deploy.yml`](../.github/workflows/gcp-deploy.yml)
assumes: the GCP resources you need to create once, the GitHub variables and
secrets to configure, and the manual validation steps to run before pushing.

The API is backed by **Google Cloud Firestore (native mode)** and
authenticates via Application Default Credentials — i.e. the Cloud Run
runtime service account. No database key secrets are involved.

Entra ID / MSAL on the frontend is optional and stays inert unless all three
`VITE_AZURE_*` build args are set.

---

## What the workflow does

1. Validates that all required configuration is present before doing any work.
2. Verifies `openapi.yaml` (root) is in sync with `src/api/openapi.yaml`.
3. Installs API deps, runs Jest tests with `NODE_ENV=test` (in-memory store).
4. Builds the API (`tsc`) and web bundle (`tsc && vite build`) as fail-fast.
5. Authenticates to GCP via Workload Identity Federation (no key files).
6. Builds the API Docker image and pushes it to Artifact Registry, tagged
   with the commit SHA and `latest`.
7. Deploys the API to Cloud Run with `NODE_ENV=production`,
   `GOOGLE_CLOUD_PROJECT`, and `FIRESTORE_DATABASE_ID` env vars.
8. Reads the API service URL from `gcloud run services describe`.
9. Builds the web Docker image with `--build-arg VITE_API_BASE_URL=<api url>`
   and pushes it.
10. Deploys the web service to Cloud Run.
11. Reads the web URL and updates the API's `API_ALLOW_ORIGINS` env var so
    CORS allows the new web origin.
12. Runs Playwright smoke tests against the deployed Cloud Run URLs and
    uploads the report as a build artifact.

---

## One-time GCP setup

Before the workflow can run, the following must exist in your GCP project.
None of this is automated — it requires a human with `Owner` on the project.

### 1. Project, region, and Artifact Registry repo

Pick a project ID and region. Create a Docker-format Artifact Registry repo:

```bash
gcloud artifacts repositories create ARTIFACT_REPO \
  --project=PROJECT_ID \
  --repository-format=docker \
  --location=REGION \
  --description="Dales Operations container images"
```

### 2. Firestore database

Enable Firestore in the same project, in **native mode**. You can use the
default database (`(default)`) or a named database — if you use a named
database, set the `FIRESTORE_DATABASE_ID` GitHub variable.

```bash
gcloud firestore databases create \
  --project=PROJECT_ID \
  --location=REGION \
  --type=firestore-native
```

No collection creation is needed — the API writes through `BaseRepository`
and collections are created lazily on first write.

### 3. Service accounts and IAM

There are **two** service accounts to think about:

- **Deployer SA** — used by GitHub Actions to push images and deploy.
- **Cloud Run runtime SA** — runs inside the API container and reads/writes
  Firestore. By default this is the project's Compute Engine default SA
  unless you set `--service-account` on the deploy.

Create the deployer SA:

```bash
gcloud iam service-accounts create github-deployer \
  --project=PROJECT_ID \
  --display-name="GitHub Actions deployer for Cloud Run"
```

Grant the deployer the minimum roles it needs:

| Role | Why |
|---|---|
| `roles/run.admin` | Deploy and update Cloud Run services |
| `roles/artifactregistry.writer` | Push images to Artifact Registry |
| `roles/iam.serviceAccountUser` | Act as the Cloud Run runtime SA |

```bash
SA="github-deployer@PROJECT_ID.iam.gserviceaccount.com"
for role in \
  roles/run.admin \
  roles/artifactregistry.writer \
  roles/iam.serviceAccountUser
do
  gcloud projects add-iam-policy-binding PROJECT_ID \
    --member="serviceAccount:${SA}" \
    --role="$role"
done
```

Grant the **Cloud Run runtime SA** access to Firestore (use whichever SA the
API service runs as — by default the Compute Engine default SA):

```bash
RUNTIME_SA="PROJECT_NUMBER-compute@developer.gserviceaccount.com"
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/datastore.user"
```

### 4. Workload Identity Federation pool and provider

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

---

## GitHub configuration

All values below are configured under
**Settings → Secrets and variables → Actions** on the repository.
Use **Variables** for non-sensitive identifiers and **Secrets** for anything
that grants access (the WIF provider name and SA email are treated as secrets
because they identify the deployment principal).

### Required Variables

| Variable | Example placeholder | Notes |
|---|---|---|
| `GCP_PROJECT_ID` | `your-gcp-project-id` | The project that owns Artifact Registry, Cloud Run, and Firestore |
| `GCP_REGION` | `us-central1` | Same region for Artifact Registry and both Cloud Run services |
| `GCP_ARTIFACT_REPO` | `dales-ops` | Artifact Registry repo created above |
| `GCP_API_SERVICE_NAME` | `dales-api` | Cloud Run service name for the API |
| `GCP_WEB_SERVICE_NAME` | `dales-web` | Cloud Run service name for the web app |

### Optional Variables

| Variable | Default | Notes |
|---|---|---|
| `FIRESTORE_DATABASE_ID` | `(default)` | Set this only if you created a named Firestore database instead of using the default one. |
| `API_ALLOW_ORIGINS_EXTRA` | *(none)* | Comma-separated list of additional CORS origins (e.g. a custom domain) |
| `GCP_VPC_CONNECTOR` | *(none)* | Serverless VPC Access connector name. Required only to enable the optional Redis cache tier — see below. |
| `REDIS_URL` | *(none)* | Redis connection URL for the optional dashboard cache, e.g. `redis://10.0.0.3:6379`. Ignored unless `GCP_VPC_CONNECTOR` is also set. |
| `VITE_AZURE_CLIENT_ID` | *(none)* | SPA app registration client ID. Baked into the bundle at build time. Leave all three `VITE_AZURE_*` vars unset to disable MSAL auth. |
| `VITE_AZURE_TENANT_ID` | *(none)* | Entra ID tenant ID. |
| `VITE_AZURE_API_SCOPE` | *(none)* | e.g. `api://<api-client-id>/access_as_user`. |

> The current workflow does not pass `VITE_AZURE_*` build args to the web
> Docker build. If you want MSAL auth enabled in the deployed bundle, add the
> corresponding `--build-arg` flags to the "Build and push web image" step
> and reference the variables above.

### Optional cache tier (Memorystore for Redis)

The API can put a short-lived Redis cache in front of the `/dashboard`
aggregation. It is entirely optional: with neither variable set, the API
deploys exactly as before and the dashboard reads straight from Firestore.

To enable it:

1. Create a Memorystore for Redis instance in the same region and VPC.
2. Create a Serverless VPC Access connector (Memorystore is reachable only
   on a private IP, so Cloud Run needs the connector to talk to it).
3. Set the `GCP_VPC_CONNECTOR` variable to the connector name and
   `REDIS_URL` to `redis://<instance-host>:<port>`.

The workflow then adds `--vpc-connector` and `REDIS_URL` to the API
Cloud Run service. The cache uses a short TTL and fails soft — if Redis is
unreachable, the dashboard transparently falls back to Firestore.

### Required Secrets

| Secret | What goes in it |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Full provider resource name from step 4, e.g. `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider` |
| `GCP_SERVICE_ACCOUNT` | Deployer SA email, e.g. `github-deployer@PROJECT_ID.iam.gserviceaccount.com` |

### Optional Secrets (authenticated smoke checks)

Set these to make the authenticated dashboard test in Playwright a blocking
gate. Without them, that test is skipped and a reason appears in the report.

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

In the workflow this is handled by:

1. Deploying the API service first.
2. Reading the API URL with `gcloud run services describe ... --format='value(status.url)'`.
3. Building the web Docker image with `--build-arg VITE_API_BASE_URL=<api url>`.
4. The web `Dockerfile` declares `ARG VITE_API_BASE_URL` and
   `ENV VITE_API_BASE_URL=$VITE_API_BASE_URL` *before* the `npm run build`
   stage, so Vite picks up the value and inlines it into the bundle.
5. nginx then serves the built `dist/` as a static SPA.

Local dev is not affected: the Vite dev server reads `.env` / `.env.local`
directly, and the `Dockerfile` `ARG` defaults to `http://localhost:3100` if
no build arg is passed.

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

2. **Run the API container against Firestore** using a local SA key for
   testing only, then `curl http://localhost:3100/health`. (Production
   deployments use ADC and never need a key file.)

3. **Run the web container** (`docker run --rm -p 8080:80 dales-web:local`)
   and confirm the SPA loads and SPA-routing fallback works (refresh on a
   nested route should not 404).

4. **Manually invoke the workflow** from the Actions tab once secrets are
   configured (Run workflow → branch → Dispatch). Watch the validation step
   for any missing configuration before any image is built.

5. After the first successful run, confirm in the Cloud Run console that
   `API_ALLOW_ORIGINS` was updated to include the web URL, and that
   `GOOGLE_CLOUD_PROJECT` and (if applicable) `FIRESTORE_DATABASE_ID` are
   set on the API service.

---

## Manual GCP console tasks not covered by the workflow

These have to be done once by an operator with the right GCP rights:

1. Create the Firestore database in native mode (step 2 above).
2. Create the Artifact Registry repo, deployer SA, and Workload Identity Pool
   (steps 1, 3, and 4 above).
3. Bind the GitHub repository to the deployer SA via
   `roles/iam.workloadIdentityUser` (step 4 above).
4. Grant the Cloud Run runtime SA `roles/datastore.user` (step 3 above).
5. (Optional, only if enabling MSAL auth) In Entra ID, add the Cloud Run
   web URL as a redirect URI on the SPA app registration.
6. (Optional) Map a custom domain to the web Cloud Run service and add it
   to `API_ALLOW_ORIGINS_EXTRA` plus the SPA app registration redirect URIs.

---

## Risks and follow-ups

- **No Terraform / IaC for GCP yet.** The Cloud Run service config currently
  lives entirely in the workflow's `gcloud run deploy` flags. Consider moving
  to Terraform or a `service.yaml` once the shape stabilises.
- **`--allow-unauthenticated` on the API.** The API is exposed publicly. The
  app-level JWT middleware is only active when `NODE_ENV=production` and the
  required Entra ID env vars are set; otherwise the API is fully open. A
  future hardening step is putting an authenticating proxy (IAP or API
  Gateway) in front, or switching to `--no-allow-unauthenticated` with a
  service-to-service identity between web and API.
- **`latest` tag is mutable.** Image promotion uses immutable SHA tags as the
  source of truth; `latest` is a convenience pointer. Don't use `latest` for
  rollback — use the SHA tag of the desired commit.
- **Smoke tests rely on shared `SMOKE_AZURE_*` secrets.** They read URLs from
  env vars set by the workflow — no Playwright changes are needed when the
  Cloud Run URLs change.
