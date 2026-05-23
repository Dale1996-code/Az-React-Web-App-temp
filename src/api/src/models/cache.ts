import { createClient } from "redis";
import { CacheConfig } from "../config/appConfig";
import { logger } from "../config/observability";

// ---------------------------------------------------------------------------
// Optional in-memory cache layer (Memorystore for Redis on Cloud Run).
//
// This mirrors the cache tier of the Google Cloud "Three-tier web app" Jump
// Start Solution: a Redis cache in front of frequently accessed reads.
//
// The cache is entirely optional. It is only used when REDIS_URL is set, and
// is never constructed when NODE_ENV=test, so `npm test` stays DB- and
// network-free. Every read/write fails soft — if Redis is unreachable the
// caller transparently falls back to the underlying datastore.
// ---------------------------------------------------------------------------

let client: ReturnType<typeof createClient> | undefined;
let enabled = false;

export const configureCache = async (config: CacheConfig): Promise<void> => {
    if (process.env.NODE_ENV === "test") {
        return;
    }

    if (!config.redisUrl) {
        logger.warn("REDIS_URL is not set — dashboard response caching is disabled.");
        return;
    }

    try {
        client = createClient({ url: config.redisUrl });
        // A connection drop after startup must not crash the process; log and
        // let the next operation fail soft into the datastore fallback.
        client.on("error", (err: unknown) =>
            logger.error(`[cache] Redis error – ${err instanceof Error ? err.message : String(err)}`)
        );
        await client.connect();
        enabled = true;
        logger.info("[cache] Redis cache connected.");
    } catch (err) {
        client = undefined;
        enabled = false;
        logger.error(
            `[cache] Redis connection failed, caching disabled – ${err instanceof Error ? err.message : String(err)}`
        );
    }
};

export const cacheGet = async <T>(key: string): Promise<T | null> => {
    if (!enabled || !client) {
        return null;
    }
    try {
        const raw = await client.get(key);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch (err) {
        logger.error(`[cache] GET ${key} failed – ${err instanceof Error ? err.message : String(err)}`);
        return null;
    }
};

export const cacheSet = async (key: string, value: unknown, ttlSeconds: number): Promise<void> => {
    if (!enabled || !client) {
        return;
    }
    try {
        await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
    } catch (err) {
        logger.error(`[cache] SET ${key} failed – ${err instanceof Error ? err.message : String(err)}`);
    }
};

export const isCacheEnabled = (): boolean => enabled;
