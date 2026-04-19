import { FC, ReactElement, useEffect, useState } from 'react';
import {
    Icon,
    MessageBar,
    MessageBarType,
    Spinner,
    SpinnerSize,
    Stack,
    Text,
} from '@fluentui/react';
import { useNavigate } from 'react-router-dom';
import { stackGaps, stackItemPadding, stackPadding } from '../ux/styles';
import { DashboardSummary } from '../models/dashboard';
import { getDashboardSummary } from '../services/dashboardService';

// ── Shared card styles ────────────────────────────────────────────────────────

const cardBase = {
    padding: 16,
    border: '1px solid #edebe9',
    borderRadius: 4,
    background: '#faf9f8',
};

// ── SummaryCard — compact stat card ───────────────────────────────────────────

type SummaryCardProps = {
    title: string;
    children: React.ReactNode;
};

const SummaryCard: FC<SummaryCardProps> = ({ title, children }): ReactElement => (
    <Stack styles={{ root: { ...cardBase, flex: '1 1 180px', minWidth: 160 } }}>
        <Text
            variant="small"
            style={{ color: '#605e5c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}
        >
            {title}
        </Text>
        {children}
    </Stack>
);

// ── StatNumber ────────────────────────────────────────────────────────────────

const StatNumber: FC<{ value: number; label?: string }> = ({ value, label }): ReactElement => (
    <Stack>
        <Text variant="xxLarge" style={{ fontWeight: 700, lineHeight: 1 }}>{value}</Text>
        {label && <Text variant="small" style={{ color: '#605e5c', marginTop: 2 }}>{label}</Text>}
    </Stack>
);

// ── SectionHeader — titles with optional nav link ─────────────────────────────

type SectionHeaderProps = {
    title: string;
    iconName: string;
    linkText?: string;
    linkTo?: string;
};

const SectionHeader: FC<SectionHeaderProps> = ({ title, iconName, linkText, linkTo }): ReactElement => {
    const navigate = useNavigate();
    return (
        <Stack
            horizontal
            horizontalAlign="space-between"
            verticalAlign="center"
            style={{ marginBottom: 8 }}
        >
            <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                <Icon iconName={iconName} style={{ fontSize: 16, color: '#605e5c' }} />
                <Text variant="large" style={{ fontWeight: 600 }}>{title}</Text>
            </Stack>
            {linkText && linkTo && (
                <Text
                    variant="small"
                    style={{ color: '#0392ff', cursor: 'pointer' }}
                    onClick={() => navigate(linkTo)}
                >
                    {linkText} &rarr;
                </Text>
            )}
        </Stack>
    );
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    return new Date().toISOString().split('T')[0];
}

function truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max) + '…' : text;
}

// ── DashboardPage ─────────────────────────────────────────────────────────────

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
    const totalTasks = summary
        ? summary.taskCounts.notStarted + summary.taskCounts.inProgress + summary.taskCounts.completed
        : 0;

    // Are there items that need attention?
    const needsAttention = summary && (
        summary.urgentTasks.length > 0 ||
        summary.openIssuesCount > 0 ||
        summary.coachingFollowUpsDueCount > 0
    );

    return (
        <Stack tokens={stackPadding} style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
            {/* ── Page header ────────────────────────────────────────────── */}
            <Stack.Item tokens={stackItemPadding}>
                <Text variant="xxLarge" block style={{ fontWeight: 600 }}>Dashboard</Text>
                <Text variant="medium" style={{ color: '#605e5c' }}>
                    {formatDate(date)}
                </Text>
            </Stack.Item>

            {/* ── Error ──────────────────────────────────────────────────── */}
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

            {/* ── Loading ────────────────────────────────────────────────── */}
            {loading && (
                <Stack.Item tokens={stackItemPadding}>
                    <Stack horizontalAlign="center" style={{ padding: 40 }}>
                        <Spinner size={SpinnerSize.large} label="Loading dashboard…" />
                    </Stack>
                </Stack.Item>
            )}

            {/* ── Dashboard content ──────────────────────────────────────── */}
            {!loading && summary && (
                <>
                    {/* ── At-a-Glance counts ─────────────────────────────── */}
                    <Stack.Item tokens={stackItemPadding}>
                        <SectionHeader title="Shift Overview" iconName="ViewDashboard" />
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
                                        <Text variant="small" style={{ fontWeight: 700 }}>{totalTasks}</Text>
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

                    {/* ── Productivity Snapshot ───────────────────────────── */}
                    <Stack.Item tokens={stackItemPadding}>
                        <SectionHeader
                            title="Productivity Snapshot"
                            iconName="BarChart4"
                            linkText="View all"
                            linkTo="/productivity"
                        />
                        <Stack horizontal wrap tokens={stackGaps}>
                            <SummaryCard title="Units Stocked Today">
                                <StatNumber
                                    value={summary.productivitySnapshot.totalUnitsStocked}
                                    label="freight units"
                                />
                            </SummaryCard>
                            <SummaryCard title="Records Logged">
                                <StatNumber
                                    value={summary.productivitySnapshot.recordsLogged}
                                    label={summary.productivitySnapshot.recordsLogged === 1 ? 'productivity entry' : 'productivity entries'}
                                />
                            </SummaryCard>
                        </Stack>
                    </Stack.Item>

                    {/* ── Needs Attention ─────────────────────────────────── */}
                    {needsAttention && (
                        <Stack.Item tokens={stackItemPadding}>
                            <SectionHeader title="Needs Attention" iconName="Warning" />
                            <Stack tokens={stackGaps}>

                                {/* High-priority tasks */}
                                {summary.urgentTasks.length > 0 && (
                                    <Stack styles={{ root: cardBase }}>
                                        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 6 }} style={{ marginBottom: 8 }}>
                                            <Icon iconName="Important" style={{ color: '#d83b01', fontSize: 14 }} />
                                            <Text variant="medium" style={{ fontWeight: 600 }}>
                                                High-Priority Tasks
                                            </Text>
                                        </Stack>
                                        {summary.urgentTasks.map(t => (
                                            <Stack
                                                key={t.id}
                                                horizontal
                                                horizontalAlign="space-between"
                                                verticalAlign="center"
                                                style={{ padding: '6px 0', borderBottom: '1px solid #edebe9' }}
                                            >
                                                <Text variant="small" style={{ fontWeight: 500 }}>
                                                    {truncate(t.title, 50)}
                                                </Text>
                                                <Stack horizontal tokens={{ childrenGap: 8 }}>
                                                    {t.dueTime && (
                                                        <Text variant="small" style={{ color: '#605e5c' }}>
                                                            Due {t.dueTime}
                                                        </Text>
                                                    )}
                                                    <Text
                                                        variant="small"
                                                        style={{
                                                            color: t.status === 'inProgress' ? '#0078d4' : '#d83b01',
                                                            fontWeight: 600,
                                                            textTransform: 'capitalize',
                                                        }}
                                                    >
                                                        {t.status === 'notStarted' ? 'Not started' : 'In progress'}
                                                    </Text>
                                                </Stack>
                                            </Stack>
                                        ))}
                                        <ViewAllLink to="/tasks" label="View all tasks" />
                                    </Stack>
                                )}

                                {/* Recent open issues */}
                                {summary.recentOpenIssues.length > 0 && (
                                    <Stack styles={{ root: cardBase }}>
                                        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 6 }} style={{ marginBottom: 8 }}>
                                            <Icon iconName="AlertSolid" style={{ color: '#d83b01', fontSize: 14 }} />
                                            <Text variant="medium" style={{ fontWeight: 600 }}>
                                                Open Issues
                                            </Text>
                                        </Stack>
                                        {summary.recentOpenIssues.map(i => (
                                            <Stack
                                                key={i.id}
                                                style={{ padding: '6px 0', borderBottom: '1px solid #edebe9' }}
                                            >
                                                <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                                                    <Text variant="small" style={{ fontWeight: 500 }}>
                                                        {i.category}
                                                    </Text>
                                                    <Text variant="small" style={{ color: '#605e5c' }}>
                                                        {i.department} &middot; {i.storeDate}
                                                    </Text>
                                                </Stack>
                                                <Text variant="small" style={{ color: '#a19f9d', marginTop: 2 }}>
                                                    {truncate(i.description, 80)}
                                                </Text>
                                            </Stack>
                                        ))}
                                        <ViewAllLink to="/issues" label="View all issues" />
                                    </Stack>
                                )}

                                {/* Coaching follow-ups due */}
                                {summary.upcomingFollowUps.length > 0 && (
                                    <Stack styles={{ root: cardBase }}>
                                        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 6 }} style={{ marginBottom: 8 }}>
                                            <Icon iconName="Education" style={{ color: '#0078d4', fontSize: 14 }} />
                                            <Text variant="medium" style={{ fontWeight: 600 }}>
                                                Coaching Follow-ups Due
                                            </Text>
                                        </Stack>
                                        {summary.upcomingFollowUps.map(c => (
                                            <Stack
                                                key={c.id}
                                                horizontal
                                                horizontalAlign="space-between"
                                                verticalAlign="center"
                                                style={{ padding: '6px 0', borderBottom: '1px solid #edebe9' }}
                                            >
                                                <Stack>
                                                    <Text variant="small" style={{ fontWeight: 500 }}>
                                                        {c.employeeName}
                                                    </Text>
                                                    <Text variant="small" style={{ color: '#a19f9d' }}>
                                                        {truncate(c.topic, 50)}
                                                    </Text>
                                                </Stack>
                                                {c.followUpDate && (
                                                    <Text variant="small" style={{ color: '#605e5c' }}>
                                                        Due {c.followUpDate}
                                                    </Text>
                                                )}
                                            </Stack>
                                        ))}
                                        <ViewAllLink to="/coaching" label="View all coaching" />
                                    </Stack>
                                )}
                            </Stack>
                        </Stack.Item>
                    )}

                    {/* ── Latest Shift Summary ───────────────────────────── */}
                    <Stack.Item tokens={stackItemPadding}>
                        <SectionHeader
                            title="Latest Shift Summary"
                            iconName="ClipboardList"
                            linkText="View all"
                            linkTo="/summary"
                        />
                        {summary.latestSummary ? (
                            <Stack styles={{ root: cardBase }} tokens={{ childrenGap: 8 }}>
                                <Stack horizontal tokens={{ childrenGap: 12 }}>
                                    <Text variant="small" style={{ color: '#605e5c' }}>
                                        {summary.latestSummary.storeDate}
                                    </Text>
                                    <Text
                                        variant="small"
                                        style={{
                                            background: '#e1dfdd',
                                            padding: '1px 8px',
                                            borderRadius: 3,
                                            fontWeight: 600,
                                            textTransform: 'capitalize',
                                        }}
                                    >
                                        {summary.latestSummary.shiftLabel}
                                    </Text>
                                </Stack>
                                {summary.latestSummary.completedWork && (
                                    <Stack tokens={{ childrenGap: 2 }}>
                                        <Text variant="small" style={{ fontWeight: 600 }}>Completed</Text>
                                        <Text variant="small" style={{ color: '#a19f9d' }}>
                                            {truncate(summary.latestSummary.completedWork, 150)}
                                        </Text>
                                    </Stack>
                                )}
                                {summary.latestSummary.missedWork && (
                                    <Stack tokens={{ childrenGap: 2 }}>
                                        <Text variant="small" style={{ fontWeight: 600, color: '#d83b01' }}>Missed</Text>
                                        <Text variant="small" style={{ color: '#a19f9d' }}>
                                            {truncate(summary.latestSummary.missedWork, 150)}
                                        </Text>
                                    </Stack>
                                )}
                                {summary.latestSummary.followUpItems && (
                                    <Stack tokens={{ childrenGap: 2 }}>
                                        <Text variant="small" style={{ fontWeight: 600 }}>Follow-up Items</Text>
                                        <Text variant="small" style={{ color: '#a19f9d' }}>
                                            {truncate(summary.latestSummary.followUpItems, 150)}
                                        </Text>
                                    </Stack>
                                )}
                            </Stack>
                        ) : (
                            <Stack
                                horizontalAlign="center"
                                style={{
                                    padding: 24,
                                    border: '1px dashed #c8c6c4',
                                    borderRadius: 4,
                                }}
                            >
                                <Text variant="medium" style={{ color: '#605e5c' }}>
                                    No shift summary yet.
                                </Text>
                                <Text variant="small" style={{ color: '#a19f9d', marginTop: 4 }}>
                                    Write one from the Daily Summary page when the shift wraps up.
                                </Text>
                            </Stack>
                        )}
                    </Stack.Item>

                    {/* ── Empty state when everything is clear ────────────── */}
                    {!needsAttention && totalTasks === 0 && (
                        <Stack.Item tokens={stackItemPadding}>
                            <Stack
                                horizontalAlign="center"
                                style={{
                                    padding: 32,
                                    border: '1px dashed #c8c6c4',
                                    borderRadius: 4,
                                }}
                            >
                                <Icon iconName="Completed" style={{ fontSize: 32, color: '#107c10', marginBottom: 8 }} />
                                <Text variant="large" style={{ color: '#605e5c', fontWeight: 600 }}>
                                    All clear
                                </Text>
                                <Text variant="small" style={{ color: '#a19f9d', marginTop: 4 }}>
                                    No tasks, issues, or follow-ups for today. Start the shift from the Tasks page.
                                </Text>
                            </Stack>
                        </Stack.Item>
                    )}
                </>
            )}
        </Stack>
    );
};

// ── ViewAllLink — reusable "View all" navigation link ─────────────────────────

const ViewAllLink: FC<{ to: string; label: string }> = ({ to, label }): ReactElement => {
    const navigate = useNavigate();
    return (
        <Text
            variant="small"
            style={{ color: '#0392ff', cursor: 'pointer', marginTop: 8, display: 'inline-block' }}
            onClick={() => navigate(to)}
        >
            {label} &rarr;
        </Text>
    );
};

export default DashboardPage;
