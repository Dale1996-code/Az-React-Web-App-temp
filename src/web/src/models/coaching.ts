/**
 * CoachingRecord model — mirrors the backend CoachingRecord interface.
 * id, createdDate, updatedDate are assigned by the API.
 */
export interface CoachingRecord {
    id: string;
    employeeId: string;
    storeDate: string;       // YYYY-MM-DD
    topic: string;
    issues?: string[];       // selected issue labels (e.g. ["attendance", "safety"])
    goals?: string;
    followUpDate?: string;   // YYYY-MM-DD
    acknowledgement?: string;
    status?: string;
    createdDate?: string;
    updatedDate?: string;
}

/** Fields submitted when creating or editing a coaching record. */
export type CoachingFormData = {
    employeeId: string;
    storeDate: string;
    topic: string;
    issues?: string[];
    goals?: string;
    followUpDate?: string;
    acknowledgement?: string;
    status?: string;
};

/** Query params for GET /coaching. */
export type CoachingQuery = {
    date?: string;
    employeeId?: string;
};
