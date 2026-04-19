import { useState } from 'react';

export function useCrudPanel<T, F extends Record<string, unknown>>(initialForm: F) {
    const [panelOpen, setPanelOpen] = useState(false);
    const [editing, setEditing] = useState<T | null>(null);
    const [form, setForm] = useState<F>(initialForm);
    const [formErrors, setFormErrors] = useState<Partial<Record<keyof F, string>>>({});
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<T | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const openCreate = (initial: F) => {
        setEditing(null);
        setForm(initial);
        setFormErrors({});
        setSaveError(null);
        setPanelOpen(true);
    };

    const openEdit = (item: T, formData: F) => {
        setEditing(item);
        setForm(formData);
        setFormErrors({});
        setSaveError(null);
        setPanelOpen(true);
    };

    const closePanel = () => {
        if (saving) return;
        setPanelOpen(false);
    };

    const updateForm = (updates: Partial<F>) => {
        setForm(prev => ({ ...prev, ...updates } as F));
        setFormErrors(prev => {
            const next = { ...prev };
            (Object.keys(updates) as (keyof F)[]).forEach(k => delete next[k]);
            return next;
        });
    };

    return {
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
    };
}
