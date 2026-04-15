/**
 * Employee model — mirrors the backend Employee interface.
 * id, createdDate, updatedDate are assigned by the API.
 */
export interface Employee {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
    department?: string;
    employeeCode?: string;
    notes?: string;
    createdDate?: string;
    updatedDate?: string;
}

/** Fields submitted when creating or editing an employee. */
export type EmployeeFormData = {
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
    department?: string;
    employeeCode?: string;
    notes?: string;
};

/** Query params for GET /employees. */
export type EmployeesQuery = {
    active?: boolean;
    department?: string;
    search?: string;
};
