import { FC, ReactElement, useCallback, useEffect, useState } from 'react';
import {
    DefaultButton,
    Dialog,
    DialogFooter,
    DialogType,
    Dropdown,
    IDropdownOption,
    MessageBar,
    MessageBarType,
    Panel,
    PanelType,
    PrimaryButton,
    Spinner,
    SpinnerSize,
    Stack,
    Text,
    TextField,
} from '@fluentui/react';
import { stackGaps, stackItemPadding, stackPadding } from '../ux/styles';
import { IssueLog, IssueFormData, IssueStatus } from '../models/issue';
import { getIssues, createIssue, updateIssue, deleteIssue } from '../services/issuesService';
import { Employee } from '../models/employee';
import { getEmployees } from '../services/employeesService';

// ── Constants ──────────────────────────────────────────────────────────────────

// Common retail/operations issue categories.
const CATEGORY_OPTIONS: IDropdownOption[] = [
    { key: 'Equipment failure',    text: 'Equipment failure' },
    { key: 'Safety hazard',        text: 'Safety hazard' },
    { key: 'Staff shortage',       text: 'Staff shortage' },
    { key: 'Customer complaint',   text: 'Customer complaint' },
    { key: 'Supplier / delivery',  text: 'Supplier / delivery' },
    { key: 'Facility issue',       text: 'Facility issue' },
    { key: 'Process / policy',     text: 'Process / policy' },
    { key: 'Inventory discrepancy',text: 'Inventory discrepancy' },
    { key: 'IT / system',          text: 'IT / system' },
    { key: 'Other',                text: 'Other' },
];

// Common retail departments.
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

// Status display colours matching the app's neutral palette.
const STATUS_COLORS: Record<string, string> = {
    open:     '#d83b01', // orange-red
    resolved: '#107c10', // green
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function todayISO(): string {
    return new Date().toISOString().split('T')[0];
}

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
    employeeMap: Map<string, Employee>;
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
                        display: 'block',
                        color: statusColor,
                        fontWeight: 600,
                        textTransform: 'capitalize',
                    }}
                >
                    {issue.status}
                </Text>
                {issue.status === 'resolved' && issue.resolvedAt && (
                    <Text variant="small" style={{ color: '#605e5c' }}>
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

            {/* Resolution fields — only relevant when resolving */}
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

    // Filters — status defaults to 'open' so the list is actionable at a glance.
    const [filterDate, setFilterDate] = useState('');
    const [filterStatus, setFilterStatus] = useState('open');
    const [filterDept, setFilterDept] = useState('');
    const [filterCategory, setFilterCategory] = useState('');

    // Employee lookup for display + dropdown.
    const [employeeMap, setEmployeeMap] = useState<Map<string, Employee>>(new Map());
    const [employeeOptions, setEmployeeOptions] = useState<IDropdownOption[]>([]);

    // Panel state
    const [panelOpen, setPanelOpen] = useState(false);
    const [editing, setEditing] = useState<IssueLog | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm());
    const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({});
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Delete dialog
    const [deleteTarget, setDeleteTarget] = useState<IssueLog | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // ── Load employees once ────────────────────────────────────────────────────

    useEffect(() => {
        getEmployees({ active: true }).then(list => {
            const map = new Map<string, Employee>();
            const opts: IDropdownOption[] = [];
            list.forEach(emp => {
                map.set(emp.id, emp);
                opts.push({
                    key: emp.id,
                    text: `${emp.firstName} ${emp.lastName}${emp.department ? ` (${emp.department})` : ''}`,
                });
            });
            setEmployeeMap(map);
            setEmployeeOptions(opts);
        }).catch(() => {
            // Non-fatal — reporter name will fall back to ID if this fails.
        });
    }, []);

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

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm(filterDate || todayISO()));
        setFormErrors({});
        setSaveError(null);
        setPanelOpen(true);
    };

    const openEdit = (issue: IssueLog) => {
        setEditing(issue);
        setForm({
            storeDate:            issue.storeDate,
            category:             issue.category,
            status:               issue.status,
            department:           issue.department,
            description:          issue.description,
            reportedByEmployeeId: issue.reportedByEmployeeId ?? '',
            resolvedAt:           issue.resolvedAt ?? '',
            resolutionNotes:      issue.resolutionNotes ?? '',
        });
        setFormErrors({});
        setSaveError(null);
        setPanelOpen(true);
    };

    const closePanel = () => {
        if (saving) return;
        setPanelOpen(false);
    };

    const updateForm = (updates: Partial<FormState>) => {
        setForm(prev => ({ ...prev, ...updates }));
        // Clear field-level errors as the user types.
        const cleared = { ...formErrors };
        (Object.keys(updates) as (keyof FormState)[]).forEach(k => delete cleared[k]);
        setFormErrors(cleared);
    };

    // ── Client-side validation ─────────────────────────────────────────────────

    const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
            ...(form.reportedByEmployeeId && { reportedByEmployeeId: form.reportedByEmployeeId }),
            ...(form.resolvedAt           && { resolvedAt:           form.resolvedAt }),
            ...(form.resolutionNotes.trim() && { resolutionNotes:    form.resolutionNotes.trim() }),
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

    // One-click status change from open → resolved, stamping resolvedAt automatically.
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

    // Category filter options with "All" prepended.
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
        <Stack tokens={stackPadding} style={{ maxWidth: 1040, margin: '0 auto', width: '100%' }}>
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
                        <PrimaryButton
                            text="Log Issue"
                            iconProps={{ iconName: 'Add' }}
                            onClick={openCreate}
                        />
                    </Stack.Item>
                </Stack>
            </Stack.Item>

            {/* Filters */}
            <Stack.Item tokens={stackItemPadding}>
                <Stack horizontal wrap tokens={{ childrenGap: 16 }} verticalAlign="end">
                    <TextField
                        label="Date"
                        value={filterDate}
                        onChange={(_, v) => setFilterDate(v ?? '')}
                        placeholder="YYYY-MM-DD"
                        styles={{ root: { width: 150 } }}
                        description="Leave blank for all dates"
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
                </Stack>
            </Stack.Item>

            {/* List error */}
            {listError && (
                <Stack.Item tokens={stackItemPadding}>
                    <MessageBar
                        messageBarType={MessageBarType.error}
                        onDismiss={() => setListError(null)}
                        dismissButtonAriaLabel="Dismiss"
                    >
                        {listError}
                    </MessageBar>
                </Stack.Item>
            )}

            {/* Issues list */}
            <Stack.Item tokens={stackItemPadding}>
                {loading ? (
                    <Stack horizontalAlign="center" style={{ padding: 40 }}>
                        <Spinner size={SpinnerSize.large} label="Loading issues…" />
                    </Stack>
                ) : issues.length === 0 ? (
                    <Stack
                        horizontalAlign="center"
                        style={{
                            padding: 40,
                            border: '1px dashed #c8c6c4',
                            borderRadius: 4,
                        }}
                    >
                        <Text variant="large" style={{ color: '#605e5c', marginBottom: 8 }}>
                            No issues found.
                        </Text>
                        <DefaultButton
                            text="Log first issue"
                            iconProps={{ iconName: 'Add' }}
                            onClick={openCreate}
                        />
                    </Stack>
                ) : (
                    <Stack
                        styles={{
                            root: {
                                border: '1px solid #edebe9',
                                borderRadius: 4,
                                overflow: 'hidden',
                            },
                        }}
                    >
                        {issues.map(issue => (
                            <IssueRow
                                key={issue.id}
                                issue={issue}
                                employeeMap={employeeMap}
                                onEdit={openEdit}
                                onDelete={setDeleteTarget}
                                onResolve={handleResolve}
                            />
                        ))}
                    </Stack>
                )}
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
                    <Stack
                        horizontal
                        tokens={{ childrenGap: 8 }}
                        style={{ padding: '16px 0' }}
                    >
                        <PrimaryButton
                            text={saving ? 'Saving…' : 'Save'}
                            onClick={handleSave}
                            disabled={saving}
                        />
                        <DefaultButton text="Cancel" onClick={closePanel} disabled={saving} />
                    </Stack>
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
            <Dialog
                hidden={!deleteTarget}
                onDismiss={() => !deleting && setDeleteTarget(null)}
                dialogContentProps={{
                    type: DialogType.normal,
                    title: 'Remove issue',
                    subText: deleteTarget
                        ? `Remove the "${deleteTarget.category}" issue from ${deleteTarget.storeDate}? This cannot be undone.`
                        : '',
                }}
                modalProps={{ isBlocking: true }}
            >
                {deleteError && (
                    <MessageBar
                        messageBarType={MessageBarType.error}
                        styles={{ root: { marginBottom: 8 } }}
                    >
                        {deleteError}
                    </MessageBar>
                )}
                <DialogFooter>
                    <PrimaryButton
                        text={deleting ? 'Removing…' : 'Remove'}
                        onClick={handleDeleteConfirm}
                        disabled={deleting}
                        styles={{ root: { background: '#a4262c', borderColor: '#a4262c' } }}
                    />
                    <DefaultButton
                        text="Cancel"
                        onClick={() => setDeleteTarget(null)}
                        disabled={deleting}
                    />
                </DialogFooter>
            </Dialog>
        </Stack>
    );
};

export default IssuesPage;
