import request from "supertest";
import { Server } from "http";
import { Express } from "express";
import { createApp } from "../app";
import { clearMockData } from "../models/cosmosClient";

/**
 * Integration tests for Dales Operations API routes.
 * All tests run against the in-memory mock (NODE_ENV=test).
 * The pattern is the same across all 6 collections, so we test
 * one full CRUD cycle per collection and share helper functions.
 */
describe("Dales Operations API", () => {
    let app: Express;
    let server: Server;

    beforeAll(async () => {
        process.env.NODE_ENV = "test";
        app = await createApp();
        server = app.listen(0); // use a random available port
    });

    afterAll((done) => {
        server.close(done);
    });

    beforeEach(() => {
        clearMockData();
    });

    // ---------------------------------------------------------------------------
    // Employees
    // ---------------------------------------------------------------------------
    describe("Employees", () => {
        it("POST /employees creates an employee and returns 201", async () => {
            const res = await post("/employees", { name: "Alice", role: "Shift Lead" });
            expect(res.status).toBe(201);
            expect(res.body).toMatchObject({ name: "Alice", role: "Shift Lead" });
            expect(res.body.id).toBeDefined();
        });

        it("GET /employees returns all employees", async () => {
            await post("/employees", { name: "Bob", role: "Associate" });
            await post("/employees", { name: "Carol", role: "Associate" });
            const res = await get("/employees");
            expect(res.status).toBe(200);
            expect(res.body.length).toBe(2);
        });

        it("GET /employees/:id returns a single employee", async () => {
            const created = (await post("/employees", { name: "Dave", role: "Manager" })).body;
            const res = await get(`/employees/${created.id}`);
            expect(res.status).toBe(200);
            expect(res.body.name).toBe("Dave");
        });

        it("GET /employees/:id returns 404 for unknown id", async () => {
            const res = await get("/employees/does-not-exist");
            expect(res.status).toBe(404);
        });

        it("PUT /employees/:id updates an employee", async () => {
            const created = (await post("/employees", { name: "Eve", role: "Associate" })).body;
            const res = await put(`/employees/${created.id}`, { name: "Eve Updated" });
            expect(res.status).toBe(200);
            expect(res.body.name).toBe("Eve Updated");
        });

        it("DELETE /employees/:id deletes and returns 204", async () => {
            const created = (await post("/employees", { name: "Frank", role: "Associate" })).body;
            const del = await del_(`/employees/${created.id}`);
            expect(del.status).toBe(204);
            expect((await get(`/employees/${created.id}`)).status).toBe(404);
        });
    });

    // ---------------------------------------------------------------------------
    // Tasks
    // ---------------------------------------------------------------------------
    describe("Tasks", () => {
        it("POST /tasks creates a task and returns 201", async () => {
            const res = await post("/tasks", { title: "Stock cereal aisle", status: "notStarted" });
            expect(res.status).toBe(201);
            expect(res.body.title).toBe("Stock cereal aisle");
            expect(res.body.status).toBe("notStarted");
        });

        it("GET /tasks returns all tasks", async () => {
            await post("/tasks", { title: "Task A", status: "notStarted" });
            await post("/tasks", { title: "Task B", status: "inProgress" });
            const res = await get("/tasks");
            expect(res.status).toBe(200);
            expect(res.body.length).toBe(2);
        });

        it("PUT /tasks/:id updates task status", async () => {
            const created = (await post("/tasks", { title: "Zone aisle 5", status: "notStarted" })).body;
            const res = await put(`/tasks/${created.id}`, { status: "completed" });
            expect(res.status).toBe(200);
            expect(res.body.status).toBe("completed");
        });

        it("DELETE /tasks/:id returns 204", async () => {
            const created = (await post("/tasks", { title: "Old task", status: "notStarted" })).body;
            expect((await del_(`/tasks/${created.id}`)).status).toBe(204);
        });
    });

    // ---------------------------------------------------------------------------
    // Productivity
    // ---------------------------------------------------------------------------
    describe("Productivity", () => {
        it("POST /productivity creates a record", async () => {
            const res = await post("/productivity", {
                employeeId: "emp-1",
                date: "2026-04-14",
                freightStocked: 45,
            });
            expect(res.status).toBe(201);
            expect(res.body.freightStocked).toBe(45);
        });

        it("GET /productivity returns all records", async () => {
            await post("/productivity", { employeeId: "emp-1", date: "2026-04-14" });
            const res = await get("/productivity");
            expect(res.status).toBe(200);
            expect(res.body.length).toBe(1);
        });
    });

    // ---------------------------------------------------------------------------
    // Coaching
    // ---------------------------------------------------------------------------
    describe("Coaching", () => {
        it("POST /coaching creates a coaching record", async () => {
            const res = await post("/coaching", {
                employeeId: "emp-1",
                date: "2026-04-14",
                issues: ["attendance"],
                goals: "Improve punctuality",
            });
            expect(res.status).toBe(201);
            expect(res.body.issues).toContain("attendance");
        });

        it("PUT /coaching/:id updates a record", async () => {
            const created = (await post("/coaching", { employeeId: "emp-2", date: "2026-04-14" })).body;
            const res = await put(`/coaching/${created.id}`, { goals: "New goal" });
            expect(res.status).toBe(200);
            expect(res.body.goals).toBe("New goal");
        });
    });

    // ---------------------------------------------------------------------------
    // Issues
    // ---------------------------------------------------------------------------
    describe("Issues", () => {
        it("POST /issues creates an issue", async () => {
            const res = await post("/issues", { type: "Safety", status: "open", date: "2026-04-14" });
            expect(res.status).toBe(201);
            expect(res.body.status).toBe("open");
        });

        it("PUT /issues/:id can mark an issue resolved", async () => {
            const created = (await post("/issues", { type: "Equipment", status: "open", date: "2026-04-14" })).body;
            const res = await put(`/issues/${created.id}`, { status: "resolved" });
            expect(res.status).toBe(200);
            expect(res.body.status).toBe("resolved");
        });
    });

    // ---------------------------------------------------------------------------
    // Summaries
    // ---------------------------------------------------------------------------
    describe("Summaries", () => {
        it("POST /summaries creates a daily summary", async () => {
            const res = await post("/summaries", {
                date: "2026-04-14",
                completedWork: "Stocked dairy and frozen",
                missedWork: "Did not finish pet aisle",
            });
            expect(res.status).toBe(201);
            expect(res.body.date).toBe("2026-04-14");
        });

        it("GET /summaries returns all summaries", async () => {
            await post("/summaries", { date: "2026-04-14" });
            await post("/summaries", { date: "2026-04-13" });
            const res = await get("/summaries");
            expect(res.status).toBe(200);
            expect(res.body.length).toBe(2);
        });
    });

    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------
    const get  = (path: string) => request(app).get(path);
    const post = (path: string, body: object) => request(app).post(path).send(body);
    const put  = (path: string, body: object) => request(app).put(path).send(body);
    const del_ = (path: string) => request(app).delete(path);
});
