import { Container } from "@azure/cosmos";
import { v4 as uuidv4 } from "uuid";

/**
 * All Dales Operations entities share these system fields.
 */
export interface BaseEntity {
    id: string;
    createdDate?: Date;
    updatedDate?: Date;
}

/**
 * Generic CRUD repository on top of a Cosmos DB container.
 * Each domain (employees, tasks, etc.) gets its own instance pointed at its container.
 *
 * This keeps the per-collection code tiny while staying easy to read for beginners.
 */
export class BaseRepository<T extends BaseEntity> {
    constructor(private container: Container) {}

    async findAll(): Promise<T[]> {
        const { resources } = await this.container.items.readAll<T>().fetchAll();
        return resources;
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
