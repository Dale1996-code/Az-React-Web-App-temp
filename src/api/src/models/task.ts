import { BaseEntity } from "./baseRepository";

export type TaskStatus = "notStarted" | "inProgress" | "completed";
export type TaskPriority = "low" | "medium" | "high";

/**
 * A daily task assigned during a shift.
 */
export interface Task extends BaseEntity {
    title: string;
    status: TaskStatus;
    storeDate: string;    // ISO date string (YYYY-MM-DD)
    department: string;
    assignedEmployeeId?: string;
    description?: string;
    priority?: TaskPriority;
    dueTime?: string;     // HH:MM (24-hour)
    notes?: string;
    completedAt?: string; // ISO datetime string
}
