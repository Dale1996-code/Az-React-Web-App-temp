import { FC, PropsWithChildren, useEffect, useState } from 'react';
import { MsalProvider, useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { Spinner, SpinnerSize, Stack, Text, MessageBar, MessageBarType } from '@fluentui/react';
import { AuthContext, AuthInfo } from '../contexts/authContext';
import { msalInstance, loginRequest } from '../services/authService';

const SigningInView: FC<{ error?: string }> = ({ error }) => (
    <Stack
        horizontalAlign="center"
        verticalAlign="center"
        styles={{ root: { height: '100vh' } }}
        tokens={{ childrenGap: 16 }}
    >
        {error ? (
            <MessageBar messageBarType={MessageBarType.error} isMultiline={false}>
                {error} — refresh the page to try again.
            </MessageBar>
        ) : (
            <>
                <Spinner size={SpinnerSize.large} label="Signing you in…" />
                <Text variant="medium" styles={{ root: { opacity: 0.7 } }}>
                    You will be redirected to Microsoft sign-in.
                </Text>
            </>
        )}
    </Stack>
);

const MsalBridge: FC<PropsWithChildren> = ({ children }) => {
    const { accounts, instance, inProgress } = useMsal();
    const [loginError, setLoginError] = useState<string | null>(null);

    useEffect(() => {
        if (inProgress === InteractionStatus.None && accounts.length === 0 && !loginError) {
            instance.loginRedirect(loginRequest).catch((err: Error) => {
                console.error('[Auth] loginRedirect failed:', err);
                setLoginError(err.message ?? 'Sign-in failed');
            });
        }
        if (accounts.length > 0 && !instance.getActiveAccount()) {
            instance.setActiveAccount(accounts[0]);
        }
    }, [accounts, inProgress, instance, loginError]);

    const authInfo: AuthInfo = {
        account: accounts[0] ?? null,
        authEnabled: true,
        login: () => instance.loginRedirect(loginRequest).catch(console.error),
        logout: () => instance.logoutRedirect({ postLogoutRedirectUri: '/' }).catch(console.error),
    };

    const isAuthenticated = inProgress === InteractionStatus.None && accounts.length > 0;

    return (
        <AuthContext.Provider value={authInfo}>
            {isAuthenticated ? children : <SigningInView error={loginError ?? undefined} />}
        </AuthContext.Provider>
    );
};

const disabledAuth: AuthInfo = {
    account: null,
    authEnabled: false,
    login: () => {},
    logout: () => {},
};

const AuthProvider: FC<PropsWithChildren> = ({ children }) => {
    if (!msalInstance) {
        return (
            <AuthContext.Provider value={disabledAuth}>
                {children}
            </AuthContext.Provider>
        );
    }

    return (
        <MsalProvider instance={msalInstance}>
            <MsalBridge>{children}</MsalBridge>
        </MsalProvider>
    );
};

export default AuthProvider;
