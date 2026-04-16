import apiClient from './apiClient';
import { IssueLog, IssueFormData, IssueQuery } from '../models/issue';

const BASE = '/issues';

export async function getIssues(query?: IssueQuery): Promise<IssueLog[]> {
    const params: Record<string, string> = {};
    if (query?.date)       params.date       = query.date;
    if (query?.status)     params.status     = query.status;
    if (query?.department) params.department = query.department;
    if (query?.category)   params.category   = query.category;

    const { data } = await apiClient.get<IssueLog[]>(BASE, { params });
    return data;
}

export async function createIssue(data: IssueFormData): Promise<IssueLog> {
    const { data: created } = await apiClient.post<IssueLog>(BASE, data);
    return created;
}

export async function updateIssue(id: string, data: Partial<IssueFormData>): Promise<IssueLog> {
    const { data: updated } = await apiClient.put<IssueLog>(`${BASE}/${id}`, data);
    return updated;
}

export async function deleteIssue(id: string): Promise<void> {
    await apiClient.delete(`${BASE}/${id}`);
}
