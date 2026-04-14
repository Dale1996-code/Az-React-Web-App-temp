import { BaseEntity } from "./baseRepository";

export type TaskStatus = "notStarted" | "inProgress" | "completed";

/**
 * A daily task assigned during a shift.
 */
export interface Task extends BaseEntity {
    title: string;
    status: TaskStatus;
    description?: string;
    assignedToEmployeeId?: string;
    department?: string;
    dueDate?: string; // ISO date string (YYYY-MM-DD)
    notes?: string;
}
