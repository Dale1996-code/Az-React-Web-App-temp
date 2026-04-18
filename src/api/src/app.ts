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
import { configureCosmos } from "./models/cosmosClient";
import { observability, logger } from "./config/observability";
import { createAuthMiddleware } from "./middleware/auth";

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

    const origins = [
        "https://portal.azure.com",
        "https://ms.portal.azure.com",
    ];

    if (allowOrigins && allowOrigins !== "") {
        allowOrigins.split(",").forEach(origin => {
            origins.push(origin);
        });
    }

    return origins;
};

export const createApp = async (): Promise<Express> => {
    const config = await getConfig();
    const app = express();

    // Configuration
    observability(config.observability);
    await configureCosmos(config.database);

    logger.info(
        `API initialised – env=${process.env.NODE_ENV ?? "production"} ` +
        `telemetry=${config.observability.connectionString ? "enabled" : "disabled"}`
    );

    // Middleware
    app.use(express.json());
    app.use(cors({
        origin: originList()
    }));

    // Health-check endpoint — no auth required; used by Azure deployment probes.
    app.get("/health", (_req, res) => {
        res.json({ status: "ok", timestamp: new Date().toISOString(), env: process.env.NODE_ENV ?? "production" });
    });

    // Auth middleware — bypassed automatically when NODE_ENV !== "production".
    // See src/api/src/middleware/auth.ts for behaviour details.
    const requireAuth = createAuthMiddleware(config.auth);

    // Dales Operations API routes — auth required on every business endpoint.
    // These must be registered before Swagger UI; swagger-ui-express setup()
    // never calls next(), so any route mounted after it is unreachable.
    app.use("/dashboard", requireAuth, dashboard);
    app.use("/employees", requireAuth, employees);
    app.use("/tasks", requireAuth, tasks);
    app.use("/productivity", requireAuth, productivity);
    app.use("/coaching", requireAuth, coaching);
    app.use("/issues", requireAuth, issues);
    app.use("/summaries", requireAuth, summaries);

    // Swagger UI — open without auth so the spec remains browsable for support/tooling.
    // Business data is not exposed by the spec itself.
    const swaggerDocument = yaml.load("./openapi.yaml");
    app.use("/", swaggerUI.serve, swaggerUI.setup(swaggerDocument));

    return app;
};
