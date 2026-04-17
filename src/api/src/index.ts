import { createApp } from "./app";
import { logger } from "./config/observability";

const main = async () => {
    const app = await createApp();
    const port = process.env.FUNCTIONS_CUSTOMHANDLER_PORT || process.env.PORT || 3100;

    app.listen(port, () => {
        logger.info(`Started listening on port ${port}`);
    });
};

main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Fatal startup error — process will exit:\n${message}`);
    process.exit(1);
});