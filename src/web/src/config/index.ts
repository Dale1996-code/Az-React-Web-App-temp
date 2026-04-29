/// <reference types="vite/client" />

export interface ApiConfig {
    baseUrl: string;
}

export interface ObservabilityConfig {
    connectionString: string;
}

export interface AuthConfig {
    clientId: string;
    tenantId: string;
    apiScope: string;
    enabled: boolean;
}

export interface AppConfig {
    api: ApiConfig;
    observability: ObservabilityConfig;
    auth: AuthConfig;
}

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID ?? '';
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID ?? '';
const apiScope = import.meta.env.VITE_AZURE_API_SCOPE ?? '';

const config: AppConfig = {
    api: {
        baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3100',
    },
    observability: {
        connectionString: import.meta.env.VITE_APPLICATIONINSIGHTS_CONNECTION_STRING || '',
    },
    auth: {
        clientId,
        tenantId,
        apiScope,
        enabled: !!(clientId && tenantId && apiScope),
    },
};

export default config;