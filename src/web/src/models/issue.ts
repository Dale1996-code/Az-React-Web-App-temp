/**
 * IssueLog model — mirrors the backend IssueLog interface.
 * id, createdDate, updatedDate are assigned by the API.
 */
export type IssueStatus = 'open' | 'resolved';

export interface IssueLog {
    id: string;
    storeDate: string;              // YYYY-MM-DD
    category: string;
    status: IssueStatus;
    department: string;
    description: string;
    reportedByEmployeeId?: string;
    resolvedAt?: string;            // ISO datetime string
    resolutionNotes?: string;
    createdDate?: string;
    updatedDate?: string;
}

/** Fields submitted when creating or editing an issue. */
export type IssueFormData = {
    storeDate: string;
    category: string;
    status: IssueStatus;
    department: string;
    description: string;
    reportedByEmployeeId?: string;
    resolvedAt?: string;
    resolutionNotes?: string;
};

/** Query params for GET /issues. */
export type IssueQuery = {
    date?: string;
    status?: string;
    department?: string;
    category?: string;
};
