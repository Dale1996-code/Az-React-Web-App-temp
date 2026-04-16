import apiClient from './apiClient';
import { Task, TaskFormData, TasksQuery } from '../models/task';

const BASE = '/tasks';

export async function getTasks(query?: TasksQuery): Promise<Task[]> {
    const params: Record<string, string> = {};
    if (query?.status)     params.status     = query.status;
    if (query?.date)       params.date       = query.date;
    if (query?.department) params.department = query.department;

    const { data } = await apiClient.get<Task[]>(BASE, { params });
    return data;
}

export async function createTask(data: TaskFormData): Promise<Task> {
    const { data: created } = await apiClient.post<Task>(BASE, data);
    return created;
}

export async function updateTask(id: string, data: Partial<TaskFormData>): Promise<Task> {
    const { data: updated } = await apiClient.put<Task>(`${BASE}/${id}`, data);
    return updated;
}

export async function deleteTask(id: string): Promise<void> {
    await apiClient.delete(`${BASE}/${id}`);
}
