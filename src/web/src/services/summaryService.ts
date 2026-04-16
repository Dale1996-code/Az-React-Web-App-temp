import apiClient from './apiClient';
import { DailySummary, SummaryFormData, SummaryQuery } from '../models/summary';

const BASE = '/summaries';

export async function getSummaries(query?: SummaryQuery): Promise<DailySummary[]> {
    const params: Record<string, string> = {};
    if (query?.date)       params.date       = query.date;
    if (query?.shiftLabel) params.shiftLabel = query.shiftLabel;

    const { data } = await apiClient.get<DailySummary[]>(BASE, { params });
    return data;
}

export async function createSummary(data: SummaryFormData): Promise<DailySummary> {
    const { data: created } = await apiClient.post<DailySummary>(BASE, data);
    return created;
}

export async function updateSummary(id: string, data: Partial<SummaryFormData>): Promise<DailySummary> {
    const { data: updated } = await apiClient.put<DailySummary>(`${BASE}/${id}`, data);
    return updated;
}

export async function deleteSummary(id: string): Promise<void> {
    await apiClient.delete(`${BASE}/${id}`);
}
