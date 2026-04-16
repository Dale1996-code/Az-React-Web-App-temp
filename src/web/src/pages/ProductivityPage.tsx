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
import { ProductivityRecord, ProductivityFormData } from '../models/productivity';
import {
    getProductivityRecords,
    createProductivityRecord,
    updateProductivityRecord,
    deleteProductivityRecord,
} from '../services/productivityService';
import { Employee } from '../models/employee';
import { getEmployees } from '../services/employeesService';

// ── Helpers ────────────────────────────────────────────────────────────────────

function todayISO(): string {
    return new Date().toISOString().split('T')[0];
}

// ── Types ──────────────────────────────────────────────────────────────────────

type FormState = {
    employeeId: string;
    storeDate: string;
    freightStockedUnits: string;   // kept as string for text input, parsed on save
    breakMinutes: string;          // kept as string for text input, parsed on save
    zonesCovered: string;
    overstockNotes: string;
    shiftNotes: string;
};

const emptyForm = (date?: string): FormState => ({
    employeeId: '',
    storeDate: date ?? todayISO(),
    freightStockedUnits: '',
    breakMinutes: '',
    zonesCovered: '',
    overstockNotes: '',
    shiftNotes: '',
});

// ── ProductivityRow ────────────────────────────────────────────────────────────

type ProductivityRowProps = {
    record: ProductivityRecord;
    employeeMap: Map<string, Employee>;
    onEdit: (record: ProductivityRecord) => void;
    onDelete: (record: ProductivityRecord) => void;
};

const ProductivityRow: FC<ProductivityRowProps> = ({
    record,
    employeeMap,
    onEdit,
    onDelete,
}): ReactElement => {
    const employee = employeeMap.get(record.employeeId);
    const employeeName = employee
        ? `${employee.firstName} ${employee.lastName}`
        : record.employeeId;

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
            <Stack.Item grow={1} style={{ minWidth: 200 }}>
                <Text variant="medium" style={{ fontWeight: 600, display: 'block' }}>
                    {employeeName}
                </Text>
                <Text variant="small" style={{ color: '#605e5c' }}>
                    {record.storeDate}
                    {employee?.department ? ` · ${employee.department}` : ''}
                </Text>
            </Stack.Item>

            {/* Key metrics */}
            <Stack.Item grow={2} style={{ minWidth: 240 }}>
                <Stack horizontal tokens={{ childrenGap: 20 }} wrap>
                    <Stack.Item>
                        <Text variant="small" style={{ color: '#605e5c', display: 'block' }}>Freight</Text>
                        <Text variant="medium" style={{ fontWeight: 600 }}>
                            {record.freightStockedUnits != null ? record.freightStockedUnits : '—'}
                        </Text>
                    </Stack.Item>
                    <Stack.Item>
                        <Text variant="small" style={{ color: '#605e5c', display: 'block' }}>Break (min)</Text>
                        <Text variant="medium" style={{ fontWeight: 600 }}>
                            {record.breakMinutes != null ? record.breakMinutes : '—'}
                        </Text>
                    </Stack.Item>
                    <Stack.Item style={{ minWidth: 100 }}>
                        <Text variant="small" style={{ color: '#605e5c', display: 'block' }}>Zones</Text>
                        <Text variant="medium" style={{ fontWeight: 600 }}>
                            {record.zonesCovered || '—'}
                        </Text>
                    </Stack.Item>
                </Stack>
                {record.shiftNotes && (
                    <Text
                        variant="small"
                        style={{
                            color: '#605e5c',
                            marginTop: 4,
                            display: 'block',
                            maxWidth: 400,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {record.shiftNotes}
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

// ── ProductivityForm ───────────────────────────────────────────────────────────

type ProductivityFormProps = {
    form: FormState;
    onChange: (updates: Partial<FormState>) => void;
    errors: Partial<Record<keyof FormState, string>>;
    employeeOptions: IDropdownOption[];
};

const ProductivityForm: FC<ProductivityFormProps> = ({
    form,
    onChange,
    errors,
    employeeOptions,
}): ReactElement => {
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
                label="Shift date"
                required
                value={form.storeDate}
                onChange={(_, v) => onChange({ storeDate: v ?? '' })}
                errorMessage={errors.storeDate}
                placeholder="YYYY-MM-DD"
            />

            <Stack horizontal tokens={{ childrenGap: 12 }} wrap>
                <Stack.Item grow={1} style={{ minWidth: 120 }}>
                    <TextField
                        label="Freight stocked (units)"
                        value={form.freightStockedUnits}
                        onChange={(_, v) => onChange({ freightStockedUnits: v ?? '' })}
                        errorMessage={errors.freightStockedUnits}
                        placeholder="e.g. 42"
                        type="number"
                    />
                </Stack.Item>
                <Stack.Item grow={1} style={{ minWidth: 120 }}>
                    <TextField
                        label="Break total (minutes)"
                        value={form.breakMinutes}
                        onChange={(_, v) => onChange({ breakMinutes: v ?? '' })}
                        errorMessage={errors.breakMinutes}
                        placeholder="e.g. 30"
                        type="number"
                    />
                </Stack.Item>
            </Stack>

            <TextField
                label="Zones / aisles covered"
                value={form.zonesCovered}
                onChange={(_, v) => onChange({ zonesCovered: v ?? '' })}
                placeholder="e.g. A1–A8, Dairy, Frozen"
            />

            <TextField
                label="Overstock notes"
                multiline
                rows={3}
                resizable={false}
                value={form.overstockNotes}
                onChange={(_, v) => onChange({ overstockNotes: v ?? '' })}
                placeholder="Overstock locations, product issues…"
            />

            <TextField
                label="Shift notes"
                multiline
                rows={4}
                resizable={false}
                value={form.shiftNotes}
                onChange={(_, v) => onChange({ shiftNotes: v ?? '' })}
                placeholder="General shift observations, call-outs, highlights…"
            />
        </Stack>
    );
};

// ── ProductivityPage ───────────────────────────────────────────────────────────

const ProductivityPage: FC = (): ReactElement => {
    const [records, setRecords] = useState<ProductivityRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);

    // Date filter — defaults to today
    const [filterDate, setFilterDate] = useState(todayISO());

    // Employee lookup for display + dropdown
    const [employeeMap, setEmployeeMap] = useState<Map<string, Employee>>(new Map());
    const [employeeOptions, setEmployeeOptions] = useState<IDropdownOption[]>([]);

    // Panel state
    const [panelOpen, setPanelOpen] = useState(false);
    const [editing, setEditing] = useState<ProductivityRecord | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm());
    const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({});
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Delete dialog
    const [deleteTarget, setDeleteTarget] = useState<ProductivityRecord | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // ── Load employees once (for name display and dropdown) ────────────────────

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
            // Non-fatal — employees will show as IDs if this fails
        });
    }, []);

    // ── Load productivity records for the selected date ────────────────────────

    const load = useCallback(async (date: string) => {
        setLoading(true);
        setListError(null);
        try {
            const data = await getProductivityRecords({ date });
            setRecords(data);
        } catch {
            setListError('Failed to load productivity records. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load(filterDate);
    }, [load, filterDate]);

    // ── Panel helpers ──────────────────────────────────────────────────────────

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm(filterDate));
        setFormErrors({});
        setSaveError(null);
        setPanelOpen(true);
    };

    const openEdit = (record: ProductivityRecord) => {
        setEditing(record);
        setForm({
            employeeId: record.employeeId,
            storeDate: record.storeDate,
            freightStockedUnits: record.freightStockedUnits != null ? String(record.freightStockedUnits) : '',
            breakMinutes: record.breakMinutes != null ? String(record.breakMinutes) : '',
            zonesCovered: record.zonesCovered ?? '',
            overstockNotes: record.overstockNotes ?? '',
            shiftNotes: record.shiftNotes ?? '',
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
        if (form.freightStockedUnits !== '' && (isNaN(Number(form.freightStockedUnits)) || Number(form.freightStockedUnits) < 0))
            errs.freightStockedUnits = 'Must be a number ≥ 0.';
        if (form.breakMinutes !== '' && (isNaN(Number(form.breakMinutes)) || Number(form.breakMinutes) < 0))
            errs.breakMinutes = 'Must be a number ≥ 0.';

        setFormErrors(errs);
        return Object.keys(errs).length === 0;
    };

    // ── Save ───────────────────────────────────────────────────────────────────

    const handleSave = async () => {
        if (!validateForm()) return;
        setSaving(true);
        setSaveError(null);

        const payload: ProductivityFormData = {
            employeeId: form.employeeId,
            storeDate: form.storeDate,
            ...(form.freightStockedUnits !== '' && { freightStockedUnits: Number(form.freightStockedUnits) }),
            ...(form.breakMinutes       !== '' && { breakMinutes:        Number(form.breakMinutes) }),
            ...(form.zonesCovered.trim()       && { zonesCovered:        form.zonesCovered.trim() }),
            ...(form.overstockNotes.trim()     && { overstockNotes:      form.overstockNotes.trim() }),
            ...(form.shiftNotes.trim()         && { shiftNotes:          form.shiftNotes.trim() }),
        };

        try {
            if (editing) {
                await updateProductivityRecord(editing.id, payload);
            } else {
                await createProductivityRecord(payload);
            }
            setPanelOpen(false);
            await load(filterDate);
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
            await deleteProductivityRecord(deleteTarget.id);
            setDeleteTarget(null);
            await load(filterDate);
        } catch {
            setDeleteError('Delete failed. Please try again.');
        } finally {
            setDeleting(false);
        }
    };

    // ── Delete dialog label ────────────────────────────────────────────────────

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
                        <Text variant="xxLarge" block style={{ fontWeight: 600 }}>Productivity</Text>
                        <Text variant="medium" style={{ color: '#605e5c' }}>
                            Daily productivity entries per employee
                        </Text>
                    </Stack.Item>
                    <Stack.Item>
                        <PrimaryButton
                            text="New Entry"
                            iconProps={{ iconName: 'Add' }}
                            onClick={openCreate}
                        />
                    </Stack.Item>
                </Stack>
            </Stack.Item>

            {/* Date filter */}
            <Stack.Item tokens={stackItemPadding}>
                <Stack horizontal wrap tokens={{ childrenGap: 12 }} verticalAlign="end">
                    <TextField
                        label="Date"
                        value={filterDate}
                        onChange={(_, v) => setFilterDate(v ?? '')}
                        placeholder="YYYY-MM-DD"
                        styles={{ root: { width: 160 } }}
                    />
                    <DefaultButton
                        text="Clear"
                        iconProps={{ iconName: 'ClearFilter' }}
                        onClick={() => setFilterDate(todayISO())}
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
                        <Spinner size={SpinnerSize.large} label="Loading productivity records…" />
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
                            No productivity entries for {filterDate}.
                        </Text>
                        <DefaultButton
                            text="Add first entry"
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
                            <ProductivityRow
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
                        {records.length} entr{records.length !== 1 ? 'ies' : 'y'} for {filterDate}
                    </Text>
                </Stack.Item>
            )}

            {/* Create / Edit panel */}
            <Panel
                isOpen={panelOpen}
                onDismiss={closePanel}
                type={PanelType.smallFixedFar}
                headerText={editing ? 'Edit Productivity Entry' : 'New Productivity Entry'}
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
                    <ProductivityForm
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
                    title: 'Remove productivity entry',
                    subText: deleteTarget
                        ? `Remove the entry for ${deleteLabel} on ${deleteTarget.storeDate}? This cannot be undone.`
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

export default ProductivityPage;
