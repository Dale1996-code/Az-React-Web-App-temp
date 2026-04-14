import { BaseEntity } from "./baseRepository";

/**
 * A daily productivity entry for a single employee on a shift.
 */
export interface ProductivityRecord extends BaseEntity {
    employeeId: string;
    date: string; // ISO date string (YYYY-MM-DD)
    freightStocked?: number;
    breakDurationMinutes?: number;
    zonedAreas?: string;
    overstockNotes?: string;
    shiftNotes?: string;
}
