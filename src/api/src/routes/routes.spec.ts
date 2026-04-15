import request from "supertest";
import { Server } from "http";
import { Express } from "express";
import { createApp } from "../app";
import { clearMockData } from "../models/cosmosClient";

/**
 * Integration tests for Dales Operations API routes.
 * All tests run against the in-memory mock (NODE_ENV=test).
 *
 * Each collection has:
 *   - A full CRUD happy-path cycle
 *   - Validation rejection tests (missing required fields, bad enum values, etc.)
 */
describe("Dales Operations API", () => {
    let app: Express;
    let server: Server;

    beforeAll(async () => {
        process.env.NODE_ENV = "test";
        app = await createApp();
        server = app.listen(0);
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
        const validEmployee = {
            firstName: "Alice",
            lastName: "Smith",
            role: "Shift Lead",
            isActive: true,
        };

        it("POST /employees creates an employee and returns 201", async () => {
            const res = await post("/employees", validEmployee);
            expect(res.status).toBe(201);
            expect(res.body).toMatchObject({ firstName: "Alice", lastName: "Smith", role: "Shift Lead", isActive: true });
            expect(res.body.id).toBeDefined();
        });

        it("GET /employees returns all employees", async () => {
            await post("/employees", validEmployee);
            await post("/employees", { firstName: "Bob", lastName: "Jones", role: "Associate", isActive: true });
            const res = await get("/employees");
            expect(res.status).toBe(200);
            expect(res.body.length).toBe(2);
        });

        it("GET /employees/:id returns a single employee", async () => {
            const created = (await post("/employees", validEmployee)).body;
            const res = await get(`/employees/${created.id}`);
            expect(res.status).toBe(200);
            expect(res.body.firstName).toBe("Alice");
        });

        it("GET /employees/:id returns 404 for unknown id", async () => {
            const res = await get("/employees/does-not-exist");
            expect(res.status).toBe(404);
        });

        it("PUT /employees/:id updates an employee", async () => {
            const created = (await post("/employees", validEmployee)).body;
            const res = await put(`/employees/${created.id}`, { isActive: false });
            expect(res.status).toBe(200);
            expect(res.body.isActive).toBe(false);
        });

        it("DELETE /employees/:id deletes and returns 204", async () => {
            const created = (await post("/employees", validEmployee)).body;
            expect((await del_(`/employees/${created.id}`)).status).toBe(204);
            expect((await get(`/employees/${created.id}`)).status).toBe(404);
        });

        it("POST /employees strips unknown fields", async () => {
            const res = await post("/employees", { ...validEmployee, hackerField: "x" });
            expect(res.status).toBe(201);
            expect(res.body.hackerField).toBeUndefined();
        });

        it("POST /employees returns 400 when firstName is missing", async () => {
            const res = await post("/employees", { lastName: "Smith", role: "Lead", isActive: true });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe("Validation failed");
            expect(res.body.details).toEqual(expect.arrayContaining([expect.stringContaining("firstName")]));
        });

        it("POST /employees returns 400 when isActive is not boolean", async () => {
            const res = await post("/employees", { firstName: "A", lastName: "B", role: "Lead", isActive: "yes" });
            expect(res.status).toBe(400);
            expect(res.body.details).toEqual(expect.arrayContaining([expect.stringContaining("isActive")]));
        });

        it("GET /employees?active=false returns only inactive employees", async () => {
            await post("/employees", validEmployee);
            await post("/employees", { firstName: "Bob", lastName: "Jones", role: "Associate", isActive: false });
            const res = await get("/employees?active=false");
            expect(res.status).toBe(200);
            expect(res.body.length).toBe(1);
            expect(res.body[0].firstName).toBe("Bob");
        });

        it("GET /employees?department= filters by department", async () => {
            await post("/employees", { ...validEmployee, department: "Grocery" });
            await post("/employees", { firstName: "Bob", lastName: "Jones", role: "Associate", isActive: true, department: "Produce" });
            const res = await get("/employees?department=Grocery");
            expect(res.status).toBe(200);
            expect(res.body.length).toBe(1);
            expect(res.body[0].department).toBe("Grocery");
        });

        it("GET /employees?search= filters by name", async () => {
            await post("/employees", validEmployee);
            await post("/employees", { firstName: "Bob", lastName: "Jones", role: "Associate", isActive: true });
            const res = await get("/employees?search=alice");
            expect(res.status).toBe(200);
            expect(res.body.length).toBe(1);
            expect(res.body[0].firstName).toBe("Alice");
        });
    });

    // ---------------------------------------------------------------------------
    // Tasks
    // ---------------------------------------------------------------------------
    describe("Tasks", () => {
        const validTask = {
            title: "Stock cereal aisle",
            status: "notStarted",
            storeDate: "2026-04-14",
            department: "Grocery",
        };

        it("POST /tasks creates a task and returns 201", async () => {
            const res = await post("/tasks", validTask);
            expect(res.status).toBe(201);
            expect(res.body.title).toBe("Stock cereal aisle");
            expect(res.body.status).toBe("notStarted");
            expect(res.body.storeDate).toBe("2026-04-14");
        });

        it("GET /tasks returns all tasks", async () => {
            await post("/tasks", validTask);
            await post("/tasks", { ...validTask, title: "Task B", status: "inProgress" });
            const res = await get("/tasks");
            expect(res.status).toBe(200);
            expect(res.body.length).toBe(2);
        });

        it("PUT /tasks/:id updates task status", async () => {
            const created = (await post("/tasks", validTask)).body;
            const res = await put(`/tasks/${created.id}`, { status: "completed" });
            expect(res.status).toBe(200);
            expect(res.body.status).toBe("completed");
        });

        it("DELETE /tasks/:id returns 204", async () => {
            const created = (await post("/tasks", validTask)).body;
            expect((await del_(`/tasks/${created.id}`)).status).toBe(204);
        });

        it("POST /tasks returns 400 when storeDate is missing", async () => {
            const res = await post("/tasks", { title: "Test", status: "notStarted", department: "Grocery" });
            expect(res.status).toBe(400);
            expect(res.body.details).toEqual(expect.arrayContaining([expect.stringContaining("storeDate")]));
        });

        it("POST /tasks returns 400 when storeDate has wrong format", async () => {
            const res = await post("/tasks", { ...validTask, storeDate: "14/04/2026" });
            expect(res.status).toBe(400);
            expect(res.body.details).toEqual(expect.arrayContaining([expect.stringContaining("storeDate")]));
        });

        it("POST /tasks returns 400 for invalid status", async () => {
            const res = await post("/tasks", { ...validTask, status: "done" });
            expect(res.status).toBe(400);
            expect(res.body.details).toEqual(expect.arrayContaining([expect.stringContaining("status")]));
        });

        it("POST /tasks returns 400 for invalid priority", async () => {
            const res = await post("/tasks", { ...validTask, priority: "urgent" });
            expect(res.status).toBe(400);
            expect(res.body.details).toEqual(expect.arrayContaining([expect.stringContaining("priority")]));
        });

        it("POST /tasks returns 400 when department is missing", async () => {
            const res = await post("/tasks", { title: "Test", status: "notStarted", storeDate: "2026-04-14" });
            expect(res.status).toBe(400);
            expect(res.body.details).toEqual(expect.arrayContaining([expect.stringContaining("department")]));
        });
    });

    // ---------------------------------------------------------------------------
    // Productivity
    // ---------------------------------------------------------------------------
    describe("Productivity", () => {
        const validRecord = { employeeId: "emp-1", storeDate: "2026-04-14" };

        it("POST /productivity creates a record", async () => {
            const res = await post("/productivity", { ...validRecord, freightStockedUnits: 45 });
            expect(res.status).toBe(201);
            expect(res.body.freightStockedUnits).toBe(45);
            expect(res.body.storeDate).toBe("2026-04-14");
        });

        it("GET /productivity returns all records", async () => {
            await post("/productivity", validRecord);
            const res = await get("/productivity");
            expect(res.status).toBe(200);
            expect(res.body.length).toBe(1);
        });

        it("POST /productivity returns 400 when storeDate is missing", async () => {
            const res = await post("/productivity", { employeeId: "emp-1" });
            expect(res.status).toBe(400);
            expect(res.body.details).toEqual(expect.arrayContaining([expect.stringContaining("storeDate")]));
        });

        it("POST /productivity returns 400 for negative freightStockedUnits", async () => {
            const res = await post("/productivity", { ...validRecord, freightStockedUnits: -1 });
            expect(res.status).toBe(400);
            expect(res.body.details).toEqual(expect.arrayContaining([expect.stringContaining("freightStockedUnits")]));
        });

        it("POST /productivity returns 400 for negative breakMinutes", async () => {
            const res = await post("/productivity", { ...validRecord, breakMinutes: -5 });
            expect(res.status).toBe(400);
            expect(res.body.details).toEqual(expect.arrayContaining([expect.stringContaining("breakMinutes")]));
        });
    });

    // ---------------------------------------------------------------------------
    // Coaching
    // ---------------------------------------------------------------------------
    describe("Coaching", () => {
        const validCoaching = {
            employeeId: "emp-1",
            storeDate: "2026-04-14",
            topic: "Attendance",
        };

        it("POST /coaching creates a coaching record", async () => {
            const res = await post("/coaching", {
                ...validCoaching,
                issues: ["attendance"],
                goals: "Improve punctuality",
            });
            expect(res.status).toBe(201);
            expect(res.body.topic).toBe("Attendance");
            expect(res.body.issues).toContain("attendance");
        });

        it("PUT /coaching/:id updates a record", async () => {
            const created = (await post("/coaching", validCoaching)).body;
            const res = await put(`/coaching/${created.id}`, { goals: "New goal" });
            expect(res.status).toBe(200);
            expect(res.body.goals).toBe("New goal");
        });

        it("POST /coaching returns 400 when topic is missing", async () => {
            const res = await post("/coaching", { employeeId: "emp-1", storeDate: "2026-04-14" });
            expect(res.status).toBe(400);
            expect(res.body.details).toEqual(expect.arrayContaining([expect.stringContaining("topic")]));
        });

        it("POST /coaching returns 400 when issues is not an array", async () => {
            const res = await post("/coaching", { ...validCoaching, issues: "attendance" });
            expect(res.status).toBe(400);
            expect(res.body.details).toEqual(expect.arrayContaining([expect.stringContaining("issues")]));
        });

        it("POST /coaching returns 400 for bad followUpDate format", async () => {
            const res = await post("/coaching", { ...validCoaching, followUpDate: "next-week" });
            expect(res.status).toBe(400);
            expect(res.body.details).toEqual(expect.arrayContaining([expect.stringContaining("followUpDate")]));
        });
    });

    // ---------------------------------------------------------------------------
    // Issues
    // ---------------------------------------------------------------------------
    describe("Issues", () => {
        const validIssue = {
            storeDate: "2026-04-14",
            category: "Safety",
            status: "open",
            department: "Receiving",
            description: "Spill on receiving dock.",
        };

        it("POST /issues creates an issue", async () => {
            const res = await post("/issues", validIssue);
            expect(res.status).toBe(201);
            expect(res.body.status).toBe("open");
            expect(res.body.category).toBe("Safety");
        });

        it("PUT /issues/:id can mark an issue resolved", async () => {
            const created = (await post("/issues", validIssue)).body;
            const res = await put(`/issues/${created.id}`, { status: "resolved" });
            expect(res.status).toBe(200);
            expect(res.body.status).toBe("resolved");
        });

        it("POST /issues returns 400 when description is missing", async () => {
            const { description, ...noDesc } = validIssue;
            const res = await post("/issues", noDesc);
            expect(res.status).toBe(400);
            expect(res.body.details).toEqual(expect.arrayContaining([expect.stringContaining("description")]));
        });

        it("POST /issues returns 400 for invalid status", async () => {
            const res = await post("/issues", { ...validIssue, status: "pending" });
            expect(res.status).toBe(400);
            expect(res.body.details).toEqual(expect.arrayContaining([expect.stringContaining("status")]));
        });

        it("POST /issues returns 400 when category is missing", async () => {
            const { category, ...noCat } = validIssue;
            const res = await post("/issues", noCat);
            expect(res.status).toBe(400);
            expect(res.body.details).toEqual(expect.arrayContaining([expect.stringContaining("category")]));
        });
    });

    // ---------------------------------------------------------------------------
    // Summaries
    // ---------------------------------------------------------------------------
    describe("Summaries", () => {
        const validSummary = {
            storeDate: "2026-04-14",
            shiftLabel: "closing",
        };

        it("POST /summaries creates a daily summary", async () => {
            const res = await post("/summaries", {
                ...validSummary,
                completedWork: "Stocked dairy and frozen",
                missedWork: "Did not finish pet aisle",
            });
            expect(res.status).toBe(201);
            expect(res.body.storeDate).toBe("2026-04-14");
            expect(res.body.shiftLabel).toBe("closing");
        });

        it("GET /summaries returns all summaries", async () => {
            await post("/summaries", validSummary);
            await post("/summaries", { storeDate: "2026-04-13", shiftLabel: "morning" });
            const res = await get("/summaries");
            expect(res.status).toBe(200);
            expect(res.body.length).toBe(2);
        });

        it("POST /summaries returns 400 when shiftLabel is missing", async () => {
            const res = await post("/summaries", { storeDate: "2026-04-14" });
            expect(res.status).toBe(400);
            expect(res.body.details).toEqual(expect.arrayContaining([expect.stringContaining("shiftLabel")]));
        });

        it("POST /summaries returns 400 when storeDate is not YYYY-MM-DD", async () => {
            const res = await post("/summaries", { storeDate: "April 14", shiftLabel: "morning" });
            expect(res.status).toBe(400);
            expect(res.body.details).toEqual(expect.arrayContaining([expect.stringContaining("storeDate")]));
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
