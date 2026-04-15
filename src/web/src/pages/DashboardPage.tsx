import { FC, ReactElement, useEffect, useState } from 'react';
import {
    MessageBar,
    MessageBarType,
    Spinner,
    SpinnerSize,
    Stack,
    Text,
} from '@fluentui/react';
import { stackGaps, stackItemPadding, stackPadding } from '../ux/styles';
import { DashboardSummary } from '../models/dashboard';
import { getDashboardSummary } from '../services/dashboardService';

// ── SummaryCard ────────────────────────────────────────────────────────────────

type SummaryCardProps = {
    title: string;
    children: React.ReactNode;
};

const SummaryCard: FC<SummaryCardProps> = ({ title, children }): ReactElement => (
    <Stack
        styles={{
            root: {
                flex: '1 1 180px',
                minWidth: 160,
                padding: 16,
                border: '1px solid #edebe9',
                borderRadius: 4,
                background: '#faf9f8',
            },
        }}
    >
        <Text
            variant="small"
            style={{ color: '#605e5c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}
        >
            {title}
        </Text>
        {children}
    </Stack>
);

// ── StatNumber ─────────────────────────────────────────────────────────────────

const StatNumber: FC<{ value: number; label?: string }> = ({ value, label }): ReactElement => (
    <Stack>
        <Text variant="xxLarge" style={{ fontWeight: 700, lineHeight: 1 }}>{value}</Text>
        {label && <Text variant="small" style={{ color: '#605e5c', marginTop: 2 }}>{label}</Text>}
    </Stack>
);

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
    try {
        return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });
    } catch {
        return iso;
    }
}

function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
}

// ── DashboardPage ──────────────────────────────────────────────────────────────

const DashboardPage: FC = (): ReactElement => {
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await getDashboardSummary(todayIso());
                if (!cancelled) setSummary(data);
            } catch {
                if (!cancelled) setError('Could not load dashboard data. Check your connection and try again.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const date = summary?.date ?? todayIso();

    return (
        <Stack tokens={stackPadding} style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
            {/* Page header */}
            <Stack.Item tokens={stackItemPadding}>
                <Text variant="xxLarge" block style={{ fontWeight: 600 }}>Dashboard</Text>
                <Text variant="medium" style={{ color: '#605e5c' }}>
                    {formatDate(date)}
                </Text>
            </Stack.Item>

            {/* Error */}
            {error && (
                <Stack.Item tokens={stackItemPadding}>
                    <MessageBar
                        messageBarType={MessageBarType.error}
                        onDismiss={() => setError(null)}
                        dismissButtonAriaLabel="Dismiss"
                    >
                        {error}
                    </MessageBar>
                </Stack.Item>
            )}

            {/* Loading */}
            {loading && (
                <Stack.Item tokens={stackItemPadding}>
                    <Stack horizontalAlign="center" style={{ padding: 40 }}>
                        <Spinner size={SpinnerSize.large} label="Loading summary…" />
                    </Stack>
                </Stack.Item>
            )}

            {/* Summary cards */}
            {!loading && summary && (
                <Stack.Item tokens={stackItemPadding}>
                    <Stack horizontal wrap tokens={stackGaps}>
                        {/* Tasks Today */}
                        <SummaryCard title="Tasks Today">
                            <Stack tokens={{ childrenGap: 4 }}>
                                <Stack horizontal horizontalAlign="space-between">
                                    <Text variant="small">Not started</Text>
                                    <Text variant="small" style={{ fontWeight: 600 }}>{summary.taskCounts.notStarted}</Text>
                                </Stack>
                                <Stack horizontal horizontalAlign="space-between">
                                    <Text variant="small">In progress</Text>
                                    <Text variant="small" style={{ fontWeight: 600 }}>{summary.taskCounts.inProgress}</Text>
                                </Stack>
                                <Stack horizontal horizontalAlign="space-between">
                                    <Text variant="small">Completed</Text>
                                    <Text variant="small" style={{ fontWeight: 600, color: '#107c10' }}>{summary.taskCounts.completed}</Text>
                                </Stack>
                                <Stack
                                    style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #edebe9' }}
                                    horizontal horizontalAlign="space-between"
                                >
                                    <Text variant="small" style={{ color: '#605e5c' }}>Total</Text>
                                    <Text variant="small" style={{ fontWeight: 700 }}>
                                        {summary.taskCounts.notStarted + summary.taskCounts.inProgress + summary.taskCounts.completed}
                                    </Text>
                                </Stack>
                            </Stack>
                        </SummaryCard>

                        {/* Open Issues */}
                        <SummaryCard title="Open Issues">
                            <StatNumber
                                value={summary.openIssuesCount}
                                label={summary.openIssuesCount === 1 ? 'issue open' : 'issues open'}
                            />
                        </SummaryCard>

                        {/* Follow-ups Due */}
                        <SummaryCard title="Follow-ups Due">
                            <StatNumber
                                value={summary.coachingFollowUpsDueCount}
                                label={summary.coachingFollowUpsDueCount === 1 ? 'coaching follow-up' : 'coaching follow-ups'}
                            />
                        </SummaryCard>

                        {/* Active Employees */}
                        <SummaryCard title="Active Employees">
                            <StatNumber
                                value={summary.activeEmployeesCount}
                                label={summary.activeEmployeesCount === 1 ? 'employee on roster' : 'employees on roster'}
                            />
                        </SummaryCard>
                    </Stack>
                </Stack.Item>
            )}
        </Stack>
    );
};

export default DashboardPage;
