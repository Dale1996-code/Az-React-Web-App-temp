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
                page.getByText("New Entry")
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

    test("GET /dashboard returns 200 with valid shape (safe for empty database)", async ({ request }) => {
        const response = await request.get(`${API_BASE_URL}/dashboard`);
        expect(response.status()).toBe(200);
        const body = await response.json();
        // Top-level fields must always be present, regardless of data volume.
        expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(typeof body.taskCounts).toBe("object");
        expect(typeof body.taskCounts.notStarted).toBe("number");
        expect(typeof body.taskCounts.inProgress).toBe("number");
        expect(typeof body.taskCounts.completed).toBe("number");
        expect(typeof body.activeEmployeesCount).toBe("number");
        expect(typeof body.openIssuesCount).toBe("number");
        expect(typeof body.coachingFollowUpsDueCount).toBe("number");
        expect(typeof body.productivitySnapshot).toBe("object");
        expect(typeof body.productivitySnapshot.recordsLogged).toBe("number");
        expect(typeof body.productivitySnapshot.totalUnitsStocked).toBe("number");
        // urgentTasks / recentOpenIssues / upcomingFollowUps are arrays (may be empty)
        expect(Array.isArray(body.urgentTasks)).toBe(true);
        expect(Array.isArray(body.recentOpenIssues)).toBe(true);
        expect(Array.isArray(body.upcomingFollowUps)).toBe(true);
        // latestSummary is either null or an object — both are valid on empty DB
        expect(body.latestSummary === null || typeof body.latestSummary === "object").toBe(true);
    });
});

// ── API connectivity — browser-side check ────────────────────────────────────
//
// Proves the frontend is not just rendering shell chrome while the API fails.
// The dashboard calls /dashboard on mount; we intercept that response through
// the browser and also assert that the resolved UI section ("Shift Overview")
// appears — a section that only renders after a successful API response, even
// when the database is empty.

test.describe("Frontend ↔ API integration", () => {
    test("dashboard receives a successful API response and renders resolved content", async ({ page }) => {
        // Arm the interceptor before navigation so we don't miss the request.
        const dashboardApiCall = page.waitForResponse(
            (resp) =>
                resp.url().includes("/dashboard") &&
                resp.request().method() === "GET",
            { timeout: 15000 },
        );

        await page.goto("/");

        const apiResponse = await dashboardApiCall;

        // The browser-level request to the API must succeed.
        expect(apiResponse.status()).toBe(200);
        const body = await apiResponse.json();
        expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        // "Shift Overview" is only rendered when !loading && summary — it never
        // appears in the loading state or the error state, so its presence proves
        // the frontend consumed a successful API response.
        await expect(page.getByText("Shift Overview")).toBeVisible({ timeout: 15000 });
    });
});
