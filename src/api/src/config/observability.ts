import * as applicationInsights from "applicationinsights";
import { ObservabilityConfig } from "./appConfig";
import winston from "winston";
import { ApplicationInsightsTransport } from "./applicationInsightsTransport";

export enum LogLevel {
    Error = "error",
    Warning = "warn",
    Information = "info",
    Verbose = "verbose",
    Debug = "debug",
}

export const logger = winston.createLogger({
    level: "info",
    format: winston.format.json(),
    transports: [
        // Always log to stdout — captured by Cloud Run / Cloud Logging automatically
        // regardless of whether App Insights is configured.
        new winston.transports.Console({ format: winston.format.simple() }),
        new winston.transports.File({ filename: "error.log", level: "error" }),
    ],
    exceptionHandlers: [
        new winston.transports.File({ filename: "exceptions.log" }),
    ]
});

export const observability = (config: ObservabilityConfig) => {
    logger.defaultMeta = { app: config.roleName };

    if (!config.connectionString) {
        logger.info("Application Insights disabled — APPLICATIONINSIGHTS_CONNECTION_STRING not set");
        return;
    }

    try {
        applicationInsights
            .setup(config.connectionString)
            .setAutoDependencyCorrelation(true)
            .setAutoCollectRequests(true)
            .setAutoCollectPerformance(true, false)
            .setAutoCollectExceptions(true)
            .setAutoCollectDependencies(true)
            .setAutoCollectConsole(false)   // Winston handles all logging; skip console interception
            .setUseDiskRetryCaching(true)
            .setSendLiveMetrics(false)      // Live Metrics adds cost; enable manually when needed
            .setDistributedTracingMode(applicationInsights.DistributedTracingModes.AI_AND_W3C);

        applicationInsights.defaultClient.context.tags[applicationInsights.defaultClient.context.keys.cloudRole] = config.roleName;
        applicationInsights.defaultClient.setAutoPopulateAzureProperties(true);
        applicationInsights.start();

        const applicationInsightsTransport = new ApplicationInsightsTransport({
            client: applicationInsights.defaultClient,
            level: LogLevel.Information,
            handleExceptions: true,
            handleRejections: true,
        });

        logger.add(applicationInsightsTransport);
        logger.info("Application Insights telemetry enabled");
    } catch (err) {
        logger.error(`Application Insights setup failed: ${err instanceof Error ? err.message : String(err)}`);
    }
};
