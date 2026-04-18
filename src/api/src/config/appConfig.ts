export interface ObservabilityConfig {
    connectionString: string
    roleName: string
}

export interface DatabaseConfig {
    endpoint: string
    databaseName: string
}

export interface AuthConfig {
    tenantId: string
    clientId: string
}

export interface AppConfig {
    observability: ObservabilityConfig
    database: DatabaseConfig
    auth: AuthConfig
}
