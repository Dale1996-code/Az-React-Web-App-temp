/**
 * ProductivityRecord model — mirrors the backend ProductivityRecord interface.
 * id, createdDate, updatedDate are assigned by the API.
 */
export interface ProductivityRecord {
    id: string;
    employeeId: string;
    storeDate: string;              // YYYY-MM-DD
    freightStockedUnits?: number;
    breakMinutes?: number;
    zonesCovered?: string;
    overstockNotes?: string;
    shiftNotes?: string;
    createdDate?: string;
    updatedDate?: string;
}

/** Fields submitted when creating or editing a productivity record. */
export type ProductivityFormData = {
    employeeId: string;
    storeDate: string;
    freightStockedUnits?: number;
    breakMinutes?: number;
    zonesCovered?: string;
    overstockNotes?: string;
    shiftNotes?: string;
};

/** Query params for GET /productivity. */
export type ProductivityQuery = {
    date?: string;
    employeeId?: string;
};
