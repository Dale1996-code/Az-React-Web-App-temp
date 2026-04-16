# Dales Operations — Web Frontend

React + Fluent UI frontend built with Vite.

## Setup

Create a `.env` file in `src/web/` with the following:

- `VITE_API_BASE_URL` - Base URL for all API requests (e.g. `http://localhost:3100`)

> The URL must include the scheme: `http://` or `https://`.

- `VITE_APPLICATIONINSIGHTS_CONNECTION_STRING` - Azure Application Insights connection string (optional for local dev)

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
