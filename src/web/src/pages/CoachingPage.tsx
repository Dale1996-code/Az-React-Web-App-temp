import { FC, ReactElement, useCallback, useEffect, useState } from 'react';
import {
    Checkbox,
    DefaultButton,
    Dialog,
    DialogFooter,
    DialogType,
    Dropdown,
    IDropdownOption,
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
} from '@fluentui/react';
import { stackGaps, stackItemPadding, stackPadding } from '../ux/styles';
import { CoachingRecord, CoachingFormData } from '../models/coaching';
import {
    getCoachingRecords,
    createCoachingRecord,
    updateCoachingRecord,
    deleteCoachingRecord,
} from '../services/coachingService';
import { Employee } from '../models/employee';
import { getEmployees } from '../services/employeesService';

// ── Constants ──────────────────────────────────────────────────────────────────

// Common retail coaching issue labels shown as checkboxes in the form.
const ISSUE_OPTIONS = [
    'Attendance',
    'Punctuality',
    'Dress code',
    'Productivity',
    'Safety',
    'Teamwork',
    'Customer service',
    'Policy violation',
    'Other',
];

const STATUS_OPTIONS: IDropdownOption[] = [
    { key: 'open',         text: 'Open' },
    { key: 'acknowledged', text: 'Acknowledged' },
    { key: 'closed',       text: 'Closed' },
];

// Status display colours — neutral palette matching the rest of the app.
const STATUS_COLORS: Record<string, string> = {
    open:         '#d83b01', // orange-red
    acknowledged: '#0078d4', // blue
    closed:       '#107c10', // green
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function todayISO(): string {
    return new Date().toISOString().split('T')[0];
}

// ── Types ──────────────────────────────────────────────────────────────────────

type FormState = {
    employeeId: string;
    storeDate: string;
    topic: string;
    issues: string[];       // selected issue labels
    goals: string;
    followUpDate: string;
    acknowledgement: string;
    status: string;
};

const emptyForm = (date?: string): FormState => ({
    employeeId: '',
    storeDate: date ?? todayISO(),
    topic: '',
    issues: [],
    goals: '',
    followUpDate: '',
    acknowledgement: '',
    status: 'open',
});

// ── CoachingRow ────────────────────────────────────────────────────────────────

type CoachingRowProps = {
    record: CoachingRecord;
    employeeMap: Map<string, Employee>;
    onEdit: (record: CoachingRecord) => void;
    onDelete: (record: CoachingRecord) => void;
};

const CoachingRow: FC<CoachingRowProps> = ({
    record,
    employeeMap,
    onEdit,
    onDelete,
}): ReactElement => {
    const employee = employeeMap.get(record.employeeId);
    const employeeName = employee
        ? `${employee.firstName} ${employee.lastName}`
        : record.employeeId;

    const statusColor = record.status ? (STATUS_COLORS[record.status] ?? '#605e5c') : '#605e5c';

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
            {/* Employee + date */}
            <Stack.Item grow={1} style={{ minWidth: 180 }}>
                <Text variant="medium" style={{ fontWeight: 600, display: 'block' }}>
                    {employeeName}
                </Text>
                <Text variant="small" style={{ color: '#605e5c' }}>
                    {record.storeDate}
                    {employee?.department ? ` · ${employee.department}` : ''}
                </Text>
            </Stack.Item>

            {/* Topic + issues summary */}
            <Stack.Item grow={2} style={{ minWidth: 200 }}>
                <Text variant="medium" style={{ fontWeight: 600, display: 'block' }}>
                    {record.topic}
                </Text>
                {record.issues && record.issues.length > 0 && (
                    <Text variant="small" style={{ color: '#605e5c' }}>
                        {record.issues.join(' · ')}
                    </Text>
                )}
            </Stack.Item>

            {/* Status + follow-up */}
            <Stack.Item style={{ minWidth: 140 }}>
                {record.status && (
                    <Text
                        variant="small"
                        style={{
                            display: 'block',
                            color: statusColor,
                            fontWeight: 600,
                            textTransform: 'capitalize',
                        }}
                    >
                        {record.status}
                    </Text>
                )}
                {record.followUpDate && (
                    <Text variant="small" style={{ color: '#605e5c' }}>
                        Follow-up: {record.followUpDate}
                    </Text>
                )}
            </Stack.Item>

            {/* Actions */}
            <Stack.Item>
                <Stack horizontal tokens={{ childrenGap: 8 }}>
                    <DefaultButton
                        text="Edit"
                        iconProps={{ iconName: 'Edit' }}
                        onClick={() => onEdit(record)}
                        styles={{ root: { minWidth: 0, padding: '0 10px', height: 28 } }}
                    />
                    <DefaultButton
                        text="Remove"
                        iconProps={{ iconName: 'Delete' }}
                        onClick={() => onDelete(record)}
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

// ── CoachingForm ───────────────────────────────────────────────────────────────

type CoachingFormProps = {
    form: FormState;
    onChange: (updates: Partial<FormState>) => void;
    errors: Partial<Record<keyof FormState, string>>;
    employeeOptions: IDropdownOption[];
};

const CoachingForm: FC<CoachingFormProps> = ({
    form,
    onChange,
    errors,
    employeeOptions,
}): ReactElement => {
    // Toggle a single issue label on/off in the issues array.
    const toggleIssue = (label: string, checked: boolean) => {
        const next = checked
            ? [...form.issues, label]
            : form.issues.filter(i => i !== label);
        onChange({ issues: next });
    };

    return (
        <Stack tokens={stackGaps} style={{ padding: '0 16px' }}>
            <Dropdown
                label="Employee"
                required
                selectedKey={form.employeeId || null}
                options={employeeOptions}
                onChange={(_, opt) => onChange({ employeeId: (opt?.key as string) ?? '' })}
                errorMessage={errors.employeeId}
                placeholder="Select employee…"
            />

            <TextField
                label="Session date"
                required
                value={form.storeDate}
                onChange={(_, v) => onChange({ storeDate: v ?? '' })}
                errorMessage={errors.storeDate}
                placeholder="YYYY-MM-DD"
            />

            <TextField
                label="Topic / reason for coaching"
                required
                value={form.topic}
                onChange={(_, v) => onChange({ topic: v ?? '' })}
                errorMessage={errors.topic}
                placeholder="e.g. Attendance discussion, safety walkthrough…"
            />

            {/* Issue checkboxes */}
            <Stack tokens={{ childrenGap: 6 }}>
                <Label>Issues discussed</Label>
                <Stack horizontal wrap tokens={{ childrenGap: 12 }}>
                    {ISSUE_OPTIONS.map(label => (
                        <Checkbox
                            key={label}
                            label={label}
                            checked={form.issues.includes(label)}
                            onChange={(_, checked) => toggleIssue(label, !!checked)}
                        />
                    ))}
                </Stack>
            </Stack>

            <TextField
                label="Goals / action plan"
                multiline
                rows={3}
                resizable={false}
                value={form.goals}
                onChange={(_, v) => onChange({ goals: v ?? '' })}
                placeholder="Steps the employee will take, targets agreed upon…"
            />

            <TextField
                label="Follow-up date"
                value={form.followUpDate}
                onChange={(_, v) => onChange({ followUpDate: v ?? '' })}
                errorMessage={errors.followUpDate}
                placeholder="YYYY-MM-DD (optional)"
            />

            <TextField
                label="Acknowledgement / signature note"
                multiline
                rows={3}
                resizable={false}
                value={form.acknowledgement}
                onChange={(_, v) => onChange({ acknowledgement: v ?? '' })}
                placeholder="Employee acknowledgement statement, verbal confirmation note…"
            />

            <Dropdown
                label="Status"
                selectedKey={form.status || null}
                options={STATUS_OPTIONS}
                onChange={(_, opt) => onChange({ status: (opt?.key as string) ?? '' })}
                placeholder="Select status…"
            />
        </Stack>
    );
};

// ── CoachingPage ───────────────────────────────────────────────────────────────

const CoachingPage: FC = (): ReactElement => {
    const [records, setRecords] = useState<CoachingRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);

    // Filters — date defaults to today; employee filter is optional.
    const [filterDate, setFilterDate] = useState(todayISO());
    const [filterEmployeeId, setFilterEmployeeId] = useState('');

    // Employee lookup for display + dropdown.
    const [employeeMap, setEmployeeMap] = useState<Map<string, Employee>>(new Map());
    const [employeeOptions, setEmployeeOptions] = useState<IDropdownOption[]>([]);
    const [employeeFilterOptions, setEmployeeFilterOptions] = useState<IDropdownOption[]>([]);

    // Panel state
    const [panelOpen, setPanelOpen] = useState(false);
    const [editing, setEditing] = useState<CoachingRecord | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm());
    const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({});
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Delete dialog
    const [deleteTarget, setDeleteTarget] = useState<CoachingRecord | null>(null);
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
            // Filter dropdown includes an "All employees" option.
            setEmployeeFilterOptions([{ key: '', text: 'All employees' }, ...opts]);
        }).catch(() => {
            // Non-fatal — employees will fall back to ID strings if this fails.
        });
    }, []);

    // ── Load coaching records ──────────────────────────────────────────────────

    const load = useCallback(async (date: string, employeeId: string) => {
        setLoading(true);
        setListError(null);
        try {
            const query: { date?: string; employeeId?: string } = {};
            if (date)       query.date       = date;
            if (employeeId) query.employeeId = employeeId;
            const data = await getCoachingRecords(query);
            setRecords(data);
        } catch {
            setListError('Failed to load coaching records. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load(filterDate, filterEmployeeId);
    }, [load, filterDate, filterEmployeeId]);

    // ── Panel helpers ──────────────────────────────────────────────────────────

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm(filterDate));
        setFormErrors({});
        setSaveError(null);
        setPanelOpen(true);
    };

    const openEdit = (record: CoachingRecord) => {
        setEditing(record);
        setForm({
            employeeId:    record.employeeId,
            storeDate:     record.storeDate,
            topic:         record.topic,
            issues:        record.issues ?? [],
            goals:         record.goals ?? '',
            followUpDate:  record.followUpDate ?? '',
            acknowledgement: record.acknowledgement ?? '',
            status:        record.status ?? 'open',
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

        if (!form.employeeId)
            errs.employeeId = 'Employee is required.';
        if (!ISO_DATE_RE.test(form.storeDate))
            errs.storeDate = 'Date must be YYYY-MM-DD.';
        if (!form.topic.trim())
            errs.topic = 'Topic is required.';
        if (form.followUpDate && !ISO_DATE_RE.test(form.followUpDate))
            errs.followUpDate = 'Follow-up date must be YYYY-MM-DD.';

        setFormErrors(errs);
        return Object.keys(errs).length === 0;
    };

    // ── Save ───────────────────────────────────────────────────────────────────

    const handleSave = async () => {
        if (!validateForm()) return;
        setSaving(true);
        setSaveError(null);

        const payload: CoachingFormData = {
            employeeId: form.employeeId,
            storeDate:  form.storeDate,
            topic:      form.topic.trim(),
            ...(form.issues.length > 0        && { issues:          form.issues }),
            ...(form.goals.trim()             && { goals:           form.goals.trim() }),
            ...(form.followUpDate             && { followUpDate:    form.followUpDate }),
            ...(form.acknowledgement.trim()   && { acknowledgement: form.acknowledgement.trim() }),
            ...(form.status                   && { status:          form.status }),
        };

        try {
            if (editing) {
                await updateCoachingRecord(editing.id, payload);
            } else {
                await createCoachingRecord(payload);
            }
            setPanelOpen(false);
            await load(filterDate, filterEmployeeId);
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
            await deleteCoachingRecord(deleteTarget.id);
            setDeleteTarget(null);
            await load(filterDate, filterEmployeeId);
        } catch {
            setDeleteError('Delete failed. Please try again.');
        } finally {
            setDeleting(false);
        }
    };

    const deleteLabel = deleteTarget
        ? (() => {
              const emp = employeeMap.get(deleteTarget.employeeId);
              return emp ? `${emp.firstName} ${emp.lastName}` : deleteTarget.employeeId;
          })()
        : '';

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
                        <Text variant="xxLarge" block style={{ fontWeight: 600 }}>Coaching</Text>
                        <Text variant="medium" style={{ color: '#605e5c' }}>
                            Employee coaching and accountability records
                        </Text>
                    </Stack.Item>
                    <Stack.Item>
                        <PrimaryButton
                            text="New Record"
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
                        label="Session date"
                        value={filterDate}
                        onChange={(_, v) => setFilterDate(v ?? '')}
                        placeholder="YYYY-MM-DD"
                        styles={{ root: { width: 160 } }}
                        description="Leave blank to show all dates"
                    />
                    <Dropdown
                        label="Employee"
                        selectedKey={filterEmployeeId || ''}
                        options={employeeFilterOptions}
                        onChange={(_, opt) => setFilterEmployeeId((opt?.key as string) ?? '')}
                        styles={{ root: { minWidth: 220 } }}
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

            {/* Records list */}
            <Stack.Item tokens={stackItemPadding}>
                {loading ? (
                    <Stack horizontalAlign="center" style={{ padding: 40 }}>
                        <Spinner size={SpinnerSize.large} label="Loading coaching records…" />
                    </Stack>
                ) : records.length === 0 ? (
                    <Stack
                        horizontalAlign="center"
                        style={{
                            padding: 40,
                            border: '1px dashed #c8c6c4',
                            borderRadius: 4,
                        }}
                    >
                        <Text variant="large" style={{ color: '#605e5c', marginBottom: 8 }}>
                            No coaching records found.
                        </Text>
                        <DefaultButton
                            text="Add first record"
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
                        {records.map(rec => (
                            <CoachingRow
                                key={rec.id}
                                record={rec}
                                employeeMap={employeeMap}
                                onEdit={openEdit}
                                onDelete={setDeleteTarget}
                            />
                        ))}
                    </Stack>
                )}
            </Stack.Item>

            {/* Record count */}
            {!loading && records.length > 0 && (
                <Stack.Item tokens={stackItemPadding}>
                    <Text variant="small" style={{ color: '#a19f9d' }}>
                        {records.length} record{records.length !== 1 ? 's' : ''}
                    </Text>
                </Stack.Item>
            )}

            {/* Create / Edit panel */}
            <Panel
                isOpen={panelOpen}
                onDismiss={closePanel}
                type={PanelType.smallFixedFar}
                headerText={editing ? 'Edit Coaching Record' : 'New Coaching Record'}
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
                    <CoachingForm
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
                    title: 'Remove coaching record',
                    subText: deleteTarget
                        ? `Remove the coaching record for ${deleteLabel} on ${deleteTarget.storeDate}? This cannot be undone.`
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

export default CoachingPage;
