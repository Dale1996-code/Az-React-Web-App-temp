import express, { Express } from "express";
import swaggerUI from "swagger-ui-express";
import cors from "cors";
import yaml from "yamljs";
import { getConfig } from "./config";
import dashboard from "./routes/dashboard";
import employees from "./routes/employees";
import tasks from "./routes/tasks";
import productivity from "./routes/productivity";
import coaching from "./routes/coaching";
import issues from "./routes/issues";
import summaries from "./routes/summaries";
import { configureFirestore } from "./models/firestoreClient";
import { observability, logger } from "./config/observability";

// Use API_ALLOW_ORIGINS env var with comma separated urls like
// `http://localhost:3000, http://otherurl:100`
// Requests coming to the api server from other urls will be rejected as per
// CORS.
const allowOrigins = process.env.API_ALLOW_ORIGINS;

// Use NODE_ENV to change webConfiguration based on this value.
// For example, setting NODE_ENV=development disables CORS checking,
// allowing all origins.
const environment = process.env.NODE_ENV;

const originList = (): string[] | string => {

    if (environment && environment === "development") {
        logger.info(`CORS open to all origins (NODE_ENV=${environment})`);
        return "*";
    }

    // Production: only allow origins explicitly listed in API_ALLOW_ORIGINS.
    // Set API_ALLOW_ORIGINS to a comma-separated list of allowed URLs, e.g.:
    //   https://web-xxxxx-uc.a.run.app,https://your-custom-domain.com
    const origins: string[] = [];

    if (allowOrigins && allowOrigins !== "") {
        allowOrigins.split(",").forEach(origin => {
            const trimmed = origin.trim();
            if (trimmed !== "") {
                origins.push(trimmed);
            }
        });
    }

    if (origins.length === 0) {
        logger.warn(
            "API_ALLOW_ORIGINS is empty in a non-development environment — " +
            "all cross-origin browser requests will be rejected by CORS. " +
            "Set API_ALLOW_ORIGINS to a comma-separated list of allowed URLs.",
        );
    }

    return origins;
};

export const createApp = async (): Promise<Express> => {
    const config = await getConfig();
    const app = express();

    // Configuration
    observability(config.observability);
    await configureFirestore(config.database);

    logger.info(
        `API initialised – env=${process.env.NODE_ENV ?? "production"} ` +
        `telemetry=${config.observability.connectionString ? "enabled" : "disabled"}`
    );

    // Middleware
    app.use(express.json());
    app.use(cors({
        origin: originList()
    }));

    // Health-check endpoint — used by Cloud Run startup/liveness probes.
    app.get("/health", (_req, res) => {
        res.json({ status: "ok", timestamp: new Date().toISOString(), env: process.env.NODE_ENV ?? "production" });
    });

    // Dales Operations API routes. Authentication is currently disabled — the
    // endpoints are open. These must be registered before Swagger UI;
    // swagger-ui-express setup() never calls next(), so any route mounted
    // after it is unreachable.
    app.use("/dashboard", dashboard);
    app.use("/employees", employees);
    app.use("/tasks", tasks);
    app.use("/productivity", productivity);
    app.use("/coaching", coaching);
    app.use("/issues", issues);
    app.use("/summaries", summaries);

    // Swagger UI — open without auth so the spec remains browsable for support/tooling.
    // Business data is not exposed by the spec itself.
    const swaggerDocument = yaml.load("./openapi.yaml");
    app.use("/", swaggerUI.serve, swaggerUI.setup(swaggerDocument));

    return app;
};
