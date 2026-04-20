import { AppConfig, DatabaseConfig, ObservabilityConfig } from "./appConfig";
import dotenv from "dotenv";
import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";
import { logger } from "../config/observability";
import { IConfig } from "config";

export const getConfig: () => Promise<AppConfig> = async () => {
    // Load any ENV vars from local .env file
    if (process.env.NODE_ENV !== "production") {
        dotenv.config();
    }

    await populateEnvironmentFromKeyVault();

    // Load configuration after Azure KeyVault population is complete
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config: IConfig = require("config") as IConfig;
    const databaseConfig = config.get<DatabaseConfig>("database");
    const observabilityConfig = config.get<ObservabilityConfig>("observability");

    const appConfig: AppConfig = {
        observability: {
            connectionString: observabilityConfig.connectionString,
            roleName: observabilityConfig.roleName,
        },
        database: {
            endpoint: databaseConfig.endpoint,
            databaseName: databaseConfig.databaseName,
        },
        auth: {
            tenantId: process.env.AZURE_AD_TENANT_ID ?? "",
            clientId: process.env.AZURE_AD_CLIENT_ID ?? "",
        },
    };

    validateConfig(appConfig);

    return appConfig;
};

/**
 * Validates required configuration settings.
 *
 * In production all required settings must be present and well-formed —
 * a missing value that only surfaces at the first DB call is much harder
 * to diagnose than a startup failure with a clear message.
 *
 * In development warnings are emitted but startup continues so engineers
 * can run the server without every Azure resource wired up.
 */
const validateConfig = (config: AppConfig): void => {
    const isProduction = process.env.NODE_ENV === "production";
    const errors: string[] = [];

    // Auth config — required in production, optional elsewhere (bypassed automatically).
    if (isProduction && !config.auth.tenantId) {
        errors.push(
            "AZURE_AD_TENANT_ID must be set in production. " +
            "Find it in Azure Portal > Entra ID > Overview > Tenant ID."
        );
    }
    if (isProduction && !config.auth.clientId) {
        errors.push(
            "AZURE_AD_CLIENT_ID must be set in production. " +
            "This is the Application (client) ID of the App Registration that represents the API."
        );
    }

    // AZURE_COSMOS_ENDPOINT — without this every DB call fails with a cryptic SDK error.
    if (!config.database.endpoint) {
        errors.push(
            "AZURE_COSMOS_ENDPOINT is not set. " +
            "Set it to your Cosmos DB account URI (e.g. https://<account>.documents.azure.com:443/)."
        );
    } else {
        let parsedUrl: URL | undefined;
        try {
            parsedUrl = new URL(config.database.endpoint);
        } catch {
            errors.push(
                `AZURE_COSMOS_ENDPOINT is not a valid URL: "${config.database.endpoint}". ` +
                "Expected format: https://<account>.documents.azure.com:443/"
            );
        }
        if (parsedUrl && parsedUrl.protocol !== "https:") {
            errors.push(
                `AZURE_COSMOS_ENDPOINT must use https:// — got "${config.database.endpoint}".`
            );
        }
    }

    if (!config.observability.connectionString) {
        // Telemetry is optional; observability.ts handles a missing string gracefully.
        logger.warn(
            "APPLICATIONINSIGHTS_CONNECTION_STRING is not set — telemetry will be disabled. " +
            "Set it to the Application Insights connection string to enable monitoring."
        );
    }

    if (errors.length === 0) {
        return;
    }

    const detail = errors.map(e => `  • ${e}`).join("\n");
    const hint = isProduction
        ? "In Azure these values are injected by the Bicep deployment. Check the App Service configuration in the Azure Portal."
        : "Copy src/api/.env.example to src/api/.env and fill in the missing values.";

    const message = `Startup aborted — required configuration is missing or invalid:\n${detail}\n\n${hint}`;
    logger.error(message);

    if (isProduction) {
        throw new Error(message);
    }
};

const populateEnvironmentFromKeyVault = async () => {
    // If Azure key vault endpoint is defined
    // 1. Login with Default credential (managed identity or service principal)
    // 2. Overlay key vault secrets on top of ENV vars
    const keyVaultEndpoint = process.env.AZURE_KEY_VAULT_ENDPOINT || "";

    if (!keyVaultEndpoint) {
        logger.warn("AZURE_KEY_VAULT_ENDPOINT has not been set. Configuration will be loaded from current environment.");
        return;
    }

    try {
        logger.info("Populating environment from Azure KeyVault...");
        const credential = new DefaultAzureCredential({});
        const secretClient = new SecretClient(keyVaultEndpoint, credential);

        for await (const secretProperties of secretClient.listPropertiesOfSecrets()) {
            const secret = await secretClient.getSecret(secretProperties.name);

            // KeyVault does not support underscores in key names and replaces '-' with '_'
            // Expect KeyVault secret names to be in conventional capitalized snake casing after conversion
            const keyName = secret.name.replace(/-/g, "_");
            process.env[keyName] = secret.value;
        }
    }
    catch (err: any) {
        logger.error(`Error authenticating with Azure KeyVault.  Ensure your managed identity or service principal has GET/LIST permissions. Error: ${err}`);
        throw err;
    }
};