import { createContext, useContext } from 'react';
import type { AccountInfo } from '@azure/msal-browser';

export interface AuthInfo {
    readonly account: AccountInfo | null;
    readonly authEnabled: boolean;
    login(): void;
    logout(): void;
}

export const AuthContext = createContext<AuthInfo>({
    account: null,
    authEnabled: false,
    login: () => {},
    logout: () => {},
});

export function useAuthInfo(): AuthInfo {
    return useContext(AuthContext);
}
