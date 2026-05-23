export interface ObservabilityConfig {
    connectionString: string
    roleName: string
}

export interface DatabaseConfig {
    projectId: string
    databaseId: string
}

export interface CacheConfig {
    redisUrl: string
}

export interface AppConfig {
    observability: ObservabilityConfig
    database: DatabaseConfig
    cache: CacheConfig
}
