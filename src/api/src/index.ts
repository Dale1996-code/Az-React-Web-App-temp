import { createApp } from "./app";
import { logger } from "./config/observability";

const main = async () => {
    const app = await createApp();
    const port = process.env.FUNCTIONS_CUSTOMHANDLER_PORT || process.env.PORT || 3100;

    app.listen(port, () => {
        logger.info(`API listening on port ${port}`);
    });
};

main().catch(err => {
    logger.error(`Fatal startup error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
});