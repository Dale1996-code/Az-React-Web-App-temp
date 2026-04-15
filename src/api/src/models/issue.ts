import { BaseEntity } from "./baseRepository";

export type IssueStatus = "open" | "resolved";

/**
 * A logged shift issue (safety, equipment, customer, etc.).
 */
export interface IssueLog extends BaseEntity {
    storeDate: string;              // ISO date string (YYYY-MM-DD)
    category: string;
    status: IssueStatus;
    department: string;
    description: string;
    reportedByEmployeeId?: string;
    resolvedAt?: string;            // ISO datetime string
    resolutionNotes?: string;
}
