# Deploying Dales Operations to Google Cloud

Dales Operations runs entirely on Google Cloud:

- **API** — Express + TypeScript, deployed to **Cloud Run**, data stored in **Cloud Firestore** (native mode).
- **Web** — React SPA, built into an nginx image and deployed to **Cloud Run**.
- **CI/CD** — GitHub Actions workflow at [`.github/workflows/gcp-deploy.yml`](../.github/workflows/gcp-deploy.yml).

Authentication to GCP uses **Workload Identity Federation** — no service-account
key files are downloaded or stored.

> **End-user authentication is currently disabled.** The API endpoints are
> open. Adding an identity provider (e.g. Firebase Auth / Google Identity) is a
> separate, future task.

---

## What the deploy workflow does

1. Validates that all required GitHub variables/secrets are present.
2. Verifies `openapi.yaml` (root) is in sync with `src/api/openapi.yaml`.
3. Installs API deps, runs Jest tests with `NODE_ENV=test` (in-memory store).
4. Builds the API (`tsc`) and web bundle (`tsc && vite build`) as fail-fast.
5. Authenticates to GCP via Workload Identity Federation.
6. Builds the API Docker image, pushes it to Artifact Registry (tagged with the
   commit SHA and `latest`).
7. Deploys the API to Cloud Run with `NODE_ENV=production`. Firestore access
   uses the Cloud Run runtime service account — no secrets or key files.
8. Reads the API service URL from `gcloud run services describe`.
9. Builds the web Docker image with `--build-arg VITE_API_BASE_URL=<api url>`,
   then pushes it.
10. Deploys the web service to Cloud Run.
11. Updates the API's `API_ALLOW_ORIGINS` env var so CORS allows the web origin.
12. Runs Playwright smoke tests against the deployed URLs and uploads the report.

The workflow is **manual-only** (`workflow_dispatch`) until the first
successful deploy. Re-enable the `push` trigger afterwards so merges to
`main`/`master` deploy automatically.

---

## One-time GCP setup

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

Create a Firestore database in **native mode** (one per project):

```bash
gcloud firestore databases create \
  --project=PROJECT_ID \
  --location=REGION
```

This creates the `(default)` database. If you create a named database instead,
set the `FIRESTORE_DATABASE_ID` GitHub variable to its id.

> The app creates collections (`employees`, `tasks`, `productivity`,
> `coaching`, `issues`, `summaries`) on first write — no manual schema setup.

### 3. Service account for deployments

The workflow runs as a dedicated service account:

```bash
gcloud iam service-accounts create github-deployer \
  --project=PROJECT_ID \
  --display-name="GitHub Actions deployer for Cloud Run"
```

Grant it the roles it needs:

| Role | Why |
|---|---|
| `roles/run.admin` | Deploy and update Cloud Run services |
| `roles/artifactregistry.writer` | Push images to Artifact Registry |
| `roles/iam.serviceAccountUser` | Act as the Cloud Run runtime SA |

```bash
SA="github-deployer@PROJECT_ID.iam.gserviceaccount.com"
for role in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser
do
  gcloud projects add-iam-policy-binding PROJECT_ID \
    --member="serviceAccount:${SA}" --role="$role"
done
```

### 4. Firestore access for the API at runtime

The API talks to Firestore as the **Cloud Run runtime service account**, using
Application Default Credentials — no key files. Create a dedicated runtime
service account for the API so it holds only the permissions it needs
(principle of least privilege — this limits the blast radius if the account is
ever compromised):

```bash
gcloud iam service-accounts create dales-api-runtime \
  --project=PROJECT_ID \
  --display-name="Dales Operations API runtime (Firestore access)"

RUNTIME_SA="dales-api-runtime@PROJECT_ID.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/datastore.user"
```

Then add `--service-account=${RUNTIME_SA}` to the API `gcloud run deploy`
command in `.github/workflows/gcp-deploy.yml` so Cloud Run runs the API as this
account. The deployer service account needs `roles/iam.serviceAccountUser` to
act as it — it already has that role project-wide from step 3.

> **Quicker dev-only alternative:** skip the dedicated SA and grant
> `roles/datastore.user` to the Compute Engine default service account
> (`PROJECT_NUMBER-compute@developer.gserviceaccount.com`), which Cloud Run uses
> by default:
>
> ```bash
> PROJECT_NUMBER=$(gcloud projects describe PROJECT_ID --format='value(projectNumber)')
> gcloud projects add-iam-policy-binding PROJECT_ID \
>   --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
>   --role="roles/datastore.user"
> ```
>
> This is simpler but over-privileged — not recommended for environments
> handling real data.

### 5. Workload Identity Federation pool and provider

Lets GitHub Actions authenticate to GCP without a key file:

```bash
gcloud iam workload-identity-pools create github-pool \
  --project=PROJECT_ID --location=global --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc github-provider \
  --project=PROJECT_ID --location=global \
  --workload-identity-pool=github-pool \
  --display-name="GitHub OIDC" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository == 'OWNER/REPO'"
```

> Replace `OWNER/REPO` with your GitHub `owner/repository`. The attribute
> condition limits the pool to that repository — without it, *any* GitHub repo
> could mint tokens for your project.

Bind the GitHub repo to the deployer service account:

```bash
PROJECT_NUMBER=$(gcloud projects describe PROJECT_ID --format='value(projectNumber)')

gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --project=PROJECT_ID \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/OWNER/REPO"
```

The full provider resource name (goes into a GitHub secret) is:

```
projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider
```

---

## GitHub configuration

Configured under **Settings → Secrets and variables → Actions**.

### Required Variables

| Variable | Example | Notes |
|---|---|---|
| `GCP_PROJECT_ID` | `your-gcp-project-id` | Project that owns Artifact Registry, Cloud Run, and Firestore |
| `GCP_REGION` | `us-central1` | Region for Artifact Registry and both Cloud Run services |
| `GCP_ARTIFACT_REPO` | `dales-ops` | Artifact Registry repo created above |
| `GCP_API_SERVICE_NAME` | `dales-api` | Cloud Run service name for the API |
| `GCP_WEB_SERVICE_NAME` | `dales-web` | Cloud Run service name for the web app |

### Optional Variables

| Variable | Default | Notes |
|---|---|---|
| `FIRESTORE_DATABASE_ID` | `(default)` | Set only if you use a named Firestore database |
| `API_ALLOW_ORIGINS_EXTRA` | *(none)* | Comma-separated extra CORS origins (e.g. a custom domain) |

### Required Secrets

| Secret | What goes in it |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Full provider resource name from step 5 |
| `GCP_SERVICE_ACCOUNT` | Deployer SA email, e.g. `github-deployer@PROJECT_ID.iam.gserviceaccount.com` |

---

## How `VITE_API_BASE_URL` reaches the frontend

Vite environment variables (`VITE_*`) are *baked into the JavaScript bundle*
at build time — they are not read at runtime by nginx.

1. The workflow first deploys the API service.
2. It reads the API URL with `gcloud run services describe`.
3. It builds the web Docker image with `--build-arg VITE_API_BASE_URL=<api url>`.
4. The web `Dockerfile` sets `ENV VITE_API_BASE_URL` before `npm run build`, so
   Vite inlines the value into the bundle.
5. nginx serves the built `dist/` as a static SPA.

Local dev is unaffected: the Vite dev server reads `.env` / `.env.local`, and
the `Dockerfile` `ARG` defaults to `http://localhost:3100`.

---

## Local Docker test

Before the first push, build and run both images locally:

```bash
# API
docker build -t dales-api:local ./src/api
docker run --rm -p 3100:8080 -e PORT=8080 -e NODE_ENV=development dales-api:local
curl http://localhost:3100/health

# Web
docker build --build-arg VITE_API_BASE_URL=http://localhost:3100 \
  -t dales-web:local ./src/web
docker run --rm -p 8080:80 dales-web:local
```

> Running the API container locally against real Firestore requires
> Application Default Credentials. The simplest local option is the Firestore
> emulator: set `FIRESTORE_EMULATOR_HOST=localhost:8080` and run
> `gcloud emulators firestore start`.

---

## First deploy

1. Complete all one-time GCP setup and configure the GitHub variables/secrets.
2. **Actions → Deploy to Google Cloud Run → Run workflow.** Watch the
   validation step for missing configuration before any image is built.
3. After a successful run, confirm both Cloud Run URLs in the deployment
   summary, open the web URL, and check the dashboard loads.
4. Re-enable the `push` trigger in `gcp-deploy.yml` so future merges deploy
   automatically.

---

## Logging

stdout/stderr from both containers is captured by Cloud Logging automatically.

```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=API_SERVICE_NAME" \
  --project=PROJECT_ID --limit=50
```

---

## Risks and follow-ups

- **No end-user auth.** Both Cloud Run services use `--allow-unauthenticated`
  and the API performs no token validation. Anyone with the URL can read and
  write data. Adding an identity provider is the most important follow-up
  before this handles real data.
- **No Terraform / IaC.** Cloud Run config lives in the workflow's
  `gcloud run deploy` flags. Consider Terraform once the shape stabilises.
- **Full-collection reads.** The repository fetches a whole collection and
  filters in memory (Firestore has no case-insensitive or substring queries).
  Fine at the current data volume; revisit with Firestore composite indexes if
  collections grow large.
- **`latest` tag is mutable.** Use the immutable SHA tag for rollback, not
  `latest`.
