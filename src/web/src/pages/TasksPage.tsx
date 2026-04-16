import { FC, ReactElement, useCallback, useEffect, useRef, useState } from 'react';
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
import { Task, TaskFormData, TaskPriority, TaskStatus, TasksQuery } from '../models/task';
import { createTask, deleteTask, getTasks, updateTask } from '../services/tasksService';
import { Employee } from '../models/employee';
import { getEmployees } from '../services/employeesService';

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: IDropdownOption[] = [
    { key: 'notStarted', text: 'Not Started' },
    { key: 'inProgress', text: 'In Progress' },
    { key: 'completed',  text: 'Completed' },
];

const PRIORITY_OPTIONS: IDropdownOption[] = [
    { key: 'low',    text: 'Low' },
    { key: 'medium', text: 'Medium' },
    { key: 'high',   text: 'High' },
];

const STATUS_FILTER_OPTIONS: IDropdownOption[] = [
    { key: '', text: 'All statuses' },
    ...STATUS_OPTIONS,
];

const STATUS_COLORS: Record<TaskStatus, string> = {
    notStarted: '#a19f9d',
    inProgress: '#0078d4',
    completed:  '#107c10',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
    notStarted: 'Not Started',
    inProgress: 'In Progress',
    completed:  'Completed',
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
    low:    'Low',
    medium: 'Medium',
    high:   'High',
};

function todayISO(): string {
    return new Date().toISOString().split('T')[0];
}

// ── Types ──────────────────────────────────────────────────────────────────────

type TaskFormState = {
    title: string;
    status: TaskStatus | '';
    storeDate: string;
    department: string;
    assignedEmployeeId: string;
    description: string;
    priority: TaskPriority | '';
    dueTime: string;
    notes: string;
    completedAt: string;
};

const emptyForm = (date?: string): TaskFormState => ({
    title: '',
    status: 'notStarted',
    storeDate: date ?? todayISO(),
    department: '',
    assignedEmployeeId: '',
    description: '',
    priority: '',
    dueTime: '',
    notes: '',
    completedAt: '',
});

// ── TaskRow ────────────────────────────────────────────────────────────────────

type TaskRowProps = {
    task: Task;
    employeeMap: Map<string, Employee>;
    onEdit: (task: Task) => void;
    onDelete: (task: Task) => void;
};

const TaskRow: FC<TaskRowProps> = ({ task, employeeMap, onEdit, onDelete }): ReactElement => {
    const assignee = task.assignedEmployeeId ? employeeMap.get(task.assignedEmployeeId) : undefined;
    const assigneeName = assignee ? `${assignee.firstName} ${assignee.lastName}` : undefined;

    const meta: string[] = [task.department];
    if (assigneeName)   meta.push(assigneeName);
    if (task.priority)  meta.push(PRIORITY_LABELS[task.priority]);
    if (task.dueTime)   meta.push(task.dueTime);

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
            {/* Status dot */}
            <Stack.Item>
                <span
                    title={STATUS_LABELS[task.status]}
                    style={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: STATUS_COLORS[task.status],
                        marginRight: 4,
                        flexShrink: 0,
                    }}
                />
            </Stack.Item>

            {/* Title + meta */}
            <Stack.Item grow={1} style={{ minWidth: 180 }}>
                <Text variant="medium" style={{ fontWeight: 600, display: 'block' }}>
                    {task.title}
                </Text>
                <Text variant="small" style={{ color: '#605e5c' }}>
                    {meta.join(' · ')}
                </Text>
            </Stack.Item>

            {/* Status badge */}
            <Stack.Item>
                <Text
                    variant="small"
                    style={{
                        padding: '2px 10px',
                        borderRadius: 12,
                        background: STATUS_COLORS[task.status] + '22',
                        color: STATUS_COLORS[task.status],
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                    }}
                >
                    {STATUS_LABELS[task.status]}
                </Text>
            </Stack.Item>

            {/* Actions */}
            <Stack.Item>
                <Stack horizontal tokens={{ childrenGap: 8 }}>
                    <DefaultButton
                        text="Edit"
                        iconProps={{ iconName: 'Edit' }}
                        onClick={() => onEdit(task)}
                        styles={{ root: { minWidth: 0, padding: '0 10px', height: 28 } }}
                    />
                    <DefaultButton
                        text="Remove"
                        iconProps={{ iconName: 'Delete' }}
                        onClick={() => onDelete(task)}
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

// ── TaskForm ───────────────────────────────────────────────────────────────────

type TaskFormProps = {
    form: TaskFormState;
    onChange: (updates: Partial<TaskFormState>) => void;
    errors: Partial<Record<keyof TaskFormState, string>>;
    employees: Employee[];
    loadingEmployees: boolean;
};

const TaskForm: FC<TaskFormProps> = ({ form, onChange, errors, employees, loadingEmployees }): ReactElement => {
    const employeeOptions: IDropdownOption[] = [
        { key: '', text: 'Unassigned' },
        ...employees.map(e => ({
            key: e.id,
            text: `${e.firstName} ${e.lastName}${e.department ? ` (${e.department})` : ''}`,
        })),
    ];

    return (
        <Stack tokens={stackGaps} style={{ padding: '0 16px' }}>
            <TextField
                label="Title"
                required
                value={form.title}
                onChange={(_, v) => onChange({ title: v ?? '' })}
                errorMessage={errors.title}
                placeholder="e.g. Stock cereal aisle"
            />

            <Stack horizontal tokens={{ childrenGap: 12 }} wrap>
                <Stack.Item grow={1} style={{ minWidth: 140 }}>
                    <Dropdown
                        label="Status"
                        required
                        options={STATUS_OPTIONS}
                        selectedKey={form.status || null}
                        onChange={(_, opt) => onChange({ status: opt?.key as TaskStatus })}
                        errorMessage={errors.status}
                    />
                </Stack.Item>
                <Stack.Item grow={1} style={{ minWidth: 140 }}>
                    <Dropdown
                        label="Priority"
                        placeholder="— optional —"
                        options={PRIORITY_OPTIONS}
                        selectedKey={form.priority || null}
                        onChange={(_, opt) => onChange({ priority: (opt?.key as TaskPriority) ?? '' })}
                    />
                </Stack.Item>
            </Stack>

            <Stack horizontal tokens={{ childrenGap: 12 }} wrap>
                <Stack.Item grow={1} style={{ minWidth: 140 }}>
                    <TextField
                        label="Store date"
                        required
                        value={form.storeDate}
                        onChange={(_, v) => onChange({ storeDate: v ?? '' })}
                        errorMessage={errors.storeDate}
                        placeholder="YYYY-MM-DD"
                    />
                </Stack.Item>
                <Stack.Item grow={1} style={{ minWidth: 100 }}>
                    <TextField
                        label="Due time"
                        value={form.dueTime}
                        onChange={(_, v) => onChange({ dueTime: v ?? '' })}
                        placeholder="HH:MM"
                        errorMessage={errors.dueTime}
                    />
                </Stack.Item>
            </Stack>

            <TextField
                label="Department"
                required
                value={form.department}
                onChange={(_, v) => onChange({ department: v ?? '' })}
                errorMessage={errors.department}
                placeholder="e.g. Grocery, Produce"
            />

            <Dropdown
                label="Assign to"
                placeholder={loadingEmployees ? 'Loading employees…' : 'Unassigned'}
                options={employeeOptions}
                selectedKey={form.assignedEmployeeId || ''}
                onChange={(_, opt) => onChange({ assignedEmployeeId: (opt?.key as string) ?? '' })}
                disabled={loadingEmployees}
            />

            <TextField
                label="Description"
                multiline
                rows={2}
                value={form.description}
                onChange={(_, v) => onChange({ description: v ?? '' })}
                resizable={false}
                placeholder="Optional — what needs to be done?"
            />

            <TextField
                label="Notes"
                multiline
                rows={2}
                value={form.notes}
                onChange={(_, v) => onChange({ notes: v ?? '' })}
                resizable={false}
                placeholder="Optional — any shift notes"
            />

            {form.status === 'completed' && (
                <TextField
                    label="Completed at"
                    value={form.completedAt}
                    onChange={(_, v) => onChange({ completedAt: v ?? '' })}
                    placeholder="ISO datetime, e.g. 2026-04-15T14:30:00Z"
                />
            )}
        </Stack>
    );
};

// ── TasksPage ──────────────────────────────────────────────────────────────────

const TasksPage: FC = (): ReactElement => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);

    // Employees for assignment dropdown and display
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [employeeMap, setEmployeeMap] = useState<Map<string, Employee>>(new Map());
    const [loadingEmployees, setLoadingEmployees] = useState(false);

    // Filters
    const [filterDate, setFilterDate] = useState(todayISO());
    const [filterStatus, setFilterStatus] = useState<TaskStatus | ''>('');
    const [filterDept, setFilterDept] = useState('');
    const deptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Panel (create / edit)
    const [panelOpen, setPanelOpen] = useState(false);
    const [editing, setEditing] = useState<Task | null>(null);
    const [form, setForm] = useState<TaskFormState>(emptyForm());
    const [formErrors, setFormErrors] = useState<Partial<Record<keyof TaskFormState, string>>>({});
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Delete dialog
    const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // ── Data loading ───────────────────────────────────────────────────────────

    const load = useCallback(async (query?: TasksQuery) => {
        setLoading(true);
        setListError(null);
        try {
            const data = await getTasks(query);
            setTasks(data);
        } catch {
            setListError('Failed to load tasks. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    // Build query from the current filter state
    const currentQuery = useCallback(
        (overrides: Partial<TasksQuery> = {}): TasksQuery => {
            const q: TasksQuery = {};
            if (filterDate)        q.date       = filterDate;
            if (filterStatus)      q.status     = filterStatus;
            if (filterDept.trim()) q.department = filterDept.trim();
            return { ...q, ...overrides };
        },
        [filterDate, filterStatus, filterDept],
    );

    // Runs on mount (initial load) and whenever the status dropdown changes.
    // Date and department filters trigger load() directly in their own handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { load(currentQuery()); }, [filterStatus]);

    // Load active employees for the assignment dropdown
    const loadEmployees = useCallback(async () => {
        setLoadingEmployees(true);
        try {
            const data = await getEmployees({ active: true });
            setEmployees(data);
            const map = new Map<string, Employee>();
            data.forEach(e => map.set(e.id, e));
            setEmployeeMap(map);
        } catch {
            // non-fatal — assignment dropdown stays empty
        } finally {
            setLoadingEmployees(false);
        }
    }, []);

    useEffect(() => {
        loadEmployees();
    }, [loadEmployees]);

    // ── Filter handlers ────────────────────────────────────────────────────────

    const handleDateChange = (_: unknown, value?: string) => {
        setFilterDate(value ?? '');
    };

    const handleDateBlur = () => {
        load(currentQuery());
    };

    const handleDeptChange = (_: unknown, value?: string) => {
        const dept = value ?? '';
        setFilterDept(dept);
        if (deptTimer.current) clearTimeout(deptTimer.current);
        deptTimer.current = setTimeout(() => {
            load(currentQuery({ department: dept.trim() || undefined }));
        }, 400);
    };

    const handleClearFilters = () => {
        const today = todayISO();
        setFilterDate(today);
        setFilterStatus('');
        setFilterDept('');
        load({ date: today });
    };

    // ── Panel helpers ──────────────────────────────────────────────────────────

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm(filterDate || todayISO()));
        setFormErrors({});
        setSaveError(null);
        setPanelOpen(true);
    };

    const openEdit = (task: Task) => {
        setEditing(task);
        setForm({
            title:              task.title,
            status:             task.status,
            storeDate:          task.storeDate,
            department:         task.department,
            assignedEmployeeId: task.assignedEmployeeId ?? '',
            description:        task.description ?? '',
            priority:           task.priority ?? '',
            dueTime:            task.dueTime ?? '',
            notes:              task.notes ?? '',
            completedAt:        task.completedAt ?? '',
        });
        setFormErrors({});
        setSaveError(null);
        setPanelOpen(true);
    };

    const closePanel = () => {
        if (saving) return;
        setPanelOpen(false);
    };

    const updateForm = (updates: Partial<TaskFormState>) => {
        setForm(prev => ({ ...prev, ...updates }));
        const cleared = { ...formErrors };
        (Object.keys(updates) as (keyof TaskFormState)[]).forEach(k => delete cleared[k]);
        setFormErrors(cleared);
    };

    // ── Client-side validation ─────────────────────────────────────────────────

    const validateForm = (): boolean => {
        const errs: Partial<Record<keyof TaskFormState, string>> = {};
        if (!form.title.trim())          errs.title      = 'Title is required.';
        if (!form.status)                errs.status     = 'Status is required.';
        if (!form.storeDate.trim())      errs.storeDate  = 'Date is required (YYYY-MM-DD).';
        else if (!/^\d{4}-\d{2}-\d{2}$/.test(form.storeDate.trim()))
                                         errs.storeDate  = 'Date must be YYYY-MM-DD.';
        if (!form.department.trim())     errs.department = 'Department is required.';
        if (form.dueTime.trim() && !/^\d{2}:\d{2}$/.test(form.dueTime.trim()))
                                         errs.dueTime    = 'Due time must be HH:MM.';
        setFormErrors(errs);
        return Object.keys(errs).length === 0;
    };

    // ── Save ───────────────────────────────────────────────────────────────────

    const handleSave = async () => {
        if (!validateForm()) return;

        setSaving(true);
        setSaveError(null);

        const isCompleted = form.status === 'completed';
        const payload: TaskFormData = {
            title:               form.title.trim(),
            status:              form.status as TaskStatus,
            storeDate:           form.storeDate.trim(),
            department:          form.department.trim(),
            // Always send assignedEmployeeId so that clearing (null) is persisted on update
            assignedEmployeeId:  form.assignedEmployeeId || null,
            ...(form.description.trim()               && { description: form.description.trim() }),
            ...(form.priority                         && { priority:    form.priority as TaskPriority }),
            ...(form.dueTime.trim()                   && { dueTime:     form.dueTime.trim() }),
            ...(form.notes.trim()                     && { notes:       form.notes.trim() }),
            // Only send completedAt when the task is actually completed
            ...(isCompleted && form.completedAt.trim() && { completedAt: form.completedAt.trim() }),
        };

        try {
            if (editing) {
                await updateTask(editing.id, payload);
            } else {
                await createTask(payload);
            }
            setPanelOpen(false);
            await load(currentQuery());
        } catch {
            setSaveError('Save failed. Check your inputs and try again.');
        } finally {
            setSaving(false);
        }
    };

    // ── Delete ─────────────────────────────────────────────────────────────────

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        setDeleteError(null);
        try {
            await deleteTask(deleteTarget.id);
            setDeleteTarget(null);
            await load(currentQuery());
        } catch {
            setDeleteError('Delete failed. Please try again.');
        } finally {
            setDeleting(false);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <Stack tokens={stackPadding} style={{ maxWidth: 960, margin: '0 auto', width: '100%' }}>

            {/* Page header */}
            <Stack.Item tokens={stackItemPadding}>
                <Stack horizontal horizontalAlign="space-between" verticalAlign="center" wrap tokens={{ childrenGap: 12 }}>
                    <Stack.Item>
                        <Text variant="xxLarge" block style={{ fontWeight: 600 }}>Tasks</Text>
                        <Text variant="medium" style={{ color: '#605e5c' }}>
                            Track and assign daily tasks
                        </Text>
                    </Stack.Item>
                    <Stack.Item>
                        <PrimaryButton
                            text="New Task"
                            iconProps={{ iconName: 'Add' }}
                            onClick={openCreate}
                        />
                    </Stack.Item>
                </Stack>
            </Stack.Item>

            {/* Filters */}
            <Stack.Item tokens={stackItemPadding}>
                <Stack horizontal wrap tokens={{ childrenGap: 12 }} verticalAlign="end">
                    <Stack.Item style={{ minWidth: 160 }}>
                        <TextField
                            label="Date"
                            value={filterDate}
                            onChange={handleDateChange}
                            onBlur={handleDateBlur}
                            placeholder="YYYY-MM-DD"
                        />
                    </Stack.Item>
                    <Stack.Item style={{ minWidth: 160 }}>
                        <Dropdown
                            label="Status"
                            options={STATUS_FILTER_OPTIONS}
                            selectedKey={filterStatus}
                            onChange={(_, opt) => setFilterStatus((opt?.key as TaskStatus | '') ?? '')}
                        />
                    </Stack.Item>
                    <Stack.Item style={{ minWidth: 160 }}>
                        <TextField
                            label="Department"
                            value={filterDept}
                            onChange={handleDeptChange}
                            placeholder="All departments"
                        />
                    </Stack.Item>
                    <Stack.Item>
                        <DefaultButton
                            text="Clear"
                            iconProps={{ iconName: 'ClearFilter' }}
                            onClick={handleClearFilters}
                        />
                    </Stack.Item>
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

            {/* Task list */}
            <Stack.Item tokens={stackItemPadding}>
                {loading ? (
                    <Stack horizontalAlign="center" style={{ padding: 40 }}>
                        <Spinner size={SpinnerSize.large} label="Loading tasks…" />
                    </Stack>
                ) : tasks.length === 0 ? (
                    <Stack
                        horizontalAlign="center"
                        style={{ padding: 40, border: '1px dashed #c8c6c4', borderRadius: 4 }}
                    >
                        <Text variant="large" style={{ color: '#605e5c', marginBottom: 8 }}>
                            No tasks for these filters.
                        </Text>
                        <DefaultButton
                            text="Create a task"
                            iconProps={{ iconName: 'Add' }}
                            onClick={openCreate}
                        />
                    </Stack>
                ) : (
                    <Stack
                        styles={{ root: { border: '1px solid #edebe9', borderRadius: 4, overflow: 'hidden' } }}
                    >
                        {tasks.map(task => (
                            <TaskRow
                                key={task.id}
                                task={task}
                                employeeMap={employeeMap}
                                onEdit={openEdit}
                                onDelete={setDeleteTarget}
                            />
                        ))}
                    </Stack>
                )}
            </Stack.Item>

            {/* Task count */}
            {!loading && tasks.length > 0 && (
                <Stack.Item tokens={stackItemPadding}>
                    <Text variant="small" style={{ color: '#a19f9d' }}>
                        {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                    </Text>
                </Stack.Item>
            )}

            {/* Create / Edit panel */}
            <Panel
                isOpen={panelOpen}
                onDismiss={closePanel}
                type={PanelType.smallFixedFar}
                headerText={editing ? 'Edit Task' : 'New Task'}
                onRenderFooterContent={() => (
                    <Stack horizontal tokens={{ childrenGap: 8 }} style={{ padding: '16px 0' }}>
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
                    <TaskForm
                        form={form}
                        onChange={updateForm}
                        errors={formErrors}
                        employees={employees}
                        loadingEmployees={loadingEmployees}
                    />
                </Stack>
            </Panel>

            {/* Delete confirmation dialog */}
            <Dialog
                hidden={!deleteTarget}
                onDismiss={() => !deleting && setDeleteTarget(null)}
                dialogContentProps={{
                    type: DialogType.normal,
                    title: 'Remove task',
                    subText: deleteTarget
                        ? `Remove "${deleteTarget.title}"? This cannot be undone.`
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

export default TasksPage;
