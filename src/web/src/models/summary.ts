/**
 * DailySummary model — mirrors the backend DailySummary interface.
 * id, createdDate, updatedDate are assigned by the API.
 */
export interface DailySummary {
    id: string;
    storeDate: string;              // YYYY-MM-DD
    shiftLabel: string;             // e.g. "morning", "afternoon", "closing", "overnight"
    completedWork?: string;
    missedWork?: string;
    followUpItems?: string;
    generalNotes?: string;
    authorEmployeeId?: string;
    createdDate?: string;
    updatedDate?: string;
}

/** Fields submitted when creating or editing a daily summary. */
export type SummaryFormData = {
    storeDate: string;
    shiftLabel: string;
    completedWork?: string;
    missedWork?: string;
    followUpItems?: string;
    generalNotes?: string;
    authorEmployeeId?: string;
};

/** Query params for GET /summaries. */
export type SummaryQuery = {
    date?: string;
    shiftLabel?: string;
};
