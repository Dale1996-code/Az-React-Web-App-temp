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
import { DailySummary, SummaryFormData } from '../models/summary';
import { getSummaries, createSummary, updateSummary, deleteSummary } from '../services/summaryService';
import { Employee } from '../models/employee';
import { getEmployees } from '../services/employeesService';

// ── Constants ──────────────────────────────────────────────────────────────────

const SHIFT_OPTIONS: IDropdownOption[] = [
    { key: 'morning',   text: 'Morning' },
    { key: 'afternoon', text: 'Afternoon' },
    { key: 'closing',   text: 'Closing' },
    { key: 'overnight', text: 'Overnight' },
];

const SHIFT_FILTER_OPTIONS: IDropdownOption[] = [
    { key: '',          text: 'All shifts' },
    { key: 'morning',   text: 'Morning' },
    { key: 'afternoon', text: 'Afternoon' },
    { key: 'closing',   text: 'Closing' },
    { key: 'overnight', text: 'Overnight' },
];

// Colours for shift labels.
const SHIFT_COLORS: Record<string, string> = {
    morning:   '#0078d4', // blue
    afternoon: '#8764b8', // purple
    closing:   '#d83b01', // orange
    overnight: '#004578', // dark blue
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function todayISO(): string {
    return new Date().toISOString().split('T')[0];
}

function capitalise(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// Truncate long text for the list preview.
function preview(text?: string, max = 80): string {
    if (!text) return '—';
    return text.length <= max ? text : text.slice(0, max) + '…';
}

// ── Types ──────────────────────────────────────────────────────────────────────

type FormState = {
    storeDate: string;
    shiftLabel: string;
    completedWork: string;
    missedWork: string;
    followUpItems: string;
    generalNotes: string;
    authorEmployeeId: string;
};

const emptyForm = (date?: string): FormState => ({
    storeDate:        date ?? todayISO(),
    shiftLabel:       '',
    completedWork:    '',
    missedWork:       '',
    followUpItems:    '',
    generalNotes:     '',
    authorEmployeeId: '',
});

// ── SummaryRow ─────────────────────────────────────────────────────────────────

type SummaryRowProps = {
    summary: DailySummary;
    employeeMap: Map<string, Employee>;
    onEdit: (s: DailySummary) => void;
    onDelete: (s: DailySummary) => void;
};

const SummaryRow: FC<SummaryRowProps> = ({ summary, employeeMap, onEdit, onDelete }): ReactElement => {
    const author = summary.authorEmployeeId
        ? employeeMap.get(summary.authorEmployeeId)
        : undefined;
    const authorName = author
        ? `${author.firstName} ${author.lastName}`
        : summary.authorEmployeeId || '';

    const shiftColor = SHIFT_COLORS[summary.shiftLabel.toLowerCase()] ?? '#605e5c';

    return (
        <Stack
            horizontal
            wrap
            tokens={{ childrenGap: 8 }}
            styles={{
                root: {
                    padding: '12px 16px',
                    borderBottom: '1px solid #edebe9',
                    alignItems: 'flex-start',
                },
            }}
        >
            {/* Date + shift */}
            <Stack.Item style={{ minWidth: 160 }}>
                <Text variant="medium" style={{ fontWeight: 600, display: 'block' }}>
                    {summary.storeDate}
                </Text>
                <Text
                    variant="small"
                    style={{ color: shiftColor, fontWeight: 600, textTransform: 'capitalize' }}
                >
                    {capitalise(summary.shiftLabel)}
                </Text>
                {authorName && (
                    <Text variant="small" style={{ color: '#a19f9d', display: 'block', marginTop: 2 }}>
                        {authorName}
                    </Text>
                )}
            </Stack.Item>

            {/* Summary content preview */}
            <Stack.Item grow={2} style={{ minWidth: 240 }}>
                {summary.completedWork && (
                    <Stack.Item style={{ marginBottom: 4 }}>
                        <Text variant="small" style={{ fontWeight: 600, color: '#107c10' }}>
                            Completed:{' '}
                        </Text>
                        <Text variant="small" style={{ color: '#323130' }}>
                            {preview(summary.completedWork)}
                        </Text>
                    </Stack.Item>
                )}
                {summary.missedWork && (
                    <Stack.Item style={{ marginBottom: 4 }}>
                        <Text variant="small" style={{ fontWeight: 600, color: '#d83b01' }}>
                            Missed:{' '}
                        </Text>
                        <Text variant="small" style={{ color: '#323130' }}>
                            {preview(summary.missedWork)}
                        </Text>
                    </Stack.Item>
                )}
                {summary.followUpItems && (
                    <Stack.Item style={{ marginBottom: 4 }}>
                        <Text variant="small" style={{ fontWeight: 600, color: '#0078d4' }}>
                            Follow-up:{' '}
                        </Text>
                        <Text variant="small" style={{ color: '#323130' }}>
                            {preview(summary.followUpItems)}
                        </Text>
                    </Stack.Item>
                )}
                {!summary.completedWork && !summary.missedWork && !summary.followUpItems && (
                    <Text variant="small" style={{ color: '#a19f9d' }}>
                        {preview(summary.generalNotes) || 'No details recorded.'}
                    </Text>
                )}
            </Stack.Item>

            {/* Actions */}
            <Stack.Item>
                <Stack horizontal tokens={{ childrenGap: 8 }}>
                    <DefaultButton
                        text="Edit"
                        iconProps={{ iconName: 'Edit' }}
                        onClick={() => onEdit(summary)}
                        styles={{ root: { minWidth: 0, padding: '0 10px', height: 28 } }}
                    />
                    <DefaultButton
                        text="Remove"
                        iconProps={{ iconName: 'Delete' }}
                        onClick={() => onDelete(summary)}
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

// ── SummaryForm ────────────────────────────────────────────────────────────────

type SummaryFormProps = {
    form: FormState;
    onChange: (updates: Partial<FormState>) => void;
    errors: Partial<Record<keyof FormState, string>>;
    employeeOptions: IDropdownOption[];
};

const SummaryForm: FC<SummaryFormProps> = ({ form, onChange, errors, employeeOptions }): ReactElement => (
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
            label="Shift"
            required
            selectedKey={form.shiftLabel || null}
            options={SHIFT_OPTIONS}
            onChange={(_, opt) => onChange({ shiftLabel: (opt?.key as string) ?? '' })}
            errorMessage={errors.shiftLabel}
            placeholder="Select shift…"
        />

        <Dropdown
            label="Written by"
            selectedKey={form.authorEmployeeId || null}
            options={[{ key: '', text: 'None / unknown' }, ...employeeOptions]}
            onChange={(_, opt) => onChange({ authorEmployeeId: (opt?.key as string) ?? '' })}
            placeholder="Select employee (optional)…"
        />

        <TextField
            label="Completed work"
            multiline
            rows={3}
            resizable={false}
            value={form.completedWork}
            onChange={(_, v) => onChange({ completedWork: v ?? '' })}
            placeholder="What was accomplished this shift…"
        />

        <TextField
            label="Missed work / carry-overs"
            multiline
            rows={3}
            resizable={false}
            value={form.missedWork}
            onChange={(_, v) => onChange({ missedWork: v ?? '' })}
            placeholder="Tasks not finished, items to carry forward…"
        />

        <TextField
            label="Follow-up items"
            multiline
            rows={3}
            resizable={false}
            value={form.followUpItems}
            onChange={(_, v) => onChange({ followUpItems: v ?? '' })}
            placeholder="Action items for next shift or management…"
        />

        <TextField
            label="General notes"
            multiline
            rows={4}
            resizable={false}
            value={form.generalNotes}
            onChange={(_, v) => onChange({ generalNotes: v ?? '' })}
            placeholder="Anything else worth noting — staffing, customer feedback, incidents…"
        />
    </Stack>
);

// ── SummaryPage ────────────────────────────────────────────────────────────────

const SummaryPage: FC = (): ReactElement => {
    const [summaries, setSummaries] = useState<DailySummary[]>([]);
    const [loading, setLoading]     = useState(true);
    const [listError, setListError] = useState<string | null>(null);

    // Filters
    const [filterDate, setFilterDate]   = useState(todayISO());
    const [filterShift, setFilterShift] = useState('');

    // Employee lookup for display + dropdown.
    const [employeeMap, setEmployeeMap]       = useState<Map<string, Employee>>(new Map());
    const [employeeOptions, setEmployeeOptions] = useState<IDropdownOption[]>([]);

    // Panel state
    const [panelOpen, setPanelOpen]   = useState(false);
    const [editing, setEditing]       = useState<DailySummary | null>(null);
    const [form, setForm]             = useState<FormState>(emptyForm());
    const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({});
    const [saving, setSaving]         = useState(false);
    const [saveError, setSaveError]   = useState<string | null>(null);

    // Delete dialog
    const [deleteTarget, setDeleteTarget] = useState<DailySummary | null>(null);
    const [deleting, setDeleting]         = useState(false);
    const [deleteError, setDeleteError]   = useState<string | null>(null);

    // ── Load employees once ────────────────────────────────────────────────────

    useEffect(() => {
        getEmployees({ active: true }).then(list => {
            const map = new Map<string, Employee>();
            const opts: IDropdownOption[] = [];
            list.forEach(emp => {
                map.set(emp.id, emp);
                opts.push({
                    key:  emp.id,
                    text: `${emp.firstName} ${emp.lastName}${emp.department ? ` (${emp.department})` : ''}`,
                });
            });
            setEmployeeMap(map);
            setEmployeeOptions(opts);
        }).catch(() => {
            // Non-fatal — author name will fall back to ID if this fails.
        });
    }, []);

    // ── Load summaries ─────────────────────────────────────────────────────────

    const load = useCallback(async (date: string, shiftLabel: string) => {
        setLoading(true);
        setListError(null);
        try {
            const query: { date?: string; shiftLabel?: string } = {};
            if (date)       query.date       = date;
            if (shiftLabel) query.shiftLabel = shiftLabel;
            const data = await getSummaries(query);
            // Sort newest first by storeDate then by id (creation order).
            setSummaries(data.sort((a, b) =>
                b.storeDate.localeCompare(a.storeDate) || b.id.localeCompare(a.id)
            ));
        } catch {
            setListError('Failed to load summaries. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load(filterDate, filterShift);
    }, [load, filterDate, filterShift]);

    // ── Panel helpers ──────────────────────────────────────────────────────────

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm(filterDate || todayISO()));
        setFormErrors({});
        setSaveError(null);
        setPanelOpen(true);
    };

    const openEdit = (summary: DailySummary) => {
        setEditing(summary);
        setForm({
            storeDate:        summary.storeDate,
            shiftLabel:       summary.shiftLabel,
            completedWork:    summary.completedWork    ?? '',
            missedWork:       summary.missedWork       ?? '',
            followUpItems:    summary.followUpItems    ?? '',
            generalNotes:     summary.generalNotes     ?? '',
            authorEmployeeId: summary.authorEmployeeId ?? '',
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
        if (!form.shiftLabel)
            errs.shiftLabel = 'Shift is required.';

        setFormErrors(errs);
        return Object.keys(errs).length === 0;
    };

    // ── Save ───────────────────────────────────────────────────────────────────

    const handleSave = async () => {
        if (!validateForm()) return;
        setSaving(true);
        setSaveError(null);

        const payload: SummaryFormData = {
            storeDate:  form.storeDate,
            shiftLabel: form.shiftLabel,
            ...(form.completedWork.trim()    && { completedWork:    form.completedWork.trim() }),
            ...(form.missedWork.trim()       && { missedWork:       form.missedWork.trim() }),
            ...(form.followUpItems.trim()    && { followUpItems:    form.followUpItems.trim() }),
            ...(form.generalNotes.trim()     && { generalNotes:     form.generalNotes.trim() }),
            ...(form.authorEmployeeId        && { authorEmployeeId: form.authorEmployeeId }),
        };

        try {
            if (editing) {
                await updateSummary(editing.id, payload);
            } else {
                await createSummary(payload);
            }
            setPanelOpen(false);
            await load(filterDate, filterShift);
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
            await deleteSummary(deleteTarget.id);
            setDeleteTarget(null);
            await load(filterDate, filterShift);
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
                <Stack
                    horizontal
                    horizontalAlign="space-between"
                    verticalAlign="center"
                    wrap
                    tokens={{ childrenGap: 12 }}
                >
                    <Stack.Item>
                        <Text variant="xxLarge" block style={{ fontWeight: 600 }}>Daily Summary</Text>
                        <Text variant="medium" style={{ color: '#605e5c' }}>
                            Shift closeout — completed work, missed tasks, and follow-up items
                        </Text>
                    </Stack.Item>
                    <Stack.Item>
                        <PrimaryButton
                            text="New Summary"
                            iconProps={{ iconName: 'Add' }}
                            onClick={openCreate}
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
                        label="Shift"
                        selectedKey={filterShift}
                        options={SHIFT_FILTER_OPTIONS}
                        onChange={(_, opt) => setFilterShift((opt?.key as string) ?? '')}
                        styles={{ root: { minWidth: 160 } }}
                    />
                    <DefaultButton
                        text="Clear"
                        iconProps={{ iconName: 'ClearFilter' }}
                        onClick={() => { setFilterDate(todayISO()); setFilterShift(''); }}
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

            {/* Summaries list */}
            <Stack.Item tokens={stackItemPadding}>
                {loading ? (
                    <Stack horizontalAlign="center" style={{ padding: 40 }}>
                        <Spinner size={SpinnerSize.large} label="Loading summaries…" />
                    </Stack>
                ) : summaries.length === 0 ? (
                    <Stack
                        horizontalAlign="center"
                        style={{
                            padding: 40,
                            border: '1px dashed #c8c6c4',
                            borderRadius: 4,
                        }}
                    >
                        <Text variant="large" style={{ color: '#605e5c', marginBottom: 8 }}>
                            No summaries found.
                        </Text>
                        <DefaultButton
                            text="Create first summary"
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
                        {summaries.map(s => (
                            <SummaryRow
                                key={s.id}
                                summary={s}
                                employeeMap={employeeMap}
                                onEdit={openEdit}
                                onDelete={setDeleteTarget}
                            />
                        ))}
                    </Stack>
                )}
            </Stack.Item>

            {/* Record count */}
            {!loading && summaries.length > 0 && (
                <Stack.Item tokens={stackItemPadding}>
                    <Text variant="small" style={{ color: '#a19f9d' }}>
                        {summaries.length} summary record{summaries.length !== 1 ? 's' : ''}
                    </Text>
                </Stack.Item>
            )}

            {/* Create / Edit panel */}
            <Panel
                isOpen={panelOpen}
                onDismiss={closePanel}
                type={PanelType.smallFixedFar}
                headerText={editing ? 'Edit Summary' : 'New Shift Summary'}
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
                    <SummaryForm
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
                    type:    DialogType.normal,
                    title:   'Remove summary',
                    subText: deleteTarget
                        ? `Remove the ${capitalise(deleteTarget.shiftLabel)} summary for ${deleteTarget.storeDate}? This cannot be undone.`
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

export default SummaryPage;
