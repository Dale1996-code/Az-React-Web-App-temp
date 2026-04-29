import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FC } from 'react';
import { useAuthInfo } from '../../contexts/authContext';

// Auth disabled path: msalInstance is null, so AuthProvider renders children with auth off.
vi.mock('../../services/authService', () => ({
    msalInstance: null,
    loginRequest: { scopes: [] },
    acquireToken: vi.fn().mockResolvedValue(null),
}));

import AuthProvider from '../../components/AuthProvider';

const TestConsumer: FC = () => {
    const { authEnabled, account } = useAuthInfo();
    return (
        <div>
            <span data-testid="auth-enabled">{String(authEnabled)}</span>
            <span data-testid="account">{account?.name ?? 'none'}</span>
        </div>
    );
};

describe('AuthProvider (auth disabled)', () => {
    it('renders children and exposes authEnabled=false when msalInstance is null', () => {
        render(
            <AuthProvider>
                <TestConsumer />
            </AuthProvider>
        );
        expect(screen.getByTestId('auth-enabled')).toHaveTextContent('false');
        expect(screen.getByTestId('account')).toHaveTextContent('none');
    });

    it('renders children normally without crashing', () => {
        render(
            <AuthProvider>
                <p data-testid="child">hello</p>
            </AuthProvider>
        );
        expect(screen.getByTestId('child')).toHaveTextContent('hello');
    });
});
