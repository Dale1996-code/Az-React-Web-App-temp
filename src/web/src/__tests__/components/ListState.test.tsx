import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ListState from '../../components/ListState';

describe('ListState', () => {
    it('shows spinner when loading', () => {
        render(
            <ListState loading loadingLabel="Loading data…" empty={false} emptyContent={null}>
                <div>item</div>
            </ListState>
        );
        expect(screen.getByText('Loading data…')).toBeInTheDocument();
        expect(screen.queryByText('item')).not.toBeInTheDocument();
    });

    it('shows empty content when not loading and empty', () => {
        render(
            <ListState
                loading={false}
                loadingLabel="Loading…"
                empty
                emptyContent={<span>Nothing here</span>}
            >
                <div>item</div>
            </ListState>
        );
        expect(screen.getByText('Nothing here')).toBeInTheDocument();
        expect(screen.queryByText('item')).not.toBeInTheDocument();
    });

    it('shows children when not loading and not empty', () => {
        render(
            <ListState
                loading={false}
                loadingLabel="Loading…"
                empty={false}
                emptyContent={<span>Nothing here</span>}
            >
                <div>First item</div>
                <div>Second item</div>
            </ListState>
        );
        expect(screen.getByText('First item')).toBeInTheDocument();
        expect(screen.getByText('Second item')).toBeInTheDocument();
        expect(screen.queryByText('Nothing here')).not.toBeInTheDocument();
    });
});
