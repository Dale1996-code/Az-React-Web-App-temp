import express, { Router } from "express";
import { BaseRepository } from "../models/baseRepository";
import { Employee } from "../models/employee";
import { Task } from "../models/task";
import { IssueLog } from "../models/issue";
import { CoachingRecord } from "../models/coaching";
import { getContainer } from "../models/cosmosClient";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const router: Router = express.Router();

/**
 * GET /dashboard?date=YYYY-MM-DD
 *
 * Returns a lightweight shift-day summary.  All fields are counts — no lists,
 * no trends.  The frontend uses this to populate summary cards.
 *
 * date (defaults to today):
 *   taskCounts                — { notStarted, inProgress, completed } for tasks on that storeDate
 *   openIssuesCount           — issues where status = "open" (all dates)
 *   coachingFollowUpsDueCount — coaching records where followUpDate <= date
 *   activeEmployeesCount      — employees where isActive = true
 */
router.get("/", async (req, res) => {
    const rawDate = typeof req.query.date === "string" ? req.query.date : "";
    const date = ISO_DATE_RE.test(rawDate)
        ? rawDate
        : new Date().toISOString().slice(0, 10);

    try {
        const [employees, tasks, issues, coaching] = await Promise.all([
            new BaseRepository<Employee>(getContainer("employees")).findAll(),
            new BaseRepository<Task>(getContainer("tasks")).findAll(),
            new BaseRepository<IssueLog>(getContainer("issues")).findAll(),
            new BaseRepository<CoachingRecord>(getContainer("coaching")).findAll(),
        ]);

        const dayTasks = tasks.filter(t => t.storeDate === date);
        const taskCounts = {
            notStarted: dayTasks.filter(t => t.status === "notStarted").length,
            inProgress:  dayTasks.filter(t => t.status === "inProgress").length,
            completed:   dayTasks.filter(t => t.status === "completed").length,
        };

        const openIssuesCount = issues.filter(i => i.status === "open").length;

        // Due = followUpDate is set and falls on or before the requested date
        const coachingFollowUpsDueCount = coaching.filter(
            c => typeof c.followUpDate === "string" && c.followUpDate <= date,
        ).length;

        const activeEmployeesCount = employees.filter(e => e.isActive).length;

        res.json({
            date,
            taskCounts,
            openIssuesCount,
            coachingFollowUpsDueCount,
            activeEmployeesCount,
        });
    } catch (err) {
        console.error("Error fetching dashboard summary:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
