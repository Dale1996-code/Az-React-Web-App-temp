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
import { observability } from "./config/observability";

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
        console.log(`Allowing requests from any origins. NODE_ENV=${environment}`);
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

    // Middleware
    app.use(express.json());
    app.use(cors({
        origin: originList()
    }));

    // Dales Operations API routes — one router per domain collection.
    app.use("/dashboard", dashboard);
    app.use("/employees", employees);
    app.use("/tasks", tasks);
    app.use("/productivity", productivity);
    app.use("/coaching", coaching);
    app.use("/issues", issues);
    app.use("/summaries", summaries);

    // Health-check endpoint for deployment probes and smoke tests
    app.get("/health", (_req, res) => {
        res.json({ status: "ok", timestamp: new Date().toISOString() });
    });

    // Swagger UI for the OpenAPI spec
    const swaggerDocument = yaml.load("./openapi.yaml");
    app.use("/", swaggerUI.serve, swaggerUI.setup(swaggerDocument));

    return app;
};
