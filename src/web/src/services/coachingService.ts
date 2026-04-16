import apiClient from './apiClient';
import { CoachingRecord, CoachingFormData, CoachingQuery } from '../models/coaching';

const BASE = '/coaching';

export async function getCoachingRecords(query?: CoachingQuery): Promise<CoachingRecord[]> {
    const params: Record<string, string> = {};
    if (query?.date)       params.date       = query.date;
    if (query?.employeeId) params.employeeId = query.employeeId;

    const { data } = await apiClient.get<CoachingRecord[]>(BASE, { params });
    return data;
}

export async function createCoachingRecord(data: CoachingFormData): Promise<CoachingRecord> {
    const { data: created } = await apiClient.post<CoachingRecord>(BASE, data);
    return created;
}

export async function updateCoachingRecord(id: string, data: Partial<CoachingFormData>): Promise<CoachingRecord> {
    const { data: updated } = await apiClient.put<CoachingRecord>(`${BASE}/${id}`, data);
    return updated;
}

export async function deleteCoachingRecord(id: string): Promise<void> {
    await apiClient.delete(`${BASE}/${id}`);
}
