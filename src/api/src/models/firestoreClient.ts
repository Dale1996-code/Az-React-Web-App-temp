import { Firestore, CollectionReference } from "@google-cloud/firestore";
import { DatabaseConfig } from "../config/appConfig";
import { logger } from "../config/observability";

// ---------------------------------------------------------------------------
// Firestore (native mode) data layer for Dales Operations.
//
// On Cloud Run the Firestore client picks up the project and credentials from
// Application Default Credentials automatically — no key file is needed.
// Locally, run `gcloud auth application-default login` (or point
// FIRESTORE_EMULATOR_HOST at the emulator). When NODE_ENV=test the client is
// never constructed; routes use the in-memory store instead.
// ---------------------------------------------------------------------------

// Firestore collection names — one per Dales Operations domain.
export const collectionNames = [
    "employees",
    "tasks",
    "productivity",
    "coaching",
    "issues",
    "summaries",
] as const;

export type CollectionName = typeof collectionNames[number];

/** A stored document. `id` doubles as the Firestore document id. */
export interface DocRecord {
    id: string;
    [key: string]: unknown;
}

/**
 * Minimal persistence port used by BaseRepository. Backed by Firestore in
 * production and by an in-memory Map in tests, so the repository code is
 * identical across both.
 */
export interface DocStore {
    getAll(): Promise<DocRecord[]>;
    get(id: string): Promise<DocRecord | null>;
    set(id: string, data: DocRecord): Promise<void>;
    /** Atomically applies a partial update. Returns false if the document does not exist. */
    patch(id: string, data: Partial<DocRecord>): Promise<boolean>;
    delete(id: string): Promise<boolean>;
}

let firestore: Firestore | undefined;

export const configureFirestore = async (config: DatabaseConfig): Promise<void> => {
    // In test mode routes use the in-memory store — no real client needed.
    if (process.env.NODE_ENV === "test") {
        logger.info("Skipping Firestore configuration in test environment");
        return;
    }

    firestore = new Firestore({
        // projectId is optional on Cloud Run (resolved from the metadata server);
        // databaseId is optional and defaults to "(default)".
        ...(config.projectId ? { projectId: config.projectId } : {}),
        ...(config.databaseId ? { databaseId: config.databaseId } : {}),
    });

    logger.info("Firestore client initialised");
};

/**
 * Returns the DocStore for the given Dales Operations collection.
 * In test mode this is an in-memory Map; otherwise it is Firestore-backed.
 */
export const getStore = (name: CollectionName): DocStore => {
    if (process.env.NODE_ENV === "test") {
        return getMockStore(name);
    }
    if (!firestore) {
        throw new Error(`Firestore not initialised — call configureFirestore first (collection "${name}").`);
    }
    return new FirestoreDocStore(firestore.collection(name));
};

// ---------------------------------------------------------------------------
// Firestore-backed store
// ---------------------------------------------------------------------------

class FirestoreDocStore implements DocStore {
    constructor(private readonly collection: CollectionReference) {}

    async getAll(): Promise<DocRecord[]> {
        const snapshot = await this.collection.get();
        return snapshot.docs.map(doc => doc.data() as DocRecord);
    }

    async get(id: string): Promise<DocRecord | null> {
        const doc = await this.collection.doc(id).get();
        return doc.exists ? (doc.data() as DocRecord) : null;
    }

    async set(id: string, data: DocRecord): Promise<void> {
        await this.collection.doc(id).set(data);
    }

    async patch(id: string, data: Partial<DocRecord>): Promise<boolean> {
        try {
            await this.collection.doc(id).update(data as Record<string, unknown>);
            return true;
        } catch (e) {
            if ((e as { code?: number }).code === 5) {
                return false;
            }
            throw e;
        }
    }

    async delete(id: string): Promise<boolean> {
        const ref = this.collection.doc(id);
        const doc = await ref.get();
        if (!doc.exists) {
            return false;
        }
        await ref.delete();
        return true;
    }
}

// ---------------------------------------------------------------------------
// In-memory store used only when NODE_ENV=test
// ---------------------------------------------------------------------------

const mockData: Record<string, Map<string, DocRecord>> = {};

class InMemoryDocStore implements DocStore {
    constructor(private readonly store: Map<string, DocRecord>) {}

    async getAll(): Promise<DocRecord[]> {
        return Array.from(this.store.values());
    }

    async get(id: string): Promise<DocRecord | null> {
        return this.store.get(id) ?? null;
    }

    async set(id: string, data: DocRecord): Promise<void> {
        this.store.set(id, data);
    }

    async patch(id: string, data: Partial<DocRecord>): Promise<boolean> {
        const existing = this.store.get(id);
        if (!existing) return false;
        this.store.set(id, { ...existing, ...data });
        return true;
    }

    async delete(id: string): Promise<boolean> {
        return this.store.delete(id);
    }
}

const getMockStore = (name: CollectionName): DocStore => {
    if (!mockData[name]) {
        mockData[name] = new Map<string, DocRecord>();
    }
    return new InMemoryDocStore(mockData[name]);
};

/** Resets the in-memory store between test runs. */
export const clearMockData = (): void => {
    if (process.env.NODE_ENV === "test") {
        for (const key of Object.keys(mockData)) {
            mockData[key].clear();
        }
    }
};
