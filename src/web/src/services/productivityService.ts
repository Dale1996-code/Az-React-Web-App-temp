import apiClient from './apiClient';
import { ProductivityRecord, ProductivityFormData, ProductivityQuery } from '../models/productivity';

const BASE = '/productivity';

export async function getProductivityRecords(query?: ProductivityQuery): Promise<ProductivityRecord[]> {
    const params: Record<string, string> = {};
    if (query?.date)       params.date       = query.date;
    if (query?.employeeId) params.employeeId = query.employeeId;

    const { data } = await apiClient.get<ProductivityRecord[]>(BASE, { params });
    return data;
}

export async function createProductivityRecord(data: ProductivityFormData): Promise<ProductivityRecord> {
    const { data: created } = await apiClient.post<ProductivityRecord>(BASE, data);
    return created;
}

export async function updateProductivityRecord(id: string, data: Partial<ProductivityFormData>): Promise<ProductivityRecord> {
    const { data: updated } = await apiClient.put<ProductivityRecord>(`${BASE}/${id}`, data);
    return updated;
}

export async function deleteProductivityRecord(id: string): Promise<void> {
    await apiClient.delete(`${BASE}/${id}`);
}
