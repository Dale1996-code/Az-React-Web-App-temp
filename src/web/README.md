# Dales Operations — Web Frontend

React + Fluent UI frontend built with Vite.

## Setup

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Default | Notes |
|---|---|---|---|
| `VITE_API_BASE_URL` | No | `http://localhost:3100` | Must include scheme (`http://` or `https://`) |
| `VITE_APPLICATIONINSIGHTS_CONNECTION_STRING` | No | — | Frontend telemetry; disabled when blank |

Both variables default to sensible local values, so no `.env` file is needed for basic local development. In Azure they are injected automatically by the `azd` prepackage hook (see `azure.yaml`) — you do not set them manually.

## Available Scripts

Run these from the `src/web/` directory:

### `npm ci`

Installs dependencies.

### `npm run dev`

Starts the Vite development server.  
Open [http://localhost:5173](http://localhost:5173) in your browser.

The page hot-reloads on edits and shows lint errors in the console.

### `npm run build`

Type-checks with `tsc` and builds for production into the `dist/` folder.

### `npm run preview`

Serves the production build locally for verification.
