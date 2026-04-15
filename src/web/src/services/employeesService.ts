import apiClient from './apiClient';
import { Employee, EmployeeFormData, EmployeesQuery } from '../models/employee';

const BASE = '/employees';

export async function getEmployees(query?: EmployeesQuery): Promise<Employee[]> {
    const params: Record<string, string> = {};
    if (query?.active !== undefined) params.active = String(query.active);
    if (query?.department)           params.department = query.department;
    if (query?.search)               params.search = query.search;

    const { data } = await apiClient.get<Employee[]>(BASE, { params });
    return data;
}

export async function createEmployee(data: EmployeeFormData): Promise<Employee> {
    const { data: created } = await apiClient.post<Employee>(BASE, data);
    return created;
}

export async function updateEmployee(id: string, data: Partial<EmployeeFormData>): Promise<Employee> {
    const { data: updated } = await apiClient.put<Employee>(`${BASE}/${id}`, data);
    return updated;
}

export async function deleteEmployee(id: string): Promise<void> {
    await apiClient.delete(`${BASE}/${id}`);
}
