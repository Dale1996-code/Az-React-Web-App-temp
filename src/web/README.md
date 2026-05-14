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

Both variables default to sensible local values, so no `.env` file is needed for basic local development. In GCP Cloud Run they are baked into the Docker image as build args during CI — you do not set them manually in the container.

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

### `npm test`

Runs the unit test suite once (vitest, jsdom).

### `npm run test:watch`

Runs vitest in watch mode — reruns affected tests on every save.

### `npm run test:coverage`

Generates a V8 coverage report to `coverage/`.

## Frontend Architecture

### Page structure

Each domain has its own page under `src/pages/`. All five CRUD pages (`EmployeesPage`, `TasksPage`, `ProductivityPage`, `CoachingPage`, `IssuesPage`) share the same Fluent UI pattern: a `DetailsList` for the data, a `Panel` for create/edit, and a `Dialog` for delete confirmation.

### Shared primitives

Duplication across pages is handled via shared hooks, components, and utilities rather than abstract base classes.

**Hooks (`src/hooks/`)**

| Hook | Purpose |
|---|---|
| `useCrudPanel<T, F>` | Manages all panel/dialog state: open/close, form data, form errors, saving spinner, delete target, deleting spinner |
| `useEmployees` | Fetches the active employee roster once; returns `employees`, `employeeMap`, `employeeOptions`, and `loadingEmployees` for use in pages that need an employee dropdown |

**Shared components (`src/components/`)**

| Component | Purpose |
|---|---|
| `ListState` | Tri-state wrapper: renders a `Spinner` while loading, a dashed "no items" box when the list is empty, or the children when data is available |
| `PanelFooter` | Save / Cancel footer for Fluent UI `Panel`; shows "Saving…" and disables both buttons while a save is in flight |
| `DeleteDialog` | Fluent UI `Dialog` with a red Remove button and a Cancel button; shows "Removing…" + disables buttons while a delete is in flight |
| `ErrorBar` | Dismissible error `MessageBar`; renders `null` when `message` is `null` — safe to place unconditionally in JSX |

**Utilities (`src/utils/`)**

| Utility | Exports |
|---|---|
| `dateUtils.ts` | `todayISO()` — returns the current date as `YYYY-MM-DD`; `ISO_DATE_RE` — regex for validating date fields |

### State management

There is no global state store. Each page manages its own data with `useState` / `useEffect` / `useCallback`. Cross-cutting state (panel, form, errors, delete confirmation) is encapsulated in `useCrudPanel`. Employee list data is cached for the lifetime of a page mount via `useEmployees`.

## Testing

Tests live in `src/__tests__/`, mirroring the source tree:

```
src/__tests__/
  utils/
    dateUtils.test.ts
  hooks/
    useCrudPanel.test.tsx
    useEmployees.test.tsx
  components/
    ListState.test.tsx
    PanelFooter.test.tsx
    DeleteDialog.test.tsx
```

**Stack:** [Vitest](https://vitest.dev/) + [jsdom](https://github.com/jsdom/jsdom) + [@testing-library/react](https://testing-library.com/docs/react-testing-library/intro) + [@testing-library/user-event](https://testing-library.com/docs/user-event/intro/) + [@testing-library/jest-dom](https://testing-library.com/docs/ecosystem-jest-dom/).

**Test focus:** shared logic (hooks, utilities) and shared UI primitives (components). Individual page files are not unit-tested at this layer — their logic is covered by the Playwright smoke tests in `tests/`.

**Notable constraint:** Fluent UI's `Dialog` renders non-`DialogFooter` children into a separate portal that jsdom does not fully support. `ErrorBar` inside `DeleteDialog` is therefore smoke-tested (no crash) rather than content-tested; `ErrorBar` itself has its behavior validated through `DeleteDialog`'s own tests at the unit level.
