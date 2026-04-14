import { BaseEntity } from "./baseRepository";

/**
 * A shift's daily summary written by the shift lead at end of day.
 */
export interface DailySummary extends BaseEntity {
    date: string; // ISO date string (YYYY-MM-DD)
    completedWork?: string;
    missedWork?: string;
    followUpItems?: string;
    generalNotes?: string;
}
