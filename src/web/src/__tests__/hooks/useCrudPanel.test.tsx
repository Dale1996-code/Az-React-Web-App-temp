import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCrudPanel } from '../../hooks/useCrudPanel';

type Item = { id: string; name: string };
type Form = { name: string; value: string };

const emptyForm = (): Form => ({ name: '', value: '' });

describe('useCrudPanel', () => {
    it('starts with panel closed and no editing/delete state', () => {
        const { result } = renderHook(() => useCrudPanel<Item, Form>(emptyForm()));
        expect(result.current.panelOpen).toBe(false);
        expect(result.current.editing).toBeNull();
        expect(result.current.saving).toBe(false);
        expect(result.current.saveError).toBeNull();
        expect(result.current.deleteTarget).toBeNull();
        expect(result.current.deleting).toBe(false);
        expect(result.current.deleteError).toBeNull();
    });

    it('openCreate sets form, clears errors, opens panel', () => {
        const { result } = renderHook(() => useCrudPanel<Item, Form>(emptyForm()));

        act(() => {
            result.current.openCreate({ name: 'new', value: 'test' });
        });

        expect(result.current.panelOpen).toBe(true);
        expect(result.current.editing).toBeNull();
        expect(result.current.form).toEqual({ name: 'new', value: 'test' });
        expect(result.current.formErrors).toEqual({});
        expect(result.current.saveError).toBeNull();
    });

    it('openEdit sets item as editing, populates form, opens panel', () => {
        const { result } = renderHook(() => useCrudPanel<Item, Form>(emptyForm()));
        const item: Item = { id: '1', name: 'Alpha' };

        act(() => {
            result.current.openEdit(item, { name: 'Alpha', value: 'edited' });
        });

        expect(result.current.panelOpen).toBe(true);
        expect(result.current.editing).toEqual(item);
        expect(result.current.form).toEqual({ name: 'Alpha', value: 'edited' });
    });

    it('closePanel closes when not saving', () => {
        const { result } = renderHook(() => useCrudPanel<Item, Form>(emptyForm()));

        act(() => result.current.openCreate(emptyForm()));
        expect(result.current.panelOpen).toBe(true);

        act(() => result.current.closePanel());
        expect(result.current.panelOpen).toBe(false);
    });

    it('closePanel is a no-op while saving', () => {
        const { result } = renderHook(() => useCrudPanel<Item, Form>(emptyForm()));

        act(() => result.current.openCreate(emptyForm()));
        act(() => result.current.setSaving(true));

        act(() => result.current.closePanel());
        expect(result.current.panelOpen).toBe(true);
    });

    it('updateForm merges fields and clears their errors', () => {
        const { result } = renderHook(() => useCrudPanel<Item, Form>(emptyForm()));

        act(() => {
            result.current.setFormErrors({ name: 'Required', value: 'Required' });
        });
        act(() => {
            result.current.updateForm({ name: 'Alice' });
        });

        expect(result.current.form.name).toBe('Alice');
        expect(result.current.form.value).toBe('');
        expect(result.current.formErrors.name).toBeUndefined();
        expect(result.current.formErrors.value).toBe('Required');
    });

    it('setters update their respective state', () => {
        const { result } = renderHook(() => useCrudPanel<Item, Form>(emptyForm()));
        const item: Item = { id: '2', name: 'Beta' };

        act(() => result.current.setDeleteTarget(item));
        expect(result.current.deleteTarget).toEqual(item);

        act(() => result.current.setDeleting(true));
        expect(result.current.deleting).toBe(true);

        act(() => result.current.setDeleteError('oops'));
        expect(result.current.deleteError).toBe('oops');

        act(() => result.current.setSaveError('bad'));
        expect(result.current.saveError).toBe('bad');
    });
});
