import { BaseEntity } from "./baseRepository";

/**
 * A coaching record for an employee.
 * `issues` is a free-form list of checked items (e.g. ["attendance", "safety"]).
 */
export interface CoachingRecord extends BaseEntity {
    employeeId: string;
    storeDate: string;      // ISO date string (YYYY-MM-DD)
    topic: string;
    issues?: string[];
    goals?: string;
    followUpDate?: string;  // ISO date string (YYYY-MM-DD)
    acknowledgement?: string;
    status?: string;
}
