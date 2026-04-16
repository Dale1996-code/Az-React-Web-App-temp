import { createCrudRouter } from "./createCrudRouter";
import { BaseRepository } from "../models/baseRepository";
import { DailySummary } from "../models/summary";
import { getContainer } from "../models/cosmosClient";
import { validateSummary } from "../validation";

// Summaries collection — end-of-shift daily summaries.
export default createCrudRouter<DailySummary>(
    () => new BaseRepository<DailySummary>(getContainer("summaries")),
    "summaries",
    validateSummary,
    (items, query) => {
        let result = items;

        // ?date=YYYY-MM-DD (exact match on storeDate)
        if (query.date) {
            result = result.filter(s => s.storeDate === query.date);
        }

        // ?shiftLabel=morning|afternoon|closing|overnight (case-insensitive)
        if (query.shiftLabel) {
            const shift = query.shiftLabel.toLowerCase();
            result = result.filter(s => s.shiftLabel.toLowerCase() === shift);
        }

        return result;
    },
);
