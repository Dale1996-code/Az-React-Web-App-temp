import { ReactPlugin } from "@microsoft/applicationinsights-react-js";
import { ApplicationInsights, Snippet, ITelemetryItem } from "@microsoft/applicationinsights-web";
import { DistributedTracingModes } from "@microsoft/applicationinsights-common";
import { createBrowserHistory } from 'history'
import config from "../config";

const plugin = new ReactPlugin();
let applicationInsights: ApplicationInsights;
export const reactPlugin = plugin;

export const getApplicationInsights = (): ApplicationInsights | undefined => {
    if (applicationInsights) {
        return applicationInsights;
    }

    // Skip initialization when no connection string is configured. The SDK will
    // otherwise attempt to load with an empty endpoint and emit noisy console
    // errors on every page load — telemetry is opt-in via VITE_APPLICATIONINSIGHTS_CONNECTION_STRING.
    const connectionString = config.observability.connectionString?.trim();
    if (!connectionString) {
        return undefined;
    }

    const browserHistory = createBrowserHistory({ window: window });
    const ApplicationInsightsConfig: Snippet = {
        config: {
            connectionString,
            enableCorsCorrelation: true,
            distributedTracingMode: DistributedTracingModes.W3C,
            extensions: [plugin],
            extensionConfig: {
                [plugin.identifier]: { history: browserHistory }
            }
        }
    }

    applicationInsights = new ApplicationInsights(ApplicationInsightsConfig);
    try {
        applicationInsights.loadAppInsights();
        applicationInsights.addTelemetryInitializer((telemetry: ITelemetryItem) => {
            if (!telemetry) {
                return;
            }
            if (telemetry.tags) {
                telemetry.tags['ai.cloud.role'] = "webui";
            }
        });
    } catch(err) {
        console.error("ApplicationInsights setup failed despite a connection string being present.", err);
    }

    return applicationInsights;
}

export const trackEvent = (eventName: string, properties?: { [key: string]: unknown }): void => {
    if (!applicationInsights) {
        return;
    }

    applicationInsights.trackEvent({
        name: eventName,
        properties: properties
    });
}
