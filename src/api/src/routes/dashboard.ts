import express, { Router } from "express";
import { logger } from "../config/observability";
import { BaseRepository } from "../models/baseRepository";
import { Employee } from "../models/employee";
import { Task } from "../models/task";
import { IssueLog } from "../models/issue";
import { CoachingRecord } from "../models/coaching";
import { ProductivityRecord } from "../models/productivity";
import { DailySummary } from "../models/summary";
import { getContainer } from "../models/cosmosClient";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const router: Router = express.Router();

/**
 * GET /dashboard?date=YYYY-MM-DD
 *
 * Returns a shift-day overview for the Dashboard page.
 * Includes counts, recent items, and snapshot data from all slices.
 */
router.get("/", async (req, res) => {
    const rawDate = typeof req.query.date === "string" ? req.query.date : "";
    const date = ISO_DATE_RE.test(rawDate)
        ? rawDate
        : new Date().toISOString().slice(0, 10);

    try {
        const [employees, tasks, issues, coaching, productivity, summaries] = await Promise.all([
            new BaseRepository<Employee>(getContainer("employees")).findAll(),
            new BaseRepository<Task>(getContainer("tasks")).findAll(),
            new BaseRepository<IssueLog>(getContainer("issues")).findAll(),
            new BaseRepository<CoachingRecord>(getContainer("coaching")).findAll(),
            new BaseRepository<ProductivityRecord>(getContainer("productivity")).findAll(),
            new BaseRepository<DailySummary>(getContainer("summaries")).findAll(),
        ]);

        // ── Task counts for the requested date ────────────────────────────
        const dayTasks = tasks.filter(t => t.storeDate === date);
        const taskCounts = {
            notStarted: dayTasks.filter(t => t.status === "notStarted").length,
            inProgress: dayTasks.filter(t => t.status === "inProgress").length,
            completed:  dayTasks.filter(t => t.status === "completed").length,
        };

        // High-priority incomplete tasks for the day (up to 5)
        const urgentTasks = dayTasks
            .filter(t => t.priority === "high" && t.status !== "completed")
            .slice(0, 5)
            .map(t => ({ id: t.id, title: t.title, status: t.status, dueTime: t.dueTime }));

        // ── Open issues (all dates) ───────────────────────────────────────
        const openIssues = issues.filter(i => i.status === "open");
        const openIssuesCount = openIssues.length;

        // Most recent open issues (up to 5), sorted newest first by storeDate
        const recentOpenIssues = openIssues
            .sort((a, b) => b.storeDate.localeCompare(a.storeDate))
            .slice(0, 5)
            .map(i => ({
                id: i.id,
                category: i.category,
                department: i.department,
                description: i.description,
                storeDate: i.storeDate,
            }));

        // ── Coaching follow-ups due on or before the date ─────────────────
        const followUpsDue = coaching.filter(
            c => typeof c.followUpDate === "string" && c.followUpDate <= date,
        );
        const coachingFollowUpsDueCount = followUpsDue.length;

        // Build employee lookup for names
        const empMap = new Map(employees.map(e => [e.id, e]));

        // Recent coaching follow-ups (up to 5), sorted by followUpDate ascending (most overdue first)
        const upcomingFollowUps = followUpsDue
            .sort((a, b) => (a.followUpDate ?? "").localeCompare(b.followUpDate ?? ""))
            .slice(0, 5)
            .map(c => {
                const emp = empMap.get(c.employeeId);
                return {
                    id: c.id,
                    employeeName: emp ? `${emp.firstName} ${emp.lastName}` : c.employeeId,
                    topic: c.topic,
                    followUpDate: c.followUpDate,
                };
            });

        // ── Active employees ──────────────────────────────────────────────
        const activeEmployeesCount = employees.filter(e => e.isActive).length;

        // ── Productivity snapshot for the day ─────────────────────────────
        const dayProductivity = productivity.filter(p => p.storeDate === date);
        const totalUnitsStocked = dayProductivity.reduce(
            (sum, p) => sum + (p.freightStockedUnits ?? 0), 0,
        );
        const productivitySnapshot = {
            recordsLogged: dayProductivity.length,
            totalUnitsStocked,
        };

        // ── Latest daily summary for the date (or most recent before it) ─
        const dateSummaries = summaries.filter(s => s.storeDate === date);
        // If none for today, find the most recent one overall
        const bestSummary = dateSummaries.length > 0
            ? dateSummaries[0]
            : summaries
                .filter(s => s.storeDate <= date)
                .sort((a, b) => b.storeDate.localeCompare(a.storeDate))[0] ?? null;

        const latestSummary = bestSummary
            ? {
                id: bestSummary.id,
                storeDate: bestSummary.storeDate,
                shiftLabel: bestSummary.shiftLabel,
                completedWork: bestSummary.completedWork,
                missedWork: bestSummary.missedWork,
                followUpItems: bestSummary.followUpItems,
            }
            : null;

        res.json({
            date,
            taskCounts,
            urgentTasks,
            openIssuesCount,
            recentOpenIssues,
            coachingFollowUpsDueCount,
            upcomingFollowUps,
            activeEmployeesCount,
            productivitySnapshot,
            latestSummary,
        });
    } catch (err) {
        logger.error(`[dashboard] GET /dashboard?date=${date} 500 – ${err instanceof Error ? err.message : String(err)}`);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
