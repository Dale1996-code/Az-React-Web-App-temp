export interface ObservabilityConfig {
    connectionString: string
    roleName: string
}

export interface DatabaseConfig {
    projectId: string
    databaseId: string
}

export interface AppConfig {
    observability: ObservabilityConfig
    database: DatabaseConfig
}
