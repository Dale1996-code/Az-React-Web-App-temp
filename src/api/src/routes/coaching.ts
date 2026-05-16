import { createCrudRouter } from "./createCrudRouter";
import { BaseRepository, FilterCondition } from "../models/baseRepository";
import { CoachingRecord } from "../models/coaching";
import { getStore } from "../models/firestoreClient";
import { validateCoaching } from "../validation";

// Coaching collection — coaching/feedback records for employees.
export default createCrudRouter<CoachingRecord>(
    () => new BaseRepository<CoachingRecord>(getStore("coaching")),
    "coaching",
    validateCoaching,
    (query) => {
        const conditions: FilterCondition[] = [];

        // ?date=YYYY-MM-DD  (exact match on storeDate)
        if (query.date) {
            conditions.push({ op: "eq", field: "storeDate", value: query.date });
        }

        // ?employeeId=<id>
        if (query.employeeId) {
            conditions.push({ op: "eq", field: "employeeId", value: query.employeeId });
        }

        return { conditions };
    },
);
