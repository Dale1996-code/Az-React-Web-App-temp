import apiClient from './apiClient';
import { DashboardSummary } from '../models/dashboard';

export async function getDashboardSummary(date?: string): Promise<DashboardSummary> {
    const params = date ? { date } : {};
    const { data } = await apiClient.get<DashboardSummary>('/dashboard', { params });
    return data;
}
