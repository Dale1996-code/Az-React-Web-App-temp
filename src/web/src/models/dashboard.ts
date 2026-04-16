/** Response shape for GET /dashboard */
export interface DashboardSummary {
    date: string;
    taskCounts: {
        notStarted: number;
        inProgress: number;
        completed: number;
    };
    urgentTasks: {
        id: string;
        title: string;
        status: string;
        dueTime?: string;
    }[];
    openIssuesCount: number;
    recentOpenIssues: {
        id: string;
        category: string;
        department: string;
        description: string;
        storeDate: string;
    }[];
    coachingFollowUpsDueCount: number;
    upcomingFollowUps: {
        id: string;
        employeeName: string;
        topic: string;
        followUpDate?: string;
    }[];
    activeEmployeesCount: number;
    productivitySnapshot: {
        recordsLogged: number;
        totalUnitsStocked: number;
    };
    latestSummary: {
        id: string;
        storeDate: string;
        shiftLabel: string;
        completedWork?: string;
        missedWork?: string;
        followUpItems?: string;
    } | null;
}
