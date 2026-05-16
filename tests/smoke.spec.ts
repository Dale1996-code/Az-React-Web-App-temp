import { test, expect } from "@playwright/test";

/**
 * Smoke tests for Dales Operations.
 *
 * Two layers of coverage:
 *
 * 1. Route-shell checks — verify the app shell and every MVP route render
 *    their heading and reach a stable state (loading / empty / list).
 *    These pass whether or not a backend is reachable.
 *
 * 2. API connectivity checks — hit the deployed API directly and through
 *    the browser to prove the frontend is not just showing chrome while
 *    the backend is broken.  All checks are read-only and safe for an
 *    empty database.
 */

// API base URL: set REACT_APP_API_BASE_URL in CI; falls back to local dev default.
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:3100";

// ── App shell ────────────────────────────────────────────────────────────────

test.describe("App shell", () => {
    test("loads and shows all navigation links", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByText("Dashboard").first()).toBeVisible();
        await expect(page.getByText("Employees").first()).toBeVisible();
        await expect(page.getByText("Tasks").first()).toBeVisible();
        await expect(page.getByText("Productivity").first()).toBeVisible();
        await expect(page.getByText("Coaching").first()).toBeVisible();
        await expect(page.getByText("Issues").first()).toBeVisible();
        await expect(page.getByText("Daily Summary").first()).toBeVisible();
    });
});

// ── Dashboard ────────────────────────────────────────────────────────────────

test.describe("Dashboard route", () => {
    test("renders page heading", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByText("Dashboard").first()).toBeVisible();
    });

    test("shows summary cards or loading state", async ({ page }) => {
        await page.goto("/");
        // The loading label must match DashboardPage.tsx. "Active Employees"
        // appears only after the /dashboard API call resolves — accepting
        // either keeps this route-shell check non-flaky on slow backends.
        await expect(
            page.getByText("Loading dashboard…").or(
                page.getByText("Active Employees")
            ).first()
        ).toBeVisible({ timeout: 10000 });
    });
});

// ── Employees ────────────────────────────────────────────────────────────────

test.describe("Employees route", () => {
    test("renders page heading", async ({ page }) => {
        await page.goto("/employees");
        await expect(page.getByText("Employees").first()).toBeVisible();
    });

    test("shows list, loading state, or empty state", async ({ page }) => {
        await page.goto("/employees");
        await expect(
            page.getByText("Loading employees…").or(
                page.getByText("No employees yet.")
            ).or(
                page.getByText("New Employee")
            ).first()
        ).toBeVisible({ timeout: 10000 });
    });
});

// ── Tasks ────────────────────────────────────────────────────────────────────

test.describe("Tasks route", () => {
    test("renders page heading", async ({ page }) => {
        await page.goto("/tasks");
        await expect(page.getByText("Tasks").first()).toBeVisible();
    });

    test("shows list, loading state, or create button", async ({ page }) => {
        await page.goto("/tasks");
        await expect(
            page.getByText("Loading tasks…").or(
                page.getByText("Create a task")
            ).or(
                page.getByText("New Task")
            ).first()
        ).toBeVisible({ timeout: 10000 });
    });
});

// ── Productivity ─────────────────────────────────────────────────────────────

test.describe("Productivity route", () => {
    test("renders page heading", async ({ page }) => {
        await page.goto("/productivity");
        await expect(page.getByText("Productivity").first()).toBeVisible();
    });

    test("shows list, loading state, or create button", async ({ page }) => {
        await page.goto("/productivity");
        await expect(
            page.getByText("Loading productivity records…").or(
                page.getByText("Add first entry")
            ).or(
                page.getByText("New Entry")
            ).first()
        ).toBeVisible({ timeout: 10000 });
    });
});

// ── Coaching ─────────────────────────────────────────────────────────────────

test.describe("Coaching route", () => {
    test("renders page heading", async ({ page }) => {
        await page.goto("/coaching");
        await expect(page.getByText("Coaching").first()).toBeVisible();
    });

    test("shows list, loading state, or create button", async ({ page }) => {
        await page.goto("/coaching");
        await expect(
            page.getByText("Loading coaching records…").or(
                page.getByText("New Record")
            ).first()
        ).toBeVisible({ timeout: 10000 });
    });
});

// ── Issues ───────────────────────────────────────────────────────────────────

test.describe("Issues route", () => {
    test("renders page heading", async ({ page }) => {
        await page.goto("/issues");
        await expect(page.getByText("Issues").first()).toBeVisible();
    });

    test("shows list, loading state, or create button", async ({ page }) => {
        await page.goto("/issues");
        await expect(
            page.getByText("Loading issues…").or(
                page.getByText("Log first issue")
            ).or(
                page.getByText("Log Issue")
            ).first()
        ).toBeVisible({ timeout: 10000 });
    });
});

// ── Daily Summary ────────────────────────────────────────────────────────────

test.describe("Daily Summary route", () => {
    test("renders page heading", async ({ page }) => {
        await page.goto("/summary");
        await expect(page.getByText("Daily Summary").first()).toBeVisible();
    });

    test("shows list, loading state, or create button", async ({ page }) => {
        await page.goto("/summary");
        await expect(
            page.getByText("Loading summaries…").or(
                page.getByText("Create first summary")
            ).or(
                page.getByText("New Summary")
            ).first()
        ).toBeVisible({ timeout: 10000 });
    });
});

// ── Route navigation ─────────────────────────────────────────────────────────

test.describe("Route navigation", () => {
    test("unknown route redirects to dashboard", async ({ page }) => {
        await page.goto("/not-a-real-route");
        await expect(page).toHaveURL("/");
        await expect(page.getByText("Dashboard").first()).toBeVisible();
    });

    test("nav links navigate between all routes", async ({ page }) => {
        await page.goto("/");

        const routes = [
            { nav: "Employees",     url: "/employees" },
            { nav: "Tasks",         url: "/tasks" },
            { nav: "Productivity",  url: "/productivity" },
            { nav: "Coaching",      url: "/coaching" },
            { nav: "Issues",        url: "/issues" },
            { nav: "Daily Summary", url: "/summary" },
            { nav: "Dashboard",     url: "/" },
        ];

        for (const route of routes) {
            await page.getByText(route.nav, { exact: true }).first().click();
            await expect(page).toHaveURL(route.url);
        }
    });
});

// ── API connectivity — direct checks ─────────────────────────────────────────
//
// These tests call the API from the test runner (not through the browser) so
// CORS is not a factor.  They fail the build if the API is unreachable or
// returns an unexpected shape, even when every frontend route looks fine.
//
// End-user authentication is currently disabled, so every endpoint is open.

test.describe("API connectivity", () => {
    test("GET /health returns 200 with expected shape", async ({ request }) => {
        const response = await request.get(`${API_BASE_URL}/health`);
        expect(response.status()).toBe(200);
        const body = await response.json();
        // { status: "ok", timestamp: "<ISO string>" }
        expect(body.status).toBe("ok");
        expect(typeof body.timestamp).toBe("string");
        expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    test("GET /dashboard returns 200 with valid shape", async ({ request }) => {
        const response = await request.get(`${API_BASE_URL}/dashboard`);
        expect(response.status()).toBe(200);

        // All numeric fields can be zero (safe against an empty database).
        const body = await response.json() as Record<string, unknown>;

        expect(body.date, "dashboard.date must be a YYYY-MM-DD string")
            .toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(typeof body.activeEmployeesCount, "dashboard.activeEmployeesCount must be a number")
            .toBe("number");
        expect(typeof body.openIssuesCount, "dashboard.openIssuesCount must be a number")
            .toBe("number");
        expect(typeof body.coachingFollowUpsDueCount, "dashboard.coachingFollowUpsDueCount must be a number")
            .toBe("number");

        const tc = body.taskCounts as Record<string, unknown>;
        expect(tc,                   "dashboard.taskCounts must be present").toBeTruthy();
        expect(typeof tc.notStarted, "taskCounts.notStarted must be a number").toBe("number");
        expect(typeof tc.inProgress, "taskCounts.inProgress must be a number").toBe("number");
        expect(typeof tc.completed,  "taskCounts.completed must be a number").toBe("number");

        expect(Array.isArray(body.urgentTasks),       "dashboard.urgentTasks must be an array").toBe(true);
        expect(Array.isArray(body.recentOpenIssues),  "dashboard.recentOpenIssues must be an array").toBe(true);
        expect(Array.isArray(body.upcomingFollowUps), "dashboard.upcomingFollowUps must be an array").toBe(true);

        const ps = body.productivitySnapshot as Record<string, unknown>;
        expect(ps,                          "dashboard.productivitySnapshot must be present").toBeTruthy();
        expect(typeof ps.recordsLogged,     "productivitySnapshot.recordsLogged must be a number").toBe("number");
        expect(typeof ps.totalUnitsStocked, "productivitySnapshot.totalUnitsStocked must be a number").toBe("number");
    });
});

// ── API connectivity — browser-side check ────────────────────────────────────
//
// Proves the frontend reaches the API and the page shell renders, then
// verifies the dashboard response shape and the resolved UI.

test.describe("Frontend ↔ API integration", () => {
    test("dashboard page shell renders and API is reachable", async ({ page }) => {
        // Arm the interceptor before navigation so we don't miss the request.
        // Match the full API origin to avoid catching Vite's module request for
        // dashboardService.ts, whose URL also contains "/dashboard".
        const dashboardApiCall = page.waitForResponse(
            (resp) =>
                resp.url().startsWith(`${API_BASE_URL}/dashboard`) &&
                resp.request().method() === "GET",
            { timeout: 15000 },
        );

        await page.goto("/");

        // The page heading must always render.
        await expect(page.getByText("Dashboard").first()).toBeVisible();

        const apiResponse = await dashboardApiCall;
        expect(apiResponse.status()).toBe(200);

        const body = await apiResponse.json();
        expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        // "Shift Overview" only renders after a successful API response.
        await expect(page.getByText("Shift Overview")).toBeVisible({ timeout: 15000 });
    });
});
