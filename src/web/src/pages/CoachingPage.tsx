import { FC, ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import {
    Checkbox,
    DefaultButton,
    Dropdown,
    IDropdownOption,
    Label,
    MessageBar,
    MessageBarType,
    Panel,
    PanelType,
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
import { useCrudPanel } from '../hooks/useCrudPanel';
import { useEmployees } from '../hooks/useEmployees';
import { useToast } from '../hooks/useToast';
import { todayISO, ISO_DATE_RE } from '../utils/dateUtils';
import { extractApiError } from '../utils/errorUtils';
import ListState from '../components/ListState';
import PanelFooter from '../components/PanelFooter';
import DeleteDialog from '../components/DeleteDialog';
import ErrorBar from '../components/ErrorBar';
import ToastBar from '../components/ToastBar';

// ── Constants ──────────────────────────────────────────────────────────────────

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

const STATUS_COLORS: Record<string, string> = {
    open:         '#d83b01',
    acknowledged: '#0078d4',
    closed:       '#107c10',
};

// ── Types ──────────────────────────────────────────────────────────────────────

type FormState = {
    employeeId: string;
    storeDate: string;
    topic: string;
    issues: string[];
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
    employeeMap: Map<string, { firstName: string; lastName: string; department?: string }>;
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
                        {record.status}
                    </Text>
                )}
                {record.followUpDate && (
                    <Text variant="small" style={{ color: '#605e5c', display: 'block', marginTop: 4 }}>
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
                        styles={{ root: { minWidth: 0, padding: '0 10px', height: 44 } }}
                    />
                    <DefaultButton
                        text="Remove"
                        iconProps={{ iconName: 'Delete' }}
                        onClick={() => onDelete(record)}
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
    const firstDropdownRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const id = setTimeout(() => {
            const btn = firstDropdownRef.current?.querySelector('button') as HTMLElement | null;
            btn?.focus();
        }, 50);
        return () => clearTimeout(id);
    }, []);

    const toggleIssue = (label: string, checked: boolean) => {
        const next = checked
            ? [...form.issues, label]
            : form.issues.filter(i => i !== label);
        onChange({ issues: next });
    };

    return (
        <Stack tokens={stackGaps} style={{ padding: '0 16px' }}>
            <div ref={firstDropdownRef}>
                <Dropdown
                    label="Employee"
                    required
                    selectedKey={form.employeeId || null}
                    options={employeeOptions}
                    onChange={(_, opt) => onChange({ employeeId: (opt?.key as string) ?? '' })}
                    errorMessage={errors.employeeId}
                    placeholder="Select employee…"
                />
            </div>

            <TextField
                label="Session date"
                required
                type="date"
                value={form.storeDate}
                onChange={(_, v) => onChange({ storeDate: v ?? '' })}
                errorMessage={errors.storeDate}
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
                type="date"
                value={form.followUpDate}
                onChange={(_, v) => onChange({ followUpDate: v ?? '' })}
                errorMessage={errors.followUpDate}
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

    const [filterDate, setFilterDate] = useState(todayISO());
    const [filterEmployeeId, setFilterEmployeeId] = useState('');

    const { employeeMap, employeeOptions } = useEmployees();
    const { toastMessage, showToast } = useToast();
    const employeeFilterOptions: IDropdownOption[] = [
        { key: '', text: 'All employees' },
        ...employeeOptions,
    ];

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
    } = useCrudPanel<CoachingRecord, FormState>(emptyForm());

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
        } catch (err) {
            setListError(extractApiError(err, 'Failed to load coaching records. Please try again.'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load(filterDate, filterEmployeeId);
    }, [load, filterDate, filterEmployeeId]);

    // ── Panel helpers ──────────────────────────────────────────────────────────

    const handleOpenEdit = (record: CoachingRecord) => {
        openEdit(record, {
            employeeId:      record.employeeId,
            storeDate:       record.storeDate,
            topic:           record.topic,
            issues:          record.issues ?? [],
            goals:           record.goals ?? '',
            followUpDate:    record.followUpDate ?? '',
            acknowledgement: record.acknowledgement ?? '',
            status:          record.status ?? 'open',
        });
    };

    // ── Validation ─────────────────────────────────────────────────────────────

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
                showToast('Coaching record updated');
            } else {
                await createCoachingRecord(payload);
                showToast('Coaching record saved');
            }
            setPanelOpen(false);
            await load(filterDate, filterEmployeeId);
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
            await deleteCoachingRecord(deleteTarget.id);
            setDeleteTarget(null);
            showToast('Coaching record removed');
            await load(filterDate, filterEmployeeId);
        } catch (err) {
            setDeleteError(extractApiError(err, 'Delete failed. Please try again.'));
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
        <Stack tokens={stackPadding} className="page-container" style={{ maxWidth: 960, margin: '0 auto', width: '100%' }}>
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
                        <DefaultButton
                            text="New Record"
                            iconProps={{ iconName: 'Add' }}
                            onClick={() => openCreate(emptyForm(filterDate))}
                            primary
                        />
                    </Stack.Item>
                </Stack>
            </Stack.Item>

            {/* Filters */}
            <Stack.Item tokens={stackItemPadding}>
                <Stack horizontal wrap tokens={{ childrenGap: 12 }} verticalAlign="end" className="filter-row">
                    <TextField
                        label="Date"
                        type="date"
                        value={filterDate}
                        onChange={(_, v) => setFilterDate(v ?? '')}
                        styles={{ root: { width: 160 } }}
                    />
                    <Dropdown
                        label="Employee"
                        selectedKey={filterEmployeeId || ''}
                        options={employeeFilterOptions}
                        onChange={(_, opt) => setFilterEmployeeId((opt?.key as string) ?? '')}
                        styles={{ root: { minWidth: 220 } }}
                    />
                    <DefaultButton
                        text="Clear"
                        iconProps={{ iconName: 'ClearFilter' }}
                        onClick={() => { setFilterDate(todayISO()); setFilterEmployeeId(''); }}
                    />
                </Stack>
            </Stack.Item>

            {/* List error */}
            {listError && (
                <Stack.Item tokens={stackItemPadding}>
                    <ErrorBar message={listError} onDismiss={() => setListError(null)} />
                </Stack.Item>
            )}

            {/* Records list */}
            <Stack.Item tokens={stackItemPadding}>
                <ListState
                    loading={loading}
                    loadingLabel="Loading coaching records…"
                    empty={records.length === 0}
                    emptyContent={
                        <>
                            <Text variant="large" style={{ color: '#605e5c', marginBottom: 8 }}>
                                No coaching records found.
                            </Text>
                            <DefaultButton
                                text="Add first record"
                                iconProps={{ iconName: 'Add' }}
                                onClick={() => openCreate(emptyForm(filterDate))}
                            />
                        </>
                    }
                >
                    {records.map(rec => (
                        <CoachingRow
                            key={rec.id}
                            record={rec}
                            employeeMap={employeeMap}
                            onEdit={handleOpenEdit}
                            onDelete={setDeleteTarget}
                        />
                    ))}
                </ListState>
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
                    <PanelFooter saving={saving} onSave={handleSave} onCancel={closePanel} formId="coaching-form" />
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
                        id="coaching-form"
                        onSubmit={e => { e.preventDefault(); handleSave(); }}
                        style={{ display: 'contents' }}
                    >
                        <CoachingForm
                            form={form}
                            onChange={updateForm}
                            errors={formErrors}
                            employeeOptions={employeeOptions}
                        />
                    </form>
                </Stack>
            </Panel>

            {/* Delete confirmation dialog */}
            <DeleteDialog
                hidden={!deleteTarget}
                title="Remove coaching record"
                subText={deleteTarget
                    ? `Remove the coaching record for ${deleteLabel} on ${deleteTarget.storeDate}? This cannot be undone.`
                    : ''}
                deleting={deleting}
                deleteError={deleteError}
                onConfirm={handleDeleteConfirm}
                onDismiss={() => { if (!deleting) setDeleteTarget(null); }}
            />

            <ToastBar message={toastMessage} />
        </Stack>
    );
};

export default CoachingPage;
