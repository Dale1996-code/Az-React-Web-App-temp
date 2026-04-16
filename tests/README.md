# Dales Operations — Smoke Tests

[Playwright](https://playwright.dev/) smoke tests that verify the web frontend routes render correctly.

## What's Tested

- App shell loads with all 7 navigation links
- Each MVP route renders its heading and shows a loading/empty/list state:
  Dashboard, Employees, Tasks, Productivity, Coaching, Issues, Daily Summary
- Unknown routes redirect to the dashboard
- Navigation between all routes via sidebar links

## Run Tests

The base URL is discovered in this order:

1. `REACT_APP_WEB_BASE_URL` environment variable
2. `.azure/{env}/.env` from the default azd environment
3. Defaults to `http://localhost:5173` (Vite dev server)

```bash
cd tests
npm ci
npx playwright install --with-deps chromium
npx playwright test
```

Use `--headed` to watch the browser, or `--debug` for step-through debugging.

## Debug Tests

```bash
npx playwright test --debug
```

More debugging references: https://playwright.dev/docs/debug and https://playwright.dev/docs/trace-viewer
