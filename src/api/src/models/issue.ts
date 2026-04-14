import { BaseEntity } from "./baseRepository";

export type IssueStatus = "open" | "resolved";

/**
 * A logged shift issue (safety, equipment, customer, etc.).
 */
export interface IssueLog extends BaseEntity {
    type: string;
    status: IssueStatus;
    date: string; // ISO date string (YYYY-MM-DD)
    notes?: string;
    department?: string;
}
