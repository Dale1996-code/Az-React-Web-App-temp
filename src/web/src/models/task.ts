/**
 * Task model — mirrors the backend Task interface.
 * id, createdDate, updatedDate are assigned by the API.
 */
export type TaskStatus   = "notStarted" | "inProgress" | "completed";
export type TaskPriority = "low" | "medium" | "high";

export interface Task {
    id: string;
    title: string;
    status: TaskStatus;
    storeDate: string;       // YYYY-MM-DD
    department: string;
    assignedEmployeeId?: string;
    description?: string;
    priority?: TaskPriority;
    dueTime?: string;        // HH:MM (24-hour)
    notes?: string;
    completedAt?: string;    // ISO datetime string
    createdDate?: string;
    updatedDate?: string;
}

/** Fields submitted when creating or editing a task. */
export type TaskFormData = {
    title: string;
    status: TaskStatus;
    storeDate: string;
    department: string;
    assignedEmployeeId?: string;
    description?: string;
    priority?: TaskPriority;
    dueTime?: string;
    notes?: string;
    completedAt?: string;
};

/** Query params for GET /tasks. */
export type TasksQuery = {
    status?: TaskStatus;
    date?: string;
    department?: string;
};
