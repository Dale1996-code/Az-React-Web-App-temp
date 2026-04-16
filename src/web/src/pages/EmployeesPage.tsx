import { FC, ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import {
    DefaultButton,
    Dialog,
    DialogFooter,
    DialogType,
    Label,
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
    Toggle,
} from '@fluentui/react';
import { stackGaps, stackItemPadding, stackPadding } from '../ux/styles';
import { Employee, EmployeeFormData } from '../models/employee';
import {
    createEmployee,
    deleteEmployee,
    getEmployees,
    updateEmployee,
} from '../services/employeesService';

// ── Types ──────────────────────────────────────────────────────────────────────

type FormState = {
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
    department: string;
    employeeCode: string;
    notes: string;
};

const emptyForm = (): FormState => ({
    firstName: '',
    lastName: '',
    role: '',
    isActive: true,
    department: '',
    employeeCode: '',
    notes: '',
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function displayName(e: Employee): string {
    return `${e.firstName} ${e.lastName}`;
}

// ── EmployeeRow ────────────────────────────────────────────────────────────────

type EmployeeRowProps = {
    employee: Employee;
    onEdit: (employee: Employee) => void;
    onDelete: (employee: Employee) => void;
};

const EmployeeRow: FC<EmployeeRowProps> = ({ employee, onEdit, onDelete }): ReactElement => {
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
                    title={employee.isActive ? 'Active' : 'Inactive'}
                    style={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: employee.isActive ? '#107c10' : '#a19f9d',
                        marginRight: 4,
                    }}
                />
            </Stack.Item>

            {/* Name + meta */}
            <Stack.Item grow={1} style={{ minWidth: 180 }}>
                <Text variant="medium" style={{ fontWeight: 600, display: 'block' }}>
                    {displayName(employee)}
                </Text>
                <Text variant="small" style={{ color: '#605e5c' }}>
                    {employee.role}
                    {employee.department ? ` · ${employee.department}` : ''}
                    {employee.employeeCode ? ` · #${employee.employeeCode}` : ''}
                </Text>
            </Stack.Item>

            {/* Actions */}
            <Stack.Item>
                <Stack horizontal tokens={{ childrenGap: 8 }}>
                    <DefaultButton
                        text="Edit"
                        iconProps={{ iconName: 'Edit' }}
                        onClick={() => onEdit(employee)}
                        styles={{ root: { minWidth: 0, padding: '0 10px', height: 28 } }}
                    />
                    <DefaultButton
                        text="Remove"
                        iconProps={{ iconName: 'Delete' }}
                        onClick={() => onDelete(employee)}
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

// ── EmployeeForm ───────────────────────────────────────────────────────────────

type EmployeeFormProps = {
    form: FormState;
    onChange: (updates: Partial<FormState>) => void;
    errors: Partial<Record<keyof FormState, string>>;
};

const EmployeeForm: FC<EmployeeFormProps> = ({ form, onChange, errors }): ReactElement => {
    return (
        <Stack tokens={stackGaps} style={{ padding: '0 16px' }}>
            <Stack horizontal tokens={{ childrenGap: 12 }} wrap>
                <Stack.Item grow={1} style={{ minWidth: 140 }}>
                    <TextField
                        label="First name"
                        required
                        value={form.firstName}
                        onChange={(_, v) => onChange({ firstName: v ?? '' })}
                        errorMessage={errors.firstName}
                        autoComplete="given-name"
                    />
                </Stack.Item>
                <Stack.Item grow={1} style={{ minWidth: 140 }}>
                    <TextField
                        label="Last name"
                        required
                        value={form.lastName}
                        onChange={(_, v) => onChange({ lastName: v ?? '' })}
                        errorMessage={errors.lastName}
                        autoComplete="family-name"
                    />
                </Stack.Item>
            </Stack>

            <TextField
                label="Role"
                required
                value={form.role}
                onChange={(_, v) => onChange({ role: v ?? '' })}
                errorMessage={errors.role}
                placeholder="e.g. Shift Lead, Associate"
            />

            <Stack horizontal tokens={{ childrenGap: 12 }} wrap>
                <Stack.Item grow={1} style={{ minWidth: 140 }}>
                    <TextField
                        label="Department"
                        value={form.department}
                        onChange={(_, v) => onChange({ department: v ?? '' })}
                        placeholder="e.g. Grocery, Produce"
                    />
                </Stack.Item>
                <Stack.Item grow={1} style={{ minWidth: 120 }}>
                    <TextField
                        label="Employee code"
                        value={form.employeeCode}
                        onChange={(_, v) => onChange({ employeeCode: v ?? '' })}
                        placeholder="Optional"
                    />
                </Stack.Item>
            </Stack>

            <TextField
                label="Notes"
                multiline
                rows={3}
                value={form.notes}
                onChange={(_, v) => onChange({ notes: v ?? '' })}
                resizable={false}
            />

            <Stack>
                <Label>Status</Label>
                <Toggle
                    checked={form.isActive}
                    onChange={(_, checked) => onChange({ isActive: checked ?? false })}
                    onText="Active"
                    offText="Inactive"
                />
            </Stack>
        </Stack>
    );
};

// ── EmployeesPage ──────────────────────────────────────────────────────────────

const EmployeesPage: FC = (): ReactElement => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);

    // Search / filter
    const [search, setSearch] = useState('');
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Panel state
    const [panelOpen, setPanelOpen] = useState(false);
    const [editing, setEditing] = useState<Employee | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm());
    const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({});
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Delete dialog
    const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // ── Load employees ─────────────────────────────────────────────────────────

    const load = useCallback(async (searchTerm?: string) => {
        setLoading(true);
        setListError(null);
        try {
            const data = await getEmployees(searchTerm ? { search: searchTerm } : undefined);
            setEmployees(data);
        } catch {
            setListError('Failed to load employees. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    // ── Search with debounce ───────────────────────────────────────────────────

    const handleSearchChange = (_: unknown, value?: string) => {
        const term = value ?? '';
        setSearch(term);
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => load(term || undefined), 400);
    };

    // ── Panel helpers ──────────────────────────────────────────────────────────

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm());
        setFormErrors({});
        setSaveError(null);
        setPanelOpen(true);
    };

    const openEdit = (employee: Employee) => {
        setEditing(employee);
        setForm({
            firstName: employee.firstName,
            lastName: employee.lastName,
            role: employee.role,
            isActive: employee.isActive,
            department: employee.department ?? '',
            employeeCode: employee.employeeCode ?? '',
            notes: employee.notes ?? '',
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
        const clearedErrors = { ...formErrors };
        (Object.keys(updates) as (keyof FormState)[]).forEach(k => delete clearedErrors[k]);
        setFormErrors(clearedErrors);
    };

    // ── Validation ─────────────────────────────────────────────────────────────

    const validateForm = (): boolean => {
        const errs: Partial<Record<keyof FormState, string>> = {};
        if (!form.firstName.trim()) errs.firstName = 'First name is required.';
        if (!form.lastName.trim())  errs.lastName  = 'Last name is required.';
        if (!form.role.trim())      errs.role      = 'Role is required.';
        setFormErrors(errs);
        return Object.keys(errs).length === 0;
    };

    // ── Save ───────────────────────────────────────────────────────────────────

    const handleSave = async () => {
        if (!validateForm()) return;

        setSaving(true);
        setSaveError(null);

        const payload: EmployeeFormData = {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            role: form.role.trim(),
            isActive: form.isActive,
            ...(form.department.trim()   && { department:   form.department.trim() }),
            ...(form.employeeCode.trim() && { employeeCode: form.employeeCode.trim() }),
            ...(form.notes.trim()        && { notes:        form.notes.trim() }),
        };

        try {
            if (editing) {
                await updateEmployee(editing.id, payload);
            } else {
                await createEmployee(payload);
            }
            setPanelOpen(false);
            await load(search || undefined);
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
            await deleteEmployee(deleteTarget.id);
            setDeleteTarget(null);
            await load(search || undefined);
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
                        <Text variant="xxLarge" block style={{ fontWeight: 600 }}>Employees</Text>
                        <Text variant="medium" style={{ color: '#605e5c' }}>
                            Manage your shift roster
                        </Text>
                    </Stack.Item>
                    <Stack.Item>
                        <PrimaryButton
                            text="New Employee"
                            iconProps={{ iconName: 'AddFriend' }}
                            onClick={openCreate}
                        />
                    </Stack.Item>
                </Stack>
            </Stack.Item>

            {/* Search bar */}
            <Stack.Item tokens={stackItemPadding}>
                <TextField
                    placeholder="Search by name or code…"
                    value={search}
                    onChange={handleSearchChange}
                    iconProps={{ iconName: 'Search' }}
                    styles={{ root: { maxWidth: 360 } }}
                />
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

            {/* Main content */}
            <Stack.Item tokens={stackItemPadding}>
                {loading ? (
                    <Stack horizontalAlign="center" style={{ padding: 40 }}>
                        <Spinner size={SpinnerSize.large} label="Loading employees…" />
                    </Stack>
                ) : employees.length === 0 ? (
                    <Stack
                        horizontalAlign="center"
                        style={{
                            padding: 40,
                            border: '1px dashed #c8c6c4',
                            borderRadius: 4,
                        }}
                    >
                        <Text variant="large" style={{ color: '#605e5c', marginBottom: 8 }}>
                            {search ? 'No employees match your search.' : 'No employees yet.'}
                        </Text>
                        {!search && (
                            <DefaultButton
                                text="Add your first employee"
                                iconProps={{ iconName: 'AddFriend' }}
                                onClick={openCreate}
                            />
                        )}
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
                        {employees.map(emp => (
                            <EmployeeRow
                                key={emp.id}
                                employee={emp}
                                onEdit={openEdit}
                                onDelete={setDeleteTarget}
                            />
                        ))}
                    </Stack>
                )}
            </Stack.Item>

            {/* Employee count */}
            {!loading && employees.length > 0 && (
                <Stack.Item tokens={stackItemPadding}>
                    <Text variant="small" style={{ color: '#a19f9d' }}>
                        {employees.length} employee{employees.length !== 1 ? 's' : ''}
                        {search ? ` matching "${search}"` : ''}
                    </Text>
                </Stack.Item>
            )}

            {/* Create / Edit panel */}
            <Panel
                isOpen={panelOpen}
                onDismiss={closePanel}
                type={PanelType.smallFixedFar}
                headerText={editing ? `Edit ${displayName(editing)}` : 'New Employee'}
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
                    <EmployeeForm form={form} onChange={updateForm} errors={formErrors} />
                </Stack>
            </Panel>

            {/* Delete confirmation dialog */}
            <Dialog
                hidden={!deleteTarget}
                onDismiss={() => !deleting && setDeleteTarget(null)}
                dialogContentProps={{
                    type: DialogType.normal,
                    title: 'Remove employee',
                    subText: deleteTarget
                        ? `Remove ${displayName(deleteTarget)}? This cannot be undone.`
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

export default EmployeesPage;
