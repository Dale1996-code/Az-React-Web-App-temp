import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PanelFooter from '../../components/PanelFooter';

describe('PanelFooter', () => {
    it('shows Save and Cancel buttons in idle state', () => {
        render(<PanelFooter saving={false} onSave={vi.fn()} onCancel={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('shows "Saving…" and disables buttons while saving', () => {
        render(<PanelFooter saving onSave={vi.fn()} onCancel={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    });

    it('calls onSave when Save is clicked', async () => {
        const onSave = vi.fn();
        render(<PanelFooter saving={false} onSave={onSave} onCancel={vi.fn()} />);
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(onSave).toHaveBeenCalledOnce();
    });

    it('calls onCancel when Cancel is clicked', async () => {
        const onCancel = vi.fn();
        render(<PanelFooter saving={false} onSave={vi.fn()} onCancel={onCancel} />);
        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onCancel).toHaveBeenCalledOnce();
    });
});
