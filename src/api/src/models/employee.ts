import { BaseEntity } from "./baseRepository";

/**
 * An employee on the shift roster.
 */
export interface Employee extends BaseEntity {
    name: string;
    role: string;
    department?: string;
    notes?: string;
}
