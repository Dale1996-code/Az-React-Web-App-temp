import { BaseEntity } from "./baseRepository";

/**
 * A coaching record for an employee.
 * `issues` is a free-form list of checked items (e.g. ["attendance", "safety"]).
 */
export interface CoachingRecord extends BaseEntity {
    employeeId: string;
    date: string; // ISO date string (YYYY-MM-DD)
    issues?: string[];
    goals?: string;
    followUpDate?: string; // ISO date string
    acknowledgement?: string;
}
