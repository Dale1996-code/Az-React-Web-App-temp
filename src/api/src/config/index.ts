import { AppConfig, CacheConfig, DatabaseConfig, ObservabilityConfig } from "./appConfig";
import dotenv from "dotenv";
import { logger } from "../config/observability";
import { IConfig } from "config";

export const getConfig: () => Promise<AppConfig> = async () => {
    // Load any ENV vars from local .env file
    if (process.env.NODE_ENV !== "production") {
        dotenv.config();
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config: IConfig = require("config") as IConfig;
    const databaseConfig = config.get<DatabaseConfig>("database");
    const observabilityConfig = config.get<ObservabilityConfig>("observability");
    const cacheConfig = config.get<CacheConfig>("cache");

    const appConfig: AppConfig = {
        observability: {
            connectionString: observabilityConfig.connectionString,
            roleName: observabilityConfig.roleName,
        },
        database: {
            projectId: databaseConfig.projectId,
            databaseId: databaseConfig.databaseId,
        },
        cache: {
            redisUrl: cacheConfig.redisUrl,
        },
    };

    validateConfig(appConfig);

    return appConfig;
};

/**
 * Validates configuration settings.
 *
 * The Firestore project id is optional: on Cloud Run it is resolved from the
 * metadata server, and locally it comes from Application Default Credentials.
 * It is only worth a warning, never a hard failure.
 */
const validateConfig = (config: AppConfig): void => {
    if (!config.database.projectId) {
        logger.warn(
            "GOOGLE_CLOUD_PROJECT is not set. Firestore will resolve the project " +
            "from Application Default Credentials (Cloud Run) or `gcloud` config (local)."
        );
    }

    if (!config.observability.connectionString) {
        // Telemetry is optional; observability.ts handles a missing string gracefully.
        logger.warn(
            "APPLICATIONINSIGHTS_CONNECTION_STRING is not set — telemetry will be disabled."
        );
    }
};
