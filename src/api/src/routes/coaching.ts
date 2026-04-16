import { createCrudRouter } from "./createCrudRouter";
import { BaseRepository } from "../models/baseRepository";
import { CoachingRecord } from "../models/coaching";
import { getContainer } from "../models/cosmosClient";
import { validateCoaching } from "../validation";

// Coaching collection — coaching/feedback records for employees.
export default createCrudRouter<CoachingRecord>(
    () => new BaseRepository<CoachingRecord>(getContainer("coaching")),
    "coaching",
    validateCoaching,
    (items, query) => {
        let result = items;

        // ?date=YYYY-MM-DD  (exact match on storeDate)
        if (query.date) {
            result = result.filter(c => c.storeDate === query.date);
        }

        // ?employeeId=<id>
        if (query.employeeId) {
            result = result.filter(c => c.employeeId === query.employeeId);
        }

        return result;
    },
);
