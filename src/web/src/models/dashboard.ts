/** Response shape for GET /dashboard */
export interface DashboardSummary {
    date: string;
    taskCounts: {
        notStarted: number;
        inProgress: number;
        completed: number;
    };
    openIssuesCount: number;
    coachingFollowUpsDueCount: number;
    activeEmployeesCount: number;
}
