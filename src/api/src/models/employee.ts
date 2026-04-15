import { BaseEntity } from "./baseRepository";

/**
 * An employee on the shift roster.
 */
export interface Employee extends BaseEntity {
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
    department?: string;
    employeeCode?: string;
    notes?: string;
}
