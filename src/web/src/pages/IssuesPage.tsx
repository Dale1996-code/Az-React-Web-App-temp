import { FC, ReactElement, useCallback, useEffect, useState } from 'react';
import {
    DefaultButton,
    Dropdown,
    IDropdownOption,
    MessageBar,
    MessageBarType,
    Panel,
    PanelType,
    Stack,
    Text,
    TextField,
} from '@fluentui/react';
import { stackGaps, stackItemPadding, stackPadding } from '../ux/styles';
import { IssueLog, IssueFormData, IssueStatus } from '../models/issue';
import { getIssues, createIssue, updateIssue, deleteIssue } from '../services/issuesService';
import { useCrudPanel } from '../hooks/useCrudPanel';
import { useEmployees } from '../hooks/useEmployees';
import { todayISO, ISO_DATE_RE } from '../utils/dateUtils';
import ListState from '../components/ListState';
import PanelFooter from '../components/PanelFooter';
import DeleteDialog from '../components/DeleteDialog';
import ErrorBar from '../components/ErrorBar';

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS: IDropdownOption[] = [
    { key: 'Equipment failure',     text: 'Equipment failure' },
    { key: 'Safety hazard',         text: 'Safety hazard' },
    { key: 'Staff shortage',        text: 'Staff shortage' },
    { key: 'Customer complaint',    text: 'Customer complaint' },
    { key: 'Supplier / delivery',   text: 'Supplier / delivery' },
    { key: 'Facility issue',        text: 'Facility issue' },
    { key: 'Process / policy',      text: 'Process / policy' },
    { key: 'Inventory discrepancy', text: 'Inventory discrepancy' },
    { key: 'IT / system',           text: 'IT / system' },
    { key: 'Other',                 text: 'Other' },
];

const DEPARTMENT_OPTIONS: IDropdownOption[] = [
    { key: 'Front End',           text: 'Front End' },
    { key: 'Grocery',             text: 'Grocery' },
    { key: 'Produce',             text: 'Produce' },
    { key: 'Deli',                text: 'Deli' },
    { key: 'Bakery',              text: 'Bakery' },
    { key: 'Dairy',               text: 'Dairy' },
    { key: 'Frozen',              text: 'Frozen' },
    { key: 'Meat',                text: 'Meat' },
    { key: 'General Merchandise', text: 'General Merchandise' },
    { key: 'Receiving',           text: 'Receiving' },
    { key: 'Management',          text: 'Management' },
    { key: 'Other',               text: 'Other' },
];

const STATUS_OPTIONS: IDropdownOption[] = [
    { key: 'open',     text: 'Open' },
    { key: 'resolved', text: 'Resolved' },
];

const STATUS_FILTER_OPTIONS: IDropdownOption[] = [
    { key: '',         text: 'All statuses' },
    { key: 'open',     text: 'Open' },
    { key: 'resolved', text: 'Resolved' },
];

const STATUS_COLORS: Record<string, string> = {
    open:     '#d83b01',
    resolved: '#107c10',
};

// ── Types ──────────────────────────────────────────────────────────────────────

type FormState = {
    storeDate: string;
    category: string;
    status: IssueStatus;
    department: string;
    description: string;
    reportedByEmployeeId: string;
    resolvedAt: string;
    resolutionNotes: string;
};

const emptyForm = (date?: string): FormState => ({
    storeDate:            date ?? todayISO(),
    category:             '',
    status:               'open',
    department:           '',
    description:          '',
    reportedByEmployeeId: '',
    resolvedAt:           '',
    resolutionNotes:      '',
});

// ── IssueRow ───────────────────────────────────────────────────────────────────

type IssueRowProps = {
    issue: IssueLog;
    employeeMap: Map<string, { firstName: string; lastName: string }>;
    onEdit: (issue: IssueLog) => void;
    onDelete: (issue: IssueLog) => void;
    onResolve: (issue: IssueLog) => void;
};

const IssueRow: FC<IssueRowProps> = ({
    issue,
    employeeMap,
    onEdit,
    onDelete,
    onResolve,
}): ReactElement => {
    const reporter = issue.reportedByEmployeeId
        ? employeeMap.get(issue.reportedByEmployeeId)
        : undefined;
    const reporterName = reporter
        ? `${reporter.firstName} ${reporter.lastName}`
        : issue.reportedByEmployeeId || '';

    const statusColor = STATUS_COLORS[issue.status] ?? '#605e5c';

    return (
        <Stack
            horizontal
            wrap
            tokens={{ childrenGap: 8 }}
            styles={{
                root: {
                    padding: '12px 16px',
                    borderBottom: '1px solid #edebe9',
                    alignItems: 'center',
                },
            }}
        >
            {/* Date + department */}
            <Stack.Item style={{ minWidth: 150 }}>
                <Text variant="medium" style={{ fontWeight: 600, display: 'block' }}>
                    {issue.storeDate}
                </Text>
                <Text variant="small" style={{ color: '#605e5c' }}>
                    {issue.department}
                </Text>
            </Stack.Item>

            {/* Category + description */}
            <Stack.Item grow={2} style={{ minWidth: 220 }}>
                <Text variant="medium" style={{ fontWeight: 600, display: 'block' }}>
                    {issue.category}
                </Text>
                <Text
                    variant="small"
                    style={{
                        color: '#605e5c',
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 320,
                    }}
                    title={issue.description}
                >
                    {issue.description}
                </Text>
                {reporterName && (
                    <Text variant="small" style={{ color: '#a19f9d' }}>
                        Reported by: {reporterName}
                    </Text>
                )}
            </Stack.Item>

            {/* Status + resolved info */}
            <Stack.Item style={{ minWidth: 130 }}>
                <Text
                    variant="small"
                    style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        borderRadius: 12,
                        background: statusColor + '22',
                        color: statusColor,
                        fontWeight: 600,
                        textTransform: 'capitalize',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {issue.status}
                </Text>
                {issue.status === 'resolved' && issue.resolvedAt && (
                    <Text variant="small" style={{ color: '#605e5c', display: 'block', marginTop: 4 }}>
                        {issue.resolvedAt.split('T')[0]}
                    </Text>
                )}
            </Stack.Item>

            {/* Actions */}
            <Stack.Item>
                <Stack horizontal tokens={{ childrenGap: 8 }}>
                    {issue.status === 'open' && (
                        <DefaultButton
                            text="Resolve"
                            iconProps={{ iconName: 'CheckMark' }}
                            onClick={() => onResolve(issue)}
                            styles={{
                                root: { minWidth: 0, padding: '0 10px', height: 28 },
                                label: { color: '#107c10' },
                            }}
                        />
                    )}
                    <DefaultButton
                        text="Edit"
                        iconProps={{ iconName: 'Edit' }}
                        onClick={() => onEdit(issue)}
                        styles={{ root: { minWidth: 0, padding: '0 10px', height: 28 } }}
                    />
                    <DefaultButton
                        text="Remove"
                        iconProps={{ iconName: 'Delete' }}
                        onClick={() => onDelete(issue)}
                        styles={{
                            root: { minWidth: 0, padding: '0 10px', height: 28 },
                            label: { color: '#a4262c' },
                        }}
                    />
                </Stack>
            </Stack.Item>
        </Stack>
    );
};

// ── IssueForm ──────────────────────────────────────────────────────────────────

type IssueFormProps = {
    form: FormState;
    onChange: (updates: Partial<FormState>) => void;
    errors: Partial<Record<keyof FormState, string>>;
    employeeOptions: IDropdownOption[];
};

const IssueForm: FC<IssueFormProps> = ({
    form,
    onChange,
    errors,
    employeeOptions,
}): ReactElement => {
    return (
        <Stack tokens={stackGaps} style={{ padding: '0 16px' }}>
            <TextField
                label="Date"
                required
                value={form.storeDate}
                onChange={(_, v) => onChange({ storeDate: v ?? '' })}
                errorMessage={errors.storeDate}
                placeholder="YYYY-MM-DD"
            />

            <Dropdown
                label="Category"
                required
                selectedKey={form.category || null}
                options={CATEGORY_OPTIONS}
                onChange={(_, opt) => onChange({ category: (opt?.key as string) ?? '' })}
                errorMessage={errors.category}
                placeholder="Select category…"
            />

            <Dropdown
                label="Department"
                required
                selectedKey={form.department || null}
                options={DEPARTMENT_OPTIONS}
                onChange={(_, opt) => onChange({ department: (opt?.key as string) ?? '' })}
                errorMessage={errors.department}
                placeholder="Select department…"
            />

            <TextField
                label="Description"
                required
                multiline
                rows={3}
                resizable={false}
                value={form.description}
                onChange={(_, v) => onChange({ description: v ?? '' })}
                errorMessage={errors.description}
                placeholder="Brief description of the issue…"
            />

            <Dropdown
                label="Status"
                required
                selectedKey={form.status || null}
                options={STATUS_OPTIONS}
                onChange={(_, opt) => onChange({ status: (opt?.key as IssueStatus) ?? 'open' })}
                placeholder="Select status…"
            />

            <Dropdown
                label="Reported by"
                selectedKey={form.reportedByEmployeeId || null}
                options={[{ key: '', text: 'None / unknown' }, ...employeeOptions]}
                onChange={(_, opt) => onChange({ reportedByEmployeeId: (opt?.key as string) ?? '' })}
                placeholder="Select employee (optional)…"
            />

            <TextField
                label="Resolved at"
                value={form.resolvedAt}
                onChange={(_, v) => onChange({ resolvedAt: v ?? '' })}
                placeholder="YYYY-MM-DDTHH:MM (optional, auto-set on quick-resolve)"
            />

            <TextField
                label="Resolution notes"
                multiline
                rows={3}
                resizable={false}
                value={form.resolutionNotes}
                onChange={(_, v) => onChange({ resolutionNotes: v ?? '' })}
                placeholder="Steps taken, root cause, follow-up actions…"
            />
        </Stack>
    );
};

// ── IssuesPage ─────────────────────────────────────────────────────────────────

const IssuesPage: FC = (): ReactElement => {
    const [issues, setIssues] = useState<IssueLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);

    const [filterDate, setFilterDate] = useState('');
    const [filterStatus, setFilterStatus] = useState('open');
    const [filterDept, setFilterDept] = useState('');
    const [filterCategory, setFilterCategory] = useState('');

    const { employeeMap, employeeOptions } = useEmployees();

    const {
        panelOpen, setPanelOpen,
        editing,
        form,
        formErrors, setFormErrors,
        saving, setSaving,
        saveError, setSaveError,
        deleteTarget, setDeleteTarget,
        deleting, setDeleting,
        deleteError, setDeleteError,
        openCreate, openEdit, closePanel, updateForm,
    } = useCrudPanel<IssueLog, FormState>(emptyForm());

    // ── Load issues ────────────────────────────────────────────────────────────

    const load = useCallback(async (
        date: string,
        status: string,
        dept: string,
        category: string,
    ) => {
        setLoading(true);
        setListError(null);
        try {
            const query: { date?: string; status?: string; department?: string; category?: string } = {};
            if (date)     query.date       = date;
            if (status)   query.status     = status;
            if (dept)     query.department = dept;
            if (category) query.category   = category;
            const data = await getIssues(query);
            setIssues(data);
        } catch {
            setListError('Failed to load issues. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load(filterDate, filterStatus, filterDept, filterCategory);
    }, [load, filterDate, filterStatus, filterDept, filterCategory]);

    // ── Panel helpers ──────────────────────────────────────────────────────────

    const handleOpenEdit = (issue: IssueLog) => {
        openEdit(issue, {
            storeDate:            issue.storeDate,
            category:             issue.category,
            status:               issue.status,
            department:           issue.department,
            description:          issue.description,
            reportedByEmployeeId: issue.reportedByEmployeeId ?? '',
            resolvedAt:           issue.resolvedAt ?? '',
            resolutionNotes:      issue.resolutionNotes ?? '',
        });
    };

    // ── Validation ─────────────────────────────────────────────────────────────

    const validateForm = (): boolean => {
        const errs: Partial<Record<keyof FormState, string>> = {};

        if (!ISO_DATE_RE.test(form.storeDate))
            errs.storeDate = 'Date must be YYYY-MM-DD.';
        if (!form.category.trim())
            errs.category = 'Category is required.';
        if (!form.department.trim())
            errs.department = 'Department is required.';
        if (!form.description.trim())
            errs.description = 'Description is required.';

        setFormErrors(errs);
        return Object.keys(errs).length === 0;
    };

    // ── Save ───────────────────────────────────────────────────────────────────

    const handleSave = async () => {
        if (!validateForm()) return;
        setSaving(true);
        setSaveError(null);

        const payload: IssueFormData = {
            storeDate:   form.storeDate,
            category:    form.category.trim(),
            status:      form.status,
            department:  form.department.trim(),
            description: form.description.trim(),
            ...(form.reportedByEmployeeId   && { reportedByEmployeeId: form.reportedByEmployeeId }),
            ...(form.resolvedAt             && { resolvedAt:           form.resolvedAt }),
            ...(form.resolutionNotes.trim() && { resolutionNotes:      form.resolutionNotes.trim() }),
        };

        try {
            if (editing) {
                await updateIssue(editing.id, payload);
            } else {
                await createIssue(payload);
            }
            setPanelOpen(false);
            await load(filterDate, filterStatus, filterDept, filterCategory);
        } catch {
            setSaveError('Save failed. Check your inputs and try again.');
        } finally {
            setSaving(false);
        }
    };

    // ── Quick-resolve ──────────────────────────────────────────────────────────

    const handleResolve = async (issue: IssueLog) => {
        try {
            await updateIssue(issue.id, {
                status:     'resolved',
                resolvedAt: new Date().toISOString(),
            });
            await load(filterDate, filterStatus, filterDept, filterCategory);
        } catch {
            setListError('Failed to mark issue as resolved. Please try again.');
        }
    };

    // ── Delete ─────────────────────────────────────────────────────────────────

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        setDeleteError(null);
        try {
            await deleteIssue(deleteTarget.id);
            setDeleteTarget(null);
            await load(filterDate, filterStatus, filterDept, filterCategory);
        } catch {
            setDeleteError('Delete failed. Please try again.');
        } finally {
            setDeleting(false);
        }
    };

    const categoryFilterOptions: IDropdownOption[] = [
        { key: '', text: 'All categories' },
        ...CATEGORY_OPTIONS,
    ];

    const deptFilterOptions: IDropdownOption[] = [
        { key: '', text: 'All departments' },
        ...DEPARTMENT_OPTIONS,
    ];

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <Stack tokens={stackPadding} style={{ maxWidth: 960, margin: '0 auto', width: '100%' }}>
            {/* Page header */}
            <Stack.Item tokens={stackItemPadding}>
                <Stack
                    horizontal
                    horizontalAlign="space-between"
                    verticalAlign="center"
                    wrap
                    tokens={{ childrenGap: 12 }}
                >
                    <Stack.Item>
                        <Text variant="xxLarge" block style={{ fontWeight: 600 }}>Issues</Text>
                        <Text variant="medium" style={{ color: '#605e5c' }}>
                            Shift issue log — capture, track, and resolve operational issues
                        </Text>
                    </Stack.Item>
                    <Stack.Item>
                        <DefaultButton
                            text="Log Issue"
                            iconProps={{ iconName: 'Add' }}
                            onClick={() => openCreate(emptyForm(filterDate || todayISO()))}
                            primary
                        />
                    </Stack.Item>
                </Stack>
            </Stack.Item>

            {/* Filters */}
            <Stack.Item tokens={stackItemPadding}>
                <Stack horizontal wrap tokens={{ childrenGap: 12 }} verticalAlign="end">
                    <TextField
                        label="Date"
                        value={filterDate}
                        onChange={(_, v) => setFilterDate(v ?? '')}
                        placeholder="YYYY-MM-DD"
                        styles={{ root: { width: 150 } }}
                    />
                    <Dropdown
                        label="Status"
                        selectedKey={filterStatus}
                        options={STATUS_FILTER_OPTIONS}
                        onChange={(_, opt) => setFilterStatus((opt?.key as string) ?? '')}
                        styles={{ root: { minWidth: 150 } }}
                    />
                    <Dropdown
                        label="Department"
                        selectedKey={filterDept}
                        options={deptFilterOptions}
                        onChange={(_, opt) => setFilterDept((opt?.key as string) ?? '')}
                        styles={{ root: { minWidth: 180 } }}
                    />
                    <Dropdown
                        label="Category"
                        selectedKey={filterCategory}
                        options={categoryFilterOptions}
                        onChange={(_, opt) => setFilterCategory((opt?.key as string) ?? '')}
                        styles={{ root: { minWidth: 200 } }}
                    />
                    <DefaultButton
                        text="Clear"
                        iconProps={{ iconName: 'ClearFilter' }}
                        onClick={() => { setFilterDate(''); setFilterStatus('open'); setFilterDept(''); setFilterCategory(''); }}
                    />
                </Stack>
            </Stack.Item>

            {/* List error */}
            {listError && (
                <Stack.Item tokens={stackItemPadding}>
                    <ErrorBar message={listError} onDismiss={() => setListError(null)} />
                </Stack.Item>
            )}

            {/* Issues list */}
            <Stack.Item tokens={stackItemPadding}>
                <ListState
                    loading={loading}
                    loadingLabel="Loading issues…"
                    empty={issues.length === 0}
                    emptyContent={
                        <>
                            <Text variant="large" style={{ color: '#605e5c', marginBottom: 8 }}>
                                No issues found.
                            </Text>
                            <DefaultButton
                                text="Log first issue"
                                iconProps={{ iconName: 'Add' }}
                                onClick={() => openCreate(emptyForm(filterDate || todayISO()))}
                            />
                        </>
                    }
                >
                    {issues.map(issue => (
                        <IssueRow
                            key={issue.id}
                            issue={issue}
                            employeeMap={employeeMap}
                            onEdit={handleOpenEdit}
                            onDelete={setDeleteTarget}
                            onResolve={handleResolve}
                        />
                    ))}
                </ListState>
            </Stack.Item>

            {/* Record count */}
            {!loading && issues.length > 0 && (
                <Stack.Item tokens={stackItemPadding}>
                    <Text variant="small" style={{ color: '#a19f9d' }}>
                        {issues.length} issue{issues.length !== 1 ? 's' : ''}
                    </Text>
                </Stack.Item>
            )}

            {/* Create / Edit panel */}
            <Panel
                isOpen={panelOpen}
                onDismiss={closePanel}
                type={PanelType.smallFixedFar}
                headerText={editing ? 'Edit Issue' : 'Log New Issue'}
                onRenderFooterContent={() => (
                    <PanelFooter saving={saving} onSave={handleSave} onCancel={closePanel} />
                )}
                isFooterAtBottom
            >
                <Stack tokens={stackGaps} style={{ marginTop: 16 }}>
                    {saveError && (
                        <MessageBar
                            messageBarType={MessageBarType.error}
                            onDismiss={() => setSaveError(null)}
                            dismissButtonAriaLabel="Dismiss"
                        >
                            {saveError}
                        </MessageBar>
                    )}
                    <IssueForm
                        form={form}
                        onChange={updateForm}
                        errors={formErrors}
                        employeeOptions={employeeOptions}
                    />
                </Stack>
            </Panel>

            {/* Delete confirmation dialog */}
            <DeleteDialog
                hidden={!deleteTarget}
                title="Remove issue"
                subText={deleteTarget
                    ? `Remove the "${deleteTarget.category}" issue from ${deleteTarget.storeDate}? This cannot be undone.`
                    : ''}
                deleting={deleting}
                deleteError={deleteError}
                onConfirm={handleDeleteConfirm}
                onDismiss={() => { if (!deleting) setDeleteTarget(null); }}
            />
        </Stack>
    );
};

export default IssuesPage;
