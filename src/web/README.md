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

### `npm start`

Starts the development server.  
Open [http://localhost:3000](http://localhost:3000) in your browser.

The page reloads on edits and shows lint errors in the console.

### `npm run build`

Builds for production into the `dist/` folder.

### `npm test`

Runs the unit test suite.
