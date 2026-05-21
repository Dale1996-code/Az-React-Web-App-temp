import { createCrudRouter } from "./createCrudRouter";
import { BaseRepository, FilterCondition } from "../models/baseRepository";
import { DailySummary } from "../models/summary";
import { getStore } from "../models/firestoreClient";
import { validateSummary } from "../validation";

// Summaries collection — end-of-shift daily summaries.
export default createCrudRouter<DailySummary>(
    () => new BaseRepository<DailySummary>(getStore("summaries")),
    "summaries",
    validateSummary,
    (query) => {
        const conditions: FilterCondition[] = [];

        // ?date=YYYY-MM-DD  (exact match on storeDate)
        if (query.date) {
            conditions.push({ op: "eq", field: "storeDate", value: query.date });
        }

        // ?shiftLabel=morning|afternoon|closing|overnight  (case-insensitive)
        if (query.shiftLabel) {
            conditions.push({ op: "eq_ci", field: "shiftLabel", value: query.shiftLabel });
        }

        return { conditions };
    },
);
