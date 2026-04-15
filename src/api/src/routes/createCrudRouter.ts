import express, { Request, Router } from "express";
import { BaseEntity, BaseRepository } from "../models/baseRepository";
import { Validator } from "../validation";
import { PagingQueryParams } from "./common";

/**
 * Creates a standard REST CRUD router for a single Dales Operations collection.
 *
 * Routes:
 *   GET    /        – list all (with ?top= and ?skip= pagination)
 *   POST   /        – create new
 *   GET    /:id     – get by id
 *   PUT    /:id     – update by id
 *   DELETE /:id     – delete by id
 *
 * `getRepository` is a factory rather than a value so that the underlying
 * Cosmos DB container is resolved lazily — after configureCosmos has run.
 *
 * `validate` is an optional per-collection validator called before every
 * POST (isUpdate=false) and PUT (isUpdate=true).  When validation fails the
 * router returns 400 { error, details }.  When it passes, the sanitized
 * (allowlisted + trimmed) body is forwarded to the repository.
 */
export const createCrudRouter = <T extends BaseEntity>(
    getRepository: () => BaseRepository<T>,
    label: string,
    validate?: Validator,
): Router => {
    const router = express.Router();

    // GET / — list all
    router.get(
        "/",
        async (req: Request<unknown, unknown, unknown, PagingQueryParams>, res) => {
            try {
                const repository = getRepository();
                const items = await repository.findAll();

                const skip = req.query.skip ? parseInt(req.query.skip) : 0;
                const top = req.query.top ? parseInt(req.query.top) : 100;
                res.json(items.slice(skip, skip + top));
            } catch (err) {
                console.error(`Error fetching ${label}:`, err);
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
            console.error(`Error creating ${label}:`, err);
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
            console.error(`Error fetching ${label} by id:`, err);
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
            console.error(`Error updating ${label}:`, err);
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
            console.error(`Error deleting ${label}:`, err);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    return router;
};
