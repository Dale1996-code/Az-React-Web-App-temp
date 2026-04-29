import {
    PublicClientApplication,
    Configuration,
    InteractionRequiredAuthError,
    SilentRequest,
} from '@azure/msal-browser';
import config from '../config';

function buildMsalInstance(): PublicClientApplication | null {
    if (!config.auth.enabled) return null;

    const msalConfig: Configuration = {
        auth: {
            clientId: config.auth.clientId,
            authority: `https://login.microsoftonline.com/${config.auth.tenantId}`,
            redirectUri: window.location.origin,
            postLogoutRedirectUri: window.location.origin,
        },
        cache: {
            cacheLocation: 'sessionStorage',
            storeAuthStateInCookie: false,
        },
    };

    return new PublicClientApplication(msalConfig);
}

export const msalInstance = buildMsalInstance();

// MSAL Browser 3.x requires initialize() before any other method is called.
// Store the promise so acquireToken() can await it safely from the axios interceptor.
export const msalInit: Promise<void> = msalInstance
    ? msalInstance.initialize()
    : Promise.resolve();

export const loginRequest = {
    scopes: config.auth.apiScope
        ? config.auth.apiScope.split(' ')
        : ['openid', 'profile'],
};

export async function acquireToken(): Promise<string | null> {
    if (!msalInstance) return null;
    await msalInit;

    const account = msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0];
    if (!account) return null;

    const request: SilentRequest = {
        scopes: loginRequest.scopes,
        account,
    };

    try {
        const result = await msalInstance.acquireTokenSilent(request);
        return result.accessToken;
    } catch (err) {
        if (err instanceof InteractionRequiredAuthError) {
            // Interactive auth is handled by AuthProvider; proceed without token for now.
            console.warn('[Auth] Silent token requires interaction; request will proceed without Authorization header.');
        } else {
            console.warn('[Auth] Token acquisition failed:', err);
        }
        return null;
    }
}
