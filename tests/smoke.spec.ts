import { test, expect } from "@playwright/test";

/**
 * Smoke tests for Dales Operations.
 *
 * These are structural / navigation checks — they do NOT depend on specific
 * data being present.  They verify that the app shell and key routes render
 * correctly and that the dashboard endpoint integration is wired up.
 */

test.describe("App shell", () => {
    test("loads and shows navigation links", async ({ page }) => {
        await page.goto("/");
        // Core nav items should always be present regardless of data
        await expect(page.getByText("Dashboard").first()).toBeVisible();
        await expect(page.getByText("Employees").first()).toBeVisible();
        await expect(page.getByText("Tasks").first()).toBeVisible();
    });
});

test.describe("Dashboard route", () => {
    test("renders page heading", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByText("Dashboard").first()).toBeVisible();
    });

    test("shows summary cards or loading state", async ({ page }) => {
        await page.goto("/");
        // Either the spinner label OR a summary card title must eventually appear.
        // This passes whether or not a backend is reachable.
        await expect(
            page.getByText("Loading summary…").or(
                page.getByText("Active Employees")
            ).first()
        ).toBeVisible({ timeout: 10000 });
    });
});

test.describe("Employees route", () => {
    test("renders page heading", async ({ page }) => {
        await page.goto("/employees");
        await expect(page.getByText("Employees").first()).toBeVisible();
    });

    test("shows list, loading state, or empty state", async ({ page }) => {
        await page.goto("/employees");
        // One of these must appear — structural content, not data-dependent
        await expect(
            page.getByText("Loading employees…").or(
                page.getByText("No employees yet.")
            ).or(
                page.getByText("New Employee")
            ).first()
        ).toBeVisible({ timeout: 10000 });
    });
});

test.describe("Route navigation", () => {
    test("unknown route redirects to dashboard", async ({ page }) => {
        await page.goto("/not-a-real-route");
        await expect(page).toHaveURL("/");
        await expect(page.getByText("Dashboard").first()).toBeVisible();
    });
});
