import { BaseEntity } from "./baseRepository";

/**
 * A daily productivity entry for a single employee on a shift.
 */
export interface ProductivityRecord extends BaseEntity {
    employeeId: string;
    storeDate: string;           // ISO date string (YYYY-MM-DD)
    freightStockedUnits?: number;
    breakMinutes?: number;
    zonesCovered?: string;
    overstockNotes?: string;
    shiftNotes?: string;
}
