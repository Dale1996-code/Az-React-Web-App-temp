import express, { Request, Router } from "express";
import { BaseEntity, BaseRepository, FindSpec } from "../models/baseRepository";
import { Validator } from "../validation";
import { PagingQueryParams } from "./common";
import { logger } from "../config/observability";

/**
 * Translates collection-specific query-string params into a FindSpec
 * (conditions + optional sort order). Pagination (top/skip) is injected by
 * the router from the request's own query params, so do not set those here.
 */
export type SpecBuilder = (query: Record<string, string>) => Omit<FindSpec, "top" | "skip">;

/**
 * Creates a standard REST CRUD router for a single Dales Operations collection.
 *
 * Routes:
 *   GET    /        – list (server-side filtered + paginated via ?top= and ?skip=)
 *   POST   /        – create new
 *   GET    /:id     – get by id
 *   PUT    /:id     – update by id
 *   DELETE /:id     – delete by id
 *
 * `getRepository` is a factory rather than a value so that the underlying
 * Firestore store is resolved lazily — after configureFirestore has run.
 *
 * `validate` is an optional per-collection validator called before every
 * POST (isUpdate=false) and PUT (isUpdate=true). When validation fails the
 * router returns 400 { error, details }. When it passes, the sanitized
 * (allowlisted + trimmed) body is forwarded to the repository.
 *
 * `buildSpec` is an optional collection-specific function that converts
 * query-string params into filter conditions applied by the repository.
 */
const MAX_TOP = 1000;
const DEFAULT_TOP = 100;

/**
 * Parses a pagination query param into a non-negative integer, falling back to
 * `fallback` when absent or invalid. The result is clamped to [0, max].
 */
const parsePagingParam = (raw: string | undefined, fallback: number, max: number): number => {
    if (raw === undefined) {
        return fallback;
    }
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 0) {
        return fallback;
    }
    return Math.min(parsed, max);
};

export const createCrudRouter = <T extends BaseEntity>(
    getRepository: () => BaseRepository<T>,
    label: string,
    validate?: Validator,
    buildSpec?: SpecBuilder,
): Router => {
    const router = express.Router();

    // GET / — list with server-side filtering and pagination
    router.get(
        "/",
        async (req: Request<unknown, unknown, unknown, PagingQueryParams>, res) => {
            try {
                const skip = parsePagingParam(req.query.skip, 0, Number.MAX_SAFE_INTEGER);
                const top = parsePagingParam(req.query.top, DEFAULT_TOP, MAX_TOP);
                const spec: FindSpec = buildSpec
                    ? { ...buildSpec(req.query as Record<string, string>), top, skip }
                    : { top, skip };
                const repository = getRepository();
                const items = await repository.findWhere(spec);
                res.json(items);
            } catch (err) {
                logger.error(`[${label}] ${req.method} ${req.originalUrl} 500 – ${err instanceof Error ? err.message : String(err)}`);
                res.status(500).json({ error: "Internal server error" });
            }
        },
    );

    // POST / — create new
    router.post("/", async (req: Request<unknown, unknown, Partial<T>>, res) => {
        try {
            if (validate) {
                const result = validate(req.body, false);
                if (!result.valid) {
                    return res.status(400).json({ error: "Validation failed", details: result.details });
                }
                req.body = result.sanitized as Partial<T>;
            }

            const repository = getRepository();
            const created = await repository.create(req.body);

            res.setHeader("location", `${req.protocol}://${req.get("Host")}${req.baseUrl}/${created.id}`);
            res.status(201).json(created);
        } catch (err) {
            logger.error(`[${label}] ${req.method} ${req.originalUrl} 500 – ${err instanceof Error ? err.message : String(err)}`);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // GET /:id
    router.get("/:id", async (req: Request<{ id: string }>, res) => {
        try {
            const repository = getRepository();
            const item = await repository.findById(req.params.id);
            if (!item) {
                return res.status(404).send();
            }
            res.json(item);
        } catch (err) {
            logger.error(`[${label}] ${req.method} ${req.originalUrl} 500 – ${err instanceof Error ? err.message : String(err)}`);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // PUT /:id
    router.put("/:id", async (req: Request<{ id: string }, unknown, Partial<T>>, res) => {
        try {
            if (validate) {
                const result = validate(req.body, true);
                if (!result.valid) {
                    return res.status(400).json({ error: "Validation failed", details: result.details });
                }
                req.body = result.sanitized as Partial<T>;
            }

            const repository = getRepository();
            const updated = await repository.update(req.params.id, req.body);
            if (!updated) {
                return res.status(404).send();
            }
            res.json(updated);
        } catch (err) {
            logger.error(`[${label}] ${req.method} ${req.originalUrl} 500 – ${err instanceof Error ? err.message : String(err)}`);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // DELETE /:id
    router.delete("/:id", async (req: Request<{ id: string }>, res) => {
        try {
            const repository = getRepository();
            const deleted = await repository.delete(req.params.id);
            if (!deleted) {
                return res.status(404).send();
            }
            res.status(204).send();
        } catch (err) {
            logger.error(`[${label}] ${req.method} ${req.originalUrl} 500 – ${err instanceof Error ? err.message : String(err)}`);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    return router;
};
