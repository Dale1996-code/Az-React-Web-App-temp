import { FC, ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import {
    DefaultButton,
    Label,
    MessageBar,
    MessageBarType,
    Panel,
    PanelType,
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
import { useCrudPanel } from '../hooks/useCrudPanel';
import { useToast } from '../hooks/useToast';
import { extractApiError } from '../utils/errorUtils';
import ListState from '../components/ListState';
import PanelFooter from '../components/PanelFooter';
import DeleteDialog from '../components/DeleteDialog';
import ErrorBar from '../components/ErrorBar';
import ToastBar from '../components/ToastBar';

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
                    {employee.employeeCode ? ` · ID: ${employee.employeeCode}` : ''}
                </Text>
            </Stack.Item>

            {/* Actions */}
            <Stack.Item>
                <Stack horizontal tokens={{ childrenGap: 8 }}>
                    <DefaultButton
                        text="Edit"
                        iconProps={{ iconName: 'Edit' }}
                        onClick={() => onEdit(employee)}
                        styles={{ root: { minWidth: 0, padding: '0 10px', height: 44 } }}
                    />
                    <DefaultButton
                        text="Remove"
                        iconProps={{ iconName: 'Delete' }}
                        onClick={() => onDelete(employee)}
                        styles={{
                            root: { minWidth: 0, padding: '0 10px', height: 44 },
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
    const firstInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        const id = setTimeout(() => firstInputRef.current?.focus(), 50);
        return () => clearTimeout(id);
    }, []);

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
                        componentRef={r => { firstInputRef.current = (r as unknown as { _textElement?: { value: HTMLInputElement } })?._textElement?.value ?? null; }}
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
                        label="Employee ID"
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

    const [search, setSearch] = useState('');
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { toastMessage, showToast } = useToast();

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
    } = useCrudPanel<Employee, FormState>(emptyForm());

    // ── Load employees ─────────────────────────────────────────────────────────

    const load = useCallback(async (searchTerm?: string) => {
        setLoading(true);
        setListError(null);
        try {
            const data = await getEmployees(searchTerm ? { search: searchTerm } : undefined);
            setEmployees(data);
        } catch (err) {
            setListError(extractApiError(err, 'Failed to load employees. Please try again.'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    // Clear any pending search debounce when the page unmounts so it does not
    // fire load() (and setState) after unmount.
    useEffect(() => () => {
        if (searchTimer.current) clearTimeout(searchTimer.current);
    }, []);

    // ── Search with debounce ───────────────────────────────────────────────────

    const handleSearchChange = (_: unknown, value?: string) => {
        const term = value ?? '';
        setSearch(term);
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => load(term || undefined), 400);
    };

    // ── Panel helpers ──────────────────────────────────────────────────────────

    const handleOpenEdit = (employee: Employee) => {
        openEdit(employee, {
            firstName: employee.firstName,
            lastName: employee.lastName,
            role: employee.role,
            isActive: employee.isActive,
            department: employee.department ?? '',
            employeeCode: employee.employeeCode ?? '',
            notes: employee.notes ?? '',
        });
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
                showToast('Employee updated');
            } else {
                await createEmployee(payload);
                showToast('Employee saved');
            }
            setPanelOpen(false);
            await load(search || undefined);
        } catch (err) {
            setSaveError(extractApiError(err, 'Save failed. Check your inputs and try again.'));
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
            showToast('Employee removed');
            await load(search || undefined);
        } catch (err) {
            setDeleteError(extractApiError(err, 'Delete failed. Please try again.'));
        } finally {
            setDeleting(false);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <Stack tokens={stackPadding} className="page-container" style={{ maxWidth: 960, margin: '0 auto', width: '100%' }}>
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
                        <DefaultButton
                            text="New Employee"
                            iconProps={{ iconName: 'AddFriend' }}
                            onClick={() => openCreate(emptyForm())}
                            primary
                        />
                    </Stack.Item>
                </Stack>
            </Stack.Item>

            {/* Search bar */}
            <Stack.Item tokens={stackItemPadding}>
                <TextField
                    placeholder="Search by name or ID…"
                    value={search}
                    onChange={handleSearchChange}
                    iconProps={{ iconName: 'Search' }}
                    styles={{ root: { maxWidth: 360 } }}
                />
            </Stack.Item>

            {/* List error */}
            {listError && (
                <Stack.Item tokens={stackItemPadding}>
                    <ErrorBar message={listError} onDismiss={() => setListError(null)} />
                </Stack.Item>
            )}

            {/* Main content */}
            <Stack.Item tokens={stackItemPadding}>
                <ListState
                    loading={loading}
                    loadingLabel="Loading employees…"
                    empty={employees.length === 0}
                    emptyContent={
                        <>
                            <Text variant="large" style={{ color: '#605e5c', marginBottom: 8 }}>
                                {search ? 'No employees match your search.' : 'No employees yet.'}
                            </Text>
                            {!search && (
                                <DefaultButton
                                    text="Add your first employee"
                                    iconProps={{ iconName: 'AddFriend' }}
                                    onClick={() => openCreate(emptyForm())}
                                />
                            )}
                        </>
                    }
                >
                    {employees.map(emp => (
                        <EmployeeRow
                            key={emp.id}
                            employee={emp}
                            onEdit={handleOpenEdit}
                            onDelete={setDeleteTarget}
                        />
                    ))}
                </ListState>
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
                    <PanelFooter saving={saving} onSave={handleSave} onCancel={closePanel} formId="employee-form" />
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
                    <form
                        id="employee-form"
                        onSubmit={e => { e.preventDefault(); handleSave(); }}
                        style={{ display: 'contents' }}
                    >
                        <EmployeeForm form={form} onChange={updateForm} errors={formErrors} />
                    </form>
                </Stack>
            </Panel>

            {/* Delete confirmation dialog */}
            <DeleteDialog
                hidden={!deleteTarget}
                title="Remove employee"
                subText={deleteTarget ? `Remove ${displayName(deleteTarget)}? This cannot be undone.` : ''}
                deleting={deleting}
                deleteError={deleteError}
                onConfirm={handleDeleteConfirm}
                onDismiss={() => { if (!deleting) setDeleteTarget(null); }}
            />

            <ToastBar message={toastMessage} />
        </Stack>
    );
};

export default EmployeesPage;
