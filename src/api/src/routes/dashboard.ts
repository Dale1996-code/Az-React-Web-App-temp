import express, { Router } from "express";
import { logger } from "../config/observability";
import { BaseRepository, FilterCondition } from "../models/baseRepository";
import { Employee } from "../models/employee";
import { Task } from "../models/task";
import { IssueLog } from "../models/issue";
import { CoachingRecord } from "../models/coaching";
import { ProductivityRecord } from "../models/productivity";
import { DailySummary } from "../models/summary";
import { getStore } from "../models/firestoreClient";
import { cacheGet, cacheSet } from "../models/cache";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// The dashboard aggregates eight collection queries; it is the app landing
// page and tolerates slight staleness, so it is cached briefly when a Redis
// cache is configured. Without REDIS_URL the cache calls are no-ops.
const CACHE_TTL_SECONDS = 60;

const router: Router = express.Router();

/**
 * GET /dashboard?date=YYYY-MM-DD
 *
 * Returns a shift-day overview for the Dashboard page.
 * All queries are bounded — no full-container scans.
 */
router.get("/", async (req, res) => {
    const rawDate = typeof req.query.date === "string" ? req.query.date : "";
    const date = ISO_DATE_RE.test(rawDate)
        ? rawDate
        : new Date().toISOString().slice(0, 10);

    const cacheKey = `dashboard:${date}`;

    try {
        const cached = await cacheGet<Record<string, unknown>>(cacheKey);
        if (cached) {
            res.json(cached);
            return;
        }

        const taskRepo        = new BaseRepository<Task>(getStore("tasks"));
        const issueRepo       = new BaseRepository<IssueLog>(getStore("issues"));
        const coachingRepo    = new BaseRepository<CoachingRecord>(getStore("coaching"));
        const employeeRepo    = new BaseRepository<Employee>(getStore("employees"));
        const productivityRepo = new BaseRepository<ProductivityRecord>(getStore("productivity"));
        const summaryRepo     = new BaseRepository<DailySummary>(getStore("summaries"));

        // ── Conditions reused across queries ──────────────────────────────
        const openIssueConds: FilterCondition[] = [
            { op: "eq", field: "status", value: "open" },
        ];
        const followUpConds: FilterCondition[] = [
            { op: "is_defined", field: "followUpDate" },
            { op: "lte",        field: "followUpDate", value: date },
        ];

        // ── Fan out all independent queries in parallel ───────────────────
        const [
            dayTasks,
            openIssuesCount,
            recentOpenIssues,
            followUpCount,
            upcomingFollowUpRecords,
            activeEmployeesCount,
            dayProductivity,
            dateSummaries,
        ] = await Promise.all([
            // Tasks for the requested date — bounded to one day
            taskRepo.findWhere({ conditions: [{ op: "eq", field: "storeDate", value: date }] }),
            // Count of all open issues
            issueRepo.countWhere(openIssueConds),
            // Five most recent open issues
            issueRepo.findWhere({
                conditions: openIssueConds,
                orderBy: { field: "storeDate", desc: true },
                top: 5,
            }),
            // Count of coaching follow-ups due on or before the date
            coachingRepo.countWhere(followUpConds),
            // Five most overdue follow-ups (ascending = oldest first)
            coachingRepo.findWhere({
                conditions: followUpConds,
                orderBy: { field: "followUpDate", desc: false },
                top: 5,
            }),
            // Active employee count
            employeeRepo.countWhere([{ op: "eq", field: "isActive", value: true }]),
            // Productivity records for the date — bounded to one day
            productivityRepo.findWhere({ conditions: [{ op: "eq", field: "storeDate", value: date }] }),
            // Summaries for the exact date
            summaryRepo.findWhere({ conditions: [{ op: "eq", field: "storeDate", value: date }], top: 1 }),
        ]);

        // ── Task counts ───────────────────────────────────────────────────
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

        // ── Open issues ───────────────────────────────────────────────────
        const recentOpenIssuesMapped = recentOpenIssues.map(i => ({
            id: i.id,
            category: i.category,
            department: i.department,
            description: i.description,
            storeDate: i.storeDate,
        }));

        // ── Coaching follow-ups with employee names ───────────────────────
        // Point-read each unique employee rather than loading the full roster.
        const employeeIds = [...new Set(upcomingFollowUpRecords.map(c => c.employeeId))];
        const employeeResults = await Promise.all(employeeIds.map(id => employeeRepo.findById(id)));
        const empMap = new Map(
            employeeIds.map((id, i) => [id, employeeResults[i]])
        );

        const upcomingFollowUps = upcomingFollowUpRecords.map(c => {
            const emp = empMap.get(c.employeeId);
            return {
                id: c.id,
                employeeName: emp ? `${emp.firstName} ${emp.lastName}` : c.employeeId,
                topic: c.topic,
                followUpDate: c.followUpDate,
            };
        });

        // ── Productivity snapshot ─────────────────────────────────────────
        const totalUnitsStocked = dayProductivity.reduce(
            (sum, p) => sum + (p.freightStockedUnits ?? 0), 0,
        );
        const productivitySnapshot = {
            recordsLogged: dayProductivity.length,
            totalUnitsStocked,
        };

        // ── Latest summary ────────────────────────────────────────────────
        // If no summary for today, fetch the most recent one on or before the date.
        let bestSummary = dateSummaries[0] ?? null;
        if (!bestSummary) {
            const [fallback] = await summaryRepo.findWhere({
                conditions: [{ op: "lte", field: "storeDate", value: date }],
                orderBy: { field: "storeDate", desc: true },
                top: 1,
            });
            bestSummary = fallback ?? null;
        }

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

        const payload = {
            date,
            taskCounts,
            urgentTasks,
            openIssuesCount,
            recentOpenIssues: recentOpenIssuesMapped,
            coachingFollowUpsDueCount: followUpCount,
            upcomingFollowUps,
            activeEmployeesCount,
            productivitySnapshot,
            latestSummary,
        };

        await cacheSet(cacheKey, payload, CACHE_TTL_SECONDS);
        res.json(payload);
    } catch (err) {
        logger.error(`[dashboard] GET /dashboard?date=${date} 500 – ${err instanceof Error ? err.message : String(err)}`);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
