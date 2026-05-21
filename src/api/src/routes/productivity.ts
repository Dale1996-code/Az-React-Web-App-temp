import { createCrudRouter } from "./createCrudRouter";
import { BaseRepository, FilterCondition } from "../models/baseRepository";
import { ProductivityRecord } from "../models/productivity";
import { getStore } from "../models/firestoreClient";
import { validateProductivity } from "../validation";

// Productivity collection — daily productivity entries per employee.
export default createCrudRouter<ProductivityRecord>(
    () => new BaseRepository<ProductivityRecord>(getStore("productivity")),
    "productivity",
    validateProductivity,
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
