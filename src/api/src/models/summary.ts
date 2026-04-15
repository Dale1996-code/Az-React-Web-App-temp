import { BaseEntity } from "./baseRepository";

/**
 * A shift's daily summary written by the shift lead at end of day.
 */
export interface DailySummary extends BaseEntity {
    storeDate: string;      // ISO date string (YYYY-MM-DD)
    shiftLabel: string;     // e.g. "morning", "afternoon", "closing"
    completedWork?: string;
    missedWork?: string;
    followUpItems?: string;
    generalNotes?: string;
    authorEmployeeId?: string;
}
