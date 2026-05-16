import { createCrudRouter } from "./createCrudRouter";
import { BaseRepository, FilterCondition } from "../models/baseRepository";
import { IssueLog } from "../models/issue";
import { getStore } from "../models/firestoreClient";
import { validateIssue } from "../validation";

// Issues collection — quick-entry issue log for the shift.
export default createCrudRouter<IssueLog>(
    () => new BaseRepository<IssueLog>(getStore("issues")),
    "issues",
    validateIssue,
    (query) => {
        const conditions: FilterCondition[] = [];

        // ?date=YYYY-MM-DD  (exact match on storeDate)
        if (query.date) {
            conditions.push({ op: "eq", field: "storeDate", value: query.date });
        }

        // ?status=open|resolved
        if (query.status) {
            conditions.push({ op: "eq", field: "status", value: query.status });
        }

        // ?department=<string>  (case-insensitive)
        if (query.department) {
            conditions.push({ op: "eq_ci", field: "department", value: query.department });
        }

        // ?category=<string>  (case-insensitive)
        if (query.category) {
            conditions.push({ op: "eq_ci", field: "category", value: query.category });
        }

        return { conditions };
    },
);
