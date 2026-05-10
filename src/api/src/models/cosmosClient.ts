import { CosmosClient, Container, Database } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import { DatabaseConfig } from "../config/appConfig";
import { logger } from "../config/observability";

// ---------------------------------------------------------------------------
// Auth selection
// ---------------------------------------------------------------------------
// Cloud Run / non-Azure deployments: set AZURE_COSMOS_KEY to the Cosmos DB
// account primary (or secondary) key. Key auth requires disableLocalAuth=false
// on the Cosmos account (the default). When AZURE_COSMOS_KEY is present it
// takes priority over managed-identity credential.
//
// Azure / managed-identity deployments: leave AZURE_COSMOS_KEY unset and the
// code falls back to DefaultAzureCredential (Workload Identity / developer
// credential), which requires disableLocalAuth=true on the Cosmos account.
// ---------------------------------------------------------------------------

// Names of all Dales Operations Cosmos DB containers.
// These must match the container names defined in infra/app/db-avm.bicep.
export const containerNames = [
    "employees",
    "tasks",
    "productivity",
    "coaching",
    "issues",
    "summaries",
] as const;

export type ContainerName = typeof containerNames[number];

let cosmosClient: CosmosClient;
let database: Database;
const containers: Partial<Record<ContainerName, Container>> = {};

export const configureCosmos = async (config: DatabaseConfig) => {
    // Skip Cosmos DB configuration in test environment — routes will use the in-memory mock.
    if (process.env.NODE_ENV === "test") {
        logger.info("Skipping Cosmos DB configuration in test environment");
        return;
    }

    try {
        const cosmosKey = process.env.AZURE_COSMOS_KEY;

        if (cosmosKey) {
            // Key-based auth — used for Cloud Run and any non-Azure deployment.
            // Requires disableLocalAuth=false on the Cosmos DB account.
            logger.info("Connecting to Cosmos DB using account key (AZURE_COSMOS_KEY)...");
            cosmosClient = new CosmosClient({
                endpoint: config.endpoint,
                key: cosmosKey,
            });
        } else {
            // Managed-identity / DefaultAzureCredential — used for Azure App Service
            // and Azure-hosted deployments. Requires disableLocalAuth=true on the
            // Cosmos account and the service principal to have the Data Contributor role.
            logger.info("Connecting to Cosmos DB using managed identity (DefaultAzureCredential)...");
            const credential = new DefaultAzureCredential();
            cosmosClient = new CosmosClient({
                endpoint: config.endpoint,
                aadCredentials: credential,
            });
        }

        database = cosmosClient.database(config.databaseName);

        // Cache a Container handle for each Dales Operations collection.
        for (const name of containerNames) {
            containers[name] = database.container(name);
        }

        // Test the connection
        await database.read();
        logger.info("Cosmos DB connected successfully!");
    } catch (err) {
        logger.error(`Cosmos DB connection error: ${err}`);
        throw err;
    }
};

/**
 * Returns the Cosmos DB Container for the given Dales Operations collection.
 * In test mode, returns an in-memory mock so route handlers can run without a real DB.
 */
export const getContainer = (name: ContainerName): Container => {
    if (process.env.NODE_ENV === "test") {
        return createMockContainer(name) as unknown as Container;
    }
    const container = containers[name];
    if (!container) {
        throw new Error(`Cosmos DB container "${name}" not initialized. Call configureCosmos first.`);
    }
    return container;
};

export const getCosmosClient = () => {
    if (!cosmosClient) {
        throw new Error("Cosmos DB not initialized. Call configureCosmos first.");
    }
    return cosmosClient;
};

// ---------------------------------------------------------------------------
// In-memory mock used only when NODE_ENV=test
// ---------------------------------------------------------------------------

// Each container gets its own Map so test data does not bleed across collections.
const mockData: Record<string, Map<string, unknown>> = {};

const getMockStore = (containerName: string): Map<string, unknown> => {
    if (!mockData[containerName]) {
        mockData[containerName] = new Map<string, unknown>();
    }
    return mockData[containerName];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createMockContainer = (containerName: ContainerName) => {
    const store = getMockStore(containerName);

    return {
        items: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            create: async (item: any) => {
                store.set(item.id, item);
                return { resource: item };
            },
            readAll: () => ({
                fetchAll: async () => ({ resources: Array.from(store.values()) }),
            }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            query: (_spec: any) => ({
                fetchAll: async () => ({ resources: Array.from(store.values()) }),
            }),
        },
        item: (id: string) => ({
            read: async () => ({ resource: store.get(id) ?? null }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            replace: async (item: any) => {
                store.set(id, item);
                return { resource: item };
            },
            delete: async () => {
                if (!store.has(id)) {
                    // Match Cosmos SDK behavior: throw a 404-shaped error
                    const err = new Error("Not found") as Error & { code?: number };
                    err.code = 404;
                    throw err;
                }
                store.delete(id);
                return {};
            },
        }),
    };
};

// Allows tests to reset the in-memory store between runs.
export const clearMockData = () => {
    if (process.env.NODE_ENV === "test") {
        for (const key of Object.keys(mockData)) {
            mockData[key].clear();
        }
    }
};
