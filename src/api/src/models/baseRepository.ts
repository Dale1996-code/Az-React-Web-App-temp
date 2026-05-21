import { v4 as uuidv4 } from "uuid";
import { DocStore, DocRecord } from "./firestoreClient";

export interface BaseEntity {
    id: string;
    createdDate?: string;
    updatedDate?: string;
}

// ---------------------------------------------------------------------------
// Query specification types
// ---------------------------------------------------------------------------

/**
 * A single WHERE condition used by findWhere() and countWhere().
 * Filtering is evaluated in-memory after fetching the collection — Firestore
 * has no case-insensitive or substring query support, and the Dales
 * Operations collections are small enough that a full read is acceptable.
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
// In-memory query evaluator
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
 * Generic CRUD repository on top of a DocStore (Firestore in production,
 * in-memory in tests). Each domain (employees, tasks, etc.) gets its own
 * instance pointed at its collection.
 */
export class BaseRepository<T extends BaseEntity> {
    constructor(private store: DocStore) {}

    /** Returns all items with no filtering. Prefer findWhere() for list endpoints. */
    async findAll(): Promise<T[]> {
        return (await this.store.getAll()) as unknown as T[];
    }

    /** Returns a filtered, sorted, paginated slice of the collection. */
    async findWhere(spec: FindSpec): Promise<T[]> {
        const all = await this.store.getAll();
        return applySpec(all, spec) as unknown as T[];
    }

    /** Returns the count of items matching the given conditions. */
    async countWhere(conditions: FilterCondition[]): Promise<number> {
        const all = await this.store.getAll();
        return all.filter(item => conditions.every(c => evalCond(item, c))).length;
    }

    async findById(id: string): Promise<T | null> {
        return (await this.store.get(id)) as unknown as T | null;
    }

    async create(data: Partial<T>): Promise<T> {
        const now = new Date().toISOString();
        const id = uuidv4();
        const newEntity: DocRecord = {
            ...(data as Record<string, unknown>),
            id,
            createdDate: now,
            updatedDate: now,
        };
        await this.store.set(id, newEntity);
        return newEntity as unknown as T;
    }

    async update(id: string, data: Partial<T>): Promise<T | null> {
        const existing = await this.store.get(id);
        if (!existing) {
            return null;
        }

        const updated: DocRecord = {
            ...existing,
            ...(data as Record<string, unknown>),
            id, // never let the caller change the id
            updatedDate: new Date().toISOString(),
        };
        await this.store.set(id, updated);
        return updated as unknown as T;
    }

    async delete(id: string): Promise<boolean> {
        return this.store.delete(id);
    }
}
