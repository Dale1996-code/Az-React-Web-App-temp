import { createCrudRouter } from "./createCrudRouter";
import { BaseRepository } from "../models/baseRepository";
import { ProductivityRecord } from "../models/productivity";
import { getContainer } from "../models/cosmosClient";
import { validateProductivity } from "../validation";

// Productivity collection — daily productivity entries per employee.
export default createCrudRouter<ProductivityRecord>(
    () => new BaseRepository<ProductivityRecord>(getContainer("productivity")),
    "productivity",
    validateProductivity,
    (items, query) => {
        let result = items;

        // ?date=YYYY-MM-DD  (exact match on storeDate)
        if (query.date) {
            result = result.filter(p => p.storeDate === query.date);
        }

        // ?employeeId=<id>
        if (query.employeeId) {
            result = result.filter(p => p.employeeId === query.employeeId);
        }

        return result;
    },
);
