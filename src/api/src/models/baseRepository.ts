import { Container, SqlParameter } from "@azure/cosmos";
import { v4 as uuidv4 } from "uuid";

export interface BaseEntity {
    id: string;
    createdDate?: Date;
    updatedDate?: Date;
}

// ---------------------------------------------------------------------------
// Query specification types
// ---------------------------------------------------------------------------

/**
 * A single WHERE condition used by findWhere() and countWhere().
 * Using a structured value (not raw SQL) lets the in-memory test path and
 * the Cosmos SQL production path share the same filter definition.
 */
export type FilterCondition =
    | { op: "eq";          field: string; value: unknown }
    | { op: "neq";         field: string; value: unknown }
    | { op: "lt";          field: string; value: string | number }
    | { op: "lte";         field: string; value: string | number }
    | { op: "gt";          field: string; value: string | number }
    | { op: "gte";         field: string; value: string | number }
    | { op: "eq_ci";       field: string; value: string }
    | { op: "contains_ci"; field: string; value: string }
    | { op: "is_defined";  field: string }
    | { op: "or"; conditions: Array<Exclude<FilterCondition, { op: "or" }>> };

export interface FindSpec {
    conditions?: FilterCondition[];
    orderBy?: { field: string; desc?: boolean };
    top?: number;
    skip?: number;
}

// ---------------------------------------------------------------------------
// Cosmos SQL builder — used only in production (NODE_ENV !== "test")
// ---------------------------------------------------------------------------

type ParamAcc = { params: SqlParameter[]; idx: number };

function condToSql(cond: FilterCondition, acc: ParamAcc): string {
    const add = (value: unknown): string => {
        const name = `@p${acc.idx++}`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        acc.params.push({ name, value: value as any });
        return name;
    };
    switch (cond.op) {
    case "eq":   return `c.${cond.field} = ${add(cond.value)}`;
    case "neq":  return `c.${cond.field} != ${add(cond.value)}`;
    case "lt":   return `c.${cond.field} < ${add(cond.value)}`;
    case "lte":  return `c.${cond.field} <= ${add(cond.value)}`;
    case "gt":   return `c.${cond.field} > ${add(cond.value)}`;
    case "gte":  return `c.${cond.field} >= ${add(cond.value)}`;
    case "eq_ci": {
        const p = add(cond.value.toLowerCase());
        return `LOWER(c.${cond.field}) = ${p}`;
    }
    case "contains_ci": {
        const p = add(cond.value.toLowerCase());
        return `CONTAINS(LOWER(c.${cond.field}), ${p})`;
    }
    case "is_defined":
        return `(IS_DEFINED(c.${cond.field}) AND NOT IS_NULL(c.${cond.field}))`;
    case "or": {
        const parts = cond.conditions.map(c => condToSql(c, acc));
        return `(${parts.join(" OR ")})`;
    }
    }
}

function buildSelectSql(spec: FindSpec): { query: string; parameters: SqlParameter[] } {
    const acc: ParamAcc = { params: [], idx: 0 };
    const conditions = spec.conditions ?? [];
    const where = conditions.length > 0
        ? `WHERE ${conditions.map(c => condToSql(c, acc)).join(" AND ")}`
        : "";
    const orderBy = spec.orderBy
        ? `ORDER BY c.${spec.orderBy.field} ${spec.orderBy.desc ? "DESC" : "ASC"}`
        : "";
    const top = spec.top ?? 100;
    const skip = spec.skip ?? 0;
    // OFFSET/LIMIT do not accept parameters — embed integers directly.
    const parts = ["SELECT * FROM c", where, orderBy, `OFFSET ${skip} LIMIT ${top}`]
        .filter(Boolean);
    return { query: parts.join(" "), parameters: acc.params };
}

function buildCountSql(conditions: FilterCondition[]): { query: string; parameters: SqlParameter[] } {
    const acc: ParamAcc = { params: [], idx: 0 };
    const where = conditions.length > 0
        ? `WHERE ${conditions.map(c => condToSql(c, acc)).join(" AND ")}`
        : "";
    const parts = ["SELECT VALUE COUNT(1) FROM c", where].filter(Boolean);
    return { query: parts.join(" "), parameters: acc.params };
}

// ---------------------------------------------------------------------------
// In-memory evaluator — used only when NODE_ENV === "test"
// ---------------------------------------------------------------------------

function evalCond(item: Record<string, unknown>, cond: FilterCondition): boolean {
    switch (cond.op) {
    case "eq":          return item[cond.field] === cond.value;
    case "neq":         return item[cond.field] !== cond.value;
    case "lt":          return (item[cond.field] as string | number) < cond.value;
    case "lte":         return (item[cond.field] as string | number) <= cond.value;
    case "gt":          return (item[cond.field] as string | number) > cond.value;
    case "gte":         return (item[cond.field] as string | number) >= cond.value;
    case "eq_ci":       { const v = item[cond.field]; return typeof v === "string" && v.toLowerCase() === cond.value.toLowerCase(); }
    case "contains_ci": { const v = item[cond.field]; return typeof v === "string" && v.toLowerCase().includes(cond.value.toLowerCase()); }
    case "is_defined":  return item[cond.field] !== undefined && item[cond.field] !== null;
    case "or":          return cond.conditions.some(c => evalCond(item, c));
    }
}

function applySpec<T>(items: T[], spec: FindSpec): T[] {
    const conditions = spec.conditions ?? [];
    let result = conditions.length > 0
        ? items.filter(item => conditions.every(c => evalCond(item as Record<string, unknown>, c)))
        : items;

    if (spec.orderBy) {
        const { field, desc } = spec.orderBy;
        result = [...result].sort((a, b) => {
            const va = (a as Record<string, unknown>)[field];
            const vb = (b as Record<string, unknown>)[field];
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            if (va < vb) return desc ? 1 : -1;
            if (va > vb) return desc ? -1 : 1;
            return 0;
        });
    }

    const skip = spec.skip ?? 0;
    const top = spec.top ?? 100;
    return result.slice(skip, skip + top);
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

/**
 * Generic CRUD repository on top of a Cosmos DB container.
 * Each domain (employees, tasks, etc.) gets its own instance pointed at its container.
 *
 * findWhere() and countWhere() use parameterized Cosmos queries in production and
 * an in-memory evaluator in test mode — no real database is needed for tests.
 */
export class BaseRepository<T extends BaseEntity> {
    constructor(private container: Container) {}

    /** Returns all items with no server-side filtering. Prefer findWhere() for list endpoints. */
    async findAll(): Promise<T[]> {
        const { resources } = await this.container.items.readAll<T>().fetchAll();
        return resources;
    }

    /**
     * Returns a filtered, sorted, paginated slice using a Cosmos parameterized query
     * in production, or an in-memory filter in test mode.
     */
    async findWhere(spec: FindSpec): Promise<T[]> {
        if (process.env.NODE_ENV === "test") {
            const { resources } = await this.container.items.readAll<T>().fetchAll();
            return applySpec(resources, spec);
        }
        const { query, parameters } = buildSelectSql(spec);
        const { resources } = await this.container.items.query<T>({ query, parameters }).fetchAll();
        return resources;
    }

    /**
     * Returns the count of items matching the given conditions using
     * `SELECT VALUE COUNT(1) FROM c WHERE ...` in production, or an in-memory
     * count in test mode.
     */
    async countWhere(conditions: FilterCondition[]): Promise<number> {
        if (process.env.NODE_ENV === "test") {
            const { resources } = await this.container.items.readAll<Record<string, unknown>>().fetchAll();
            return resources.filter(item =>
                conditions.every(c => evalCond(item as Record<string, unknown>, c))
            ).length;
        }
        const { query, parameters } = buildCountSql(conditions);
        const { resources } = await this.container.items.query<number>({ query, parameters }).fetchAll();
        return resources[0] ?? 0;
    }

    async findById(id: string): Promise<T | null> {
        try {
            const { resource } = await this.container.item(id, id).read<T>();
            return resource ?? null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            if (error.code === 404) {
                return null;
            }
            throw error;
        }
    }

    async create(data: Partial<T>): Promise<T> {
        const now = new Date();
        const newEntity = {
            ...data,
            id: uuidv4(),
            createdDate: now,
            updatedDate: now,
        } as T;

        const { resource } = await this.container.items.create(newEntity);
        if (!resource) {
            throw new Error("Failed to create entity");
        }
        return resource as T;
    }

    async update(id: string, data: Partial<T>): Promise<T | null> {
        const existing = await this.findById(id);
        if (!existing) {
            return null;
        }

        const updated = {
            ...existing,
            ...data,
            id, // never let the caller change the id
            updatedDate: new Date(),
        } as T;

        const { resource } = await this.container.item(id, id).replace(updated);
        return (resource as T) ?? null;
    }

    async delete(id: string): Promise<boolean> {
        try {
            await this.container.item(id, id).delete();
            return true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            if (error.code === 404) {
                return false;
            }
            throw error;
        }
    }
}
