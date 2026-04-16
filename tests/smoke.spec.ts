import { test, expect } from "@playwright/test";

/**
 * Smoke tests for Dales Operations.
 *
 * Structural and navigation checks that verify the app shell and all
 * MVP routes render correctly. These do NOT depend on specific data —
 * they pass whether or not a backend is reachable.
 */

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
        await expect(
            page.getByText("Loading summary…").or(
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
