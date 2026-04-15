/**
 * Runtime validation for Dales Operations API payloads.
 *
 * Design choices:
 *   - No external validation library — plain TypeScript keeps it beginner-friendly.
 *   - Allowlist approach: only known fields are forwarded to the repository.
 *     Unknown fields are silently stripped (not rejected), preventing surprise
 *     data from leaking into Cosmos DB.
 *   - Required-field checks only apply on CREATE (isUpdate=false).
 *     On UPDATE, callers may omit any field; only fields present in the body
 *     are validated for format/enum correctness.
 *   - Strings are trimmed before validation and storage.
 *   - Numbers must be zero or positive (no negative counts/minutes).
 *
 * Error shape returned by every validator:
 *   { valid: false, details: string[] }  — 400 Bad Request
 *   { valid: true,  sanitized: Record<string,unknown> } — proceed
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type ValidationOk = { valid: true; sanitized: Record<string, unknown> };
export type ValidationFail = { valid: false; details: string[] };
export type ValidationResult = ValidationOk | ValidationFail;

export type Validator = (body: unknown, isUpdate: boolean) => ValidationResult;

// ── Helpers ──────────────────────────────────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DUE_TIME_RE = /^\d{2}:\d{2}$/;

function isIsoDate(val: unknown): boolean {
    return typeof val === "string" && ISO_DATE_RE.test(val);
}

function trimStr(val: unknown): string {
    return typeof val === "string" ? val.trim() : "";
}

function notBlank(val: unknown): boolean {
    return typeof val === "string" && val.trim().length > 0;
}

function isStringArray(val: unknown): val is string[] {
    return Array.isArray(val) && val.every(v => typeof v === "string");
}

function isNonNegNumber(val: unknown): boolean {
    return typeof val === "number" && isFinite(val) && val >= 0;
}

function ok(sanitized: Record<string, unknown>): ValidationOk {
    return { valid: true, sanitized };
}

function fail(details: string[]): ValidationFail {
    return { valid: false, details };
}

// ── Per-collection validators ─────────────────────────────────────────────────

/**
 * Employee
 * Required:  firstName, lastName, role, isActive
 * Optional:  department, employeeCode, notes
 */
export function validateEmployee(body: unknown, isUpdate: boolean): ValidationResult {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return fail(["Request body must be a JSON object."]);
    }
    const b = body as Record<string, unknown>;
    const errors: string[] = [];

    if (!isUpdate) {
        if (!notBlank(b.firstName))  errors.push("firstName is required and must be a non-empty string.");
        if (!notBlank(b.lastName))   errors.push("lastName is required and must be a non-empty string.");
        if (!notBlank(b.role))       errors.push("role is required and must be a non-empty string.");
        if (typeof b.isActive !== "boolean") errors.push("isActive is required and must be a boolean.");
    }

    // format checks for present fields
    if ("firstName" in b && !notBlank(b.firstName))  errors.push("firstName must be a non-empty string.");
    if ("lastName" in b  && !notBlank(b.lastName))   errors.push("lastName must be a non-empty string.");
    if ("role" in b      && !notBlank(b.role))        errors.push("role must be a non-empty string.");
    if ("isActive" in b  && typeof b.isActive !== "boolean") errors.push("isActive must be a boolean.");
    if ("department" in b   && b.department   !== undefined && !notBlank(b.department))   errors.push("department must be a non-empty string when provided.");
    if ("employeeCode" in b && b.employeeCode !== undefined && !notBlank(b.employeeCode)) errors.push("employeeCode must be a non-empty string when provided.");

    if (errors.length) return fail(errors);

    const sanitized: Record<string, unknown> = {};
    if ("firstName" in b)    sanitized.firstName    = trimStr(b.firstName);
    if ("lastName" in b)     sanitized.lastName     = trimStr(b.lastName);
    if ("role" in b)         sanitized.role         = trimStr(b.role);
    if ("isActive" in b)     sanitized.isActive     = b.isActive;
    if ("department" in b)   sanitized.department   = b.department   !== undefined ? trimStr(b.department)   : undefined;
    if ("employeeCode" in b) sanitized.employeeCode = b.employeeCode !== undefined ? trimStr(b.employeeCode) : undefined;
    if ("notes" in b)        sanitized.notes        = b.notes        !== undefined ? trimStr(b.notes)        : undefined;

    return ok(sanitized);
}

/**
 * Task
 * Required:  title, status, storeDate, department
 * Optional:  assignedEmployeeId, description, priority, dueTime, notes, completedAt
 */
const TASK_STATUSES = new Set(["notStarted", "inProgress", "completed"]);
const TASK_PRIORITIES = new Set(["low", "medium", "high"]);

export function validateTask(body: unknown, isUpdate: boolean): ValidationResult {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return fail(["Request body must be a JSON object."]);
    }
    const b = body as Record<string, unknown>;
    const errors: string[] = [];

    if (!isUpdate) {
        if (!notBlank(b.title))       errors.push("title is required and must be a non-empty string.");
        if (!notBlank(b.status))      errors.push("status is required.");
        if (!isIsoDate(b.storeDate))  errors.push("storeDate is required and must be YYYY-MM-DD.");
        if (!notBlank(b.department))  errors.push("department is required and must be a non-empty string.");
    }

    if ("title" in b      && !notBlank(b.title))      errors.push("title must be a non-empty string.");
    if ("status" in b     && !TASK_STATUSES.has(b.status as string))
        errors.push(`status must be one of: ${[...TASK_STATUSES].join(", ")}.`);
    if ("storeDate" in b  && !isIsoDate(b.storeDate)) errors.push("storeDate must be YYYY-MM-DD.");
    if ("department" in b && !notBlank(b.department)) errors.push("department must be a non-empty string.");
    if ("priority" in b   && b.priority !== undefined && !TASK_PRIORITIES.has(b.priority as string))
        errors.push(`priority must be one of: ${[...TASK_PRIORITIES].join(", ")}.`);
    if ("dueTime" in b    && b.dueTime  !== undefined && !DUE_TIME_RE.test(b.dueTime as string))
        errors.push("dueTime must be HH:MM (24-hour).");

    if (errors.length) return fail(errors);

    const sanitized: Record<string, unknown> = {};
    if ("title" in b)              sanitized.title              = trimStr(b.title);
    if ("status" in b)             sanitized.status             = b.status;
    if ("storeDate" in b)          sanitized.storeDate          = b.storeDate;
    if ("department" in b)         sanitized.department         = trimStr(b.department);
    if ("assignedEmployeeId" in b) sanitized.assignedEmployeeId = b.assignedEmployeeId !== undefined ? trimStr(b.assignedEmployeeId) : undefined;
    if ("description" in b)        sanitized.description        = b.description        !== undefined ? trimStr(b.description)        : undefined;
    if ("priority" in b)           sanitized.priority           = b.priority;
    if ("dueTime" in b)            sanitized.dueTime            = b.dueTime;
    if ("notes" in b)              sanitized.notes              = b.notes              !== undefined ? trimStr(b.notes)              : undefined;
    if ("completedAt" in b)        sanitized.completedAt        = b.completedAt;

    return ok(sanitized);
}

/**
 * ProductivityRecord
 * Required:  employeeId, storeDate
 * Optional:  freightStockedUnits, breakMinutes, zonesCovered, overstockNotes, shiftNotes
 */
export function validateProductivity(body: unknown, isUpdate: boolean): ValidationResult {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return fail(["Request body must be a JSON object."]);
    }
    const b = body as Record<string, unknown>;
    const errors: string[] = [];

    if (!isUpdate) {
        if (!notBlank(b.employeeId))  errors.push("employeeId is required and must be a non-empty string.");
        if (!isIsoDate(b.storeDate))  errors.push("storeDate is required and must be YYYY-MM-DD.");
    }

    if ("employeeId" in b && !notBlank(b.employeeId))  errors.push("employeeId must be a non-empty string.");
    if ("storeDate" in b  && !isIsoDate(b.storeDate))  errors.push("storeDate must be YYYY-MM-DD.");
    if ("freightStockedUnits" in b && b.freightStockedUnits !== undefined && !isNonNegNumber(b.freightStockedUnits))
        errors.push("freightStockedUnits must be a non-negative number.");
    if ("breakMinutes" in b && b.breakMinutes !== undefined && !isNonNegNumber(b.breakMinutes))
        errors.push("breakMinutes must be a non-negative number.");

    if (errors.length) return fail(errors);

    const sanitized: Record<string, unknown> = {};
    if ("employeeId" in b)          sanitized.employeeId          = trimStr(b.employeeId);
    if ("storeDate" in b)           sanitized.storeDate           = b.storeDate;
    if ("freightStockedUnits" in b) sanitized.freightStockedUnits = b.freightStockedUnits;
    if ("breakMinutes" in b)        sanitized.breakMinutes        = b.breakMinutes;
    if ("zonesCovered" in b)        sanitized.zonesCovered        = b.zonesCovered        !== undefined ? trimStr(b.zonesCovered)    : undefined;
    if ("overstockNotes" in b)      sanitized.overstockNotes      = b.overstockNotes      !== undefined ? trimStr(b.overstockNotes)  : undefined;
    if ("shiftNotes" in b)          sanitized.shiftNotes          = b.shiftNotes          !== undefined ? trimStr(b.shiftNotes)      : undefined;

    return ok(sanitized);
}

/**
 * CoachingRecord
 * Required:  employeeId, storeDate, topic
 * Optional:  issues, goals, followUpDate, acknowledgement, status
 */
export function validateCoaching(body: unknown, isUpdate: boolean): ValidationResult {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return fail(["Request body must be a JSON object."]);
    }
    const b = body as Record<string, unknown>;
    const errors: string[] = [];

    if (!isUpdate) {
        if (!notBlank(b.employeeId)) errors.push("employeeId is required and must be a non-empty string.");
        if (!isIsoDate(b.storeDate)) errors.push("storeDate is required and must be YYYY-MM-DD.");
        if (!notBlank(b.topic))      errors.push("topic is required and must be a non-empty string.");
    }

    if ("employeeId" in b   && !notBlank(b.employeeId))   errors.push("employeeId must be a non-empty string.");
    if ("storeDate" in b    && !isIsoDate(b.storeDate))   errors.push("storeDate must be YYYY-MM-DD.");
    if ("topic" in b        && !notBlank(b.topic))        errors.push("topic must be a non-empty string.");
    if ("followUpDate" in b && b.followUpDate !== undefined && !isIsoDate(b.followUpDate))
        errors.push("followUpDate must be YYYY-MM-DD.");
    if ("issues" in b       && b.issues !== undefined     && !isStringArray(b.issues))
        errors.push("issues must be an array of strings.");

    if (errors.length) return fail(errors);

    const sanitized: Record<string, unknown> = {};
    if ("employeeId" in b)      sanitized.employeeId     = trimStr(b.employeeId);
    if ("storeDate" in b)       sanitized.storeDate      = b.storeDate;
    if ("topic" in b)           sanitized.topic          = trimStr(b.topic);
    if ("issues" in b)          sanitized.issues         = b.issues;
    if ("goals" in b)           sanitized.goals          = b.goals          !== undefined ? trimStr(b.goals)          : undefined;
    if ("followUpDate" in b)    sanitized.followUpDate   = b.followUpDate;
    if ("acknowledgement" in b) sanitized.acknowledgement = b.acknowledgement !== undefined ? trimStr(b.acknowledgement) : undefined;
    if ("status" in b)          sanitized.status         = b.status         !== undefined ? trimStr(b.status)         : undefined;

    return ok(sanitized);
}

/**
 * IssueLog
 * Required:  storeDate, category, status, department, description
 * Optional:  reportedByEmployeeId, resolvedAt, resolutionNotes
 */
const ISSUE_STATUSES = new Set(["open", "resolved"]);

export function validateIssue(body: unknown, isUpdate: boolean): ValidationResult {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return fail(["Request body must be a JSON object."]);
    }
    const b = body as Record<string, unknown>;
    const errors: string[] = [];

    if (!isUpdate) {
        if (!isIsoDate(b.storeDate))   errors.push("storeDate is required and must be YYYY-MM-DD.");
        if (!notBlank(b.category))     errors.push("category is required and must be a non-empty string.");
        if (!notBlank(b.status))       errors.push("status is required.");
        if (!notBlank(b.department))   errors.push("department is required and must be a non-empty string.");
        if (!notBlank(b.description))  errors.push("description is required and must be a non-empty string.");
    }

    if ("storeDate" in b   && !isIsoDate(b.storeDate))   errors.push("storeDate must be YYYY-MM-DD.");
    if ("category" in b    && !notBlank(b.category))     errors.push("category must be a non-empty string.");
    if ("status" in b      && !ISSUE_STATUSES.has(b.status as string))
        errors.push(`status must be one of: ${[...ISSUE_STATUSES].join(", ")}.`);
    if ("department" in b  && !notBlank(b.department))   errors.push("department must be a non-empty string.");
    if ("description" in b && !notBlank(b.description))  errors.push("description must be a non-empty string.");

    if (errors.length) return fail(errors);

    const sanitized: Record<string, unknown> = {};
    if ("storeDate" in b)              sanitized.storeDate              = b.storeDate;
    if ("category" in b)               sanitized.category               = trimStr(b.category);
    if ("status" in b)                 sanitized.status                 = b.status;
    if ("department" in b)             sanitized.department             = trimStr(b.department);
    if ("description" in b)            sanitized.description            = trimStr(b.description);
    if ("reportedByEmployeeId" in b)   sanitized.reportedByEmployeeId   = b.reportedByEmployeeId !== undefined ? trimStr(b.reportedByEmployeeId) : undefined;
    if ("resolvedAt" in b)             sanitized.resolvedAt             = b.resolvedAt;
    if ("resolutionNotes" in b)        sanitized.resolutionNotes        = b.resolutionNotes      !== undefined ? trimStr(b.resolutionNotes)       : undefined;

    return ok(sanitized);
}

/**
 * DailySummary
 * Required:  storeDate, shiftLabel
 * Optional:  completedWork, missedWork, followUpItems, generalNotes, authorEmployeeId
 */
export function validateSummary(body: unknown, isUpdate: boolean): ValidationResult {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return fail(["Request body must be a JSON object."]);
    }
    const b = body as Record<string, unknown>;
    const errors: string[] = [];

    if (!isUpdate) {
        if (!isIsoDate(b.storeDate))  errors.push("storeDate is required and must be YYYY-MM-DD.");
        if (!notBlank(b.shiftLabel))  errors.push("shiftLabel is required and must be a non-empty string.");
    }

    if ("storeDate" in b  && !isIsoDate(b.storeDate))  errors.push("storeDate must be YYYY-MM-DD.");
    if ("shiftLabel" in b && !notBlank(b.shiftLabel))  errors.push("shiftLabel must be a non-empty string.");

    if (errors.length) return fail(errors);

    const sanitized: Record<string, unknown> = {};
    if ("storeDate" in b)          sanitized.storeDate          = b.storeDate;
    if ("shiftLabel" in b)         sanitized.shiftLabel         = trimStr(b.shiftLabel);
    if ("completedWork" in b)      sanitized.completedWork      = b.completedWork      !== undefined ? trimStr(b.completedWork)      : undefined;
    if ("missedWork" in b)         sanitized.missedWork         = b.missedWork         !== undefined ? trimStr(b.missedWork)         : undefined;
    if ("followUpItems" in b)      sanitized.followUpItems      = b.followUpItems      !== undefined ? trimStr(b.followUpItems)      : undefined;
    if ("generalNotes" in b)       sanitized.generalNotes       = b.generalNotes       !== undefined ? trimStr(b.generalNotes)       : undefined;
    if ("authorEmployeeId" in b)   sanitized.authorEmployeeId   = b.authorEmployeeId   !== undefined ? trimStr(b.authorEmployeeId)   : undefined;

    return ok(sanitized);
}
